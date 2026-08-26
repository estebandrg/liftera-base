import { describe, it, expect } from 'vitest';
import { ProposalValidator } from './ProposalValidator.js';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { ExerciseId } from '../exercise/ExerciseId.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal, ProgressEvidence } from '../signals/ProgressSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';

// Neutral baseline: no signals (no coherence restriction), stable trend,
// high window confidence so a medium proposal confidence stays below the
// floor, and magnitudes inside policy ceilings. Tests override what they
// need to isolate each rule.
const evidence = (overrides: Partial<CoachEvidence> = {}): CoachEvidence => ({
  exerciseId: new ExerciseId('squat', 'high-bar'),
  trend: Trend.Stable,
  signals: [],
  policyLimits: ProgressionPolicy,
  windowConfidence: Confidence.High,
  ...overrides,
});

const proposal = (overrides: Partial<TrainingProposal> = {}): TrainingProposal => ({
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Evidence-backed proposal.',
  confidence: Confidence.Medium,
  ...overrides,
});

// Structurally matching, in-ceiling magnitude per action, so rule (b) tests
// isolate coherence from rules (a) and (c).
const MAGNITUDE_FOR: Record<DecisionAction, DecisionMagnitude> = {
  increaseLoad: { kind: 'load', value: 2.5, unit: 'kg' },
  increaseReps: { kind: 'reps', value: 1 },
  decreaseLoad: { kind: 'loadPercent', percent: -10 },
  decreaseVolume: { kind: 'sets', value: -1 },
  maintain: { kind: 'none' },
  evaluateChange: { kind: 'none' },
};

const progress = (overrides: Partial<ProgressEvidence> = {}): ProgressSignal =>
  new ProgressSignal({
    windowSize: 3,
    volumeChangePct: 8,
    lastEffectiveRir: 2,
    rirInAllSessions: true,
    topSetReps: 12,
    loadUnit: 'kg',
    ...overrides,
  });

const fatigue = (windowSize = 3): FatigueSignal =>
  new FatigueSignal({ windowSize, volumeChangePct: -12, lastEffectiveRir: 5 });

const regression = (windowSize = 3): RegressionSignal =>
  new RegressionSignal({ windowSize, volumeChangePct: -9, lastEffectiveRir: 'unknown' });

const stagnation = (): StagnationSignal =>
  new StagnationSignal({ windowSize: 3, volumeChangePct: 0.5, topSetReps: 8, loadUnit: 'kg' });

describe('ProposalValidator — rule (a): structural kind-action pairing', () => {
  const validator = new ProposalValidator();

  const validPairs: { action: DecisionAction; magnitude: DecisionMagnitude }[] = [
    { action: 'increaseLoad', magnitude: { kind: 'load', value: 2.5, unit: 'kg' } },
    { action: 'increaseReps', magnitude: { kind: 'reps', value: 1 } },
    { action: 'decreaseLoad', magnitude: { kind: 'loadPercent', percent: -10 } },
    { action: 'decreaseVolume', magnitude: { kind: 'sets', value: -1 } },
    { action: 'maintain', magnitude: { kind: 'none' } },
    { action: 'evaluateChange', magnitude: { kind: 'none' } },
  ];

  for (const { action, magnitude } of validPairs) {
    it(`accepts ${action} with kind '${magnitude.kind}'`, () => {
      const result = validator.validate(proposal({ action, magnitude }), evidence());

      expect(result.status).toBe('valid');
    });
  }

  const mismatches: { action: DecisionAction; magnitude: DecisionMagnitude; validKind: string }[] =
    [
      { action: 'increaseLoad', magnitude: { kind: 'reps', value: 1 }, validKind: 'load' },
      {
        action: 'increaseReps',
        magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
        validKind: 'reps',
      },
      {
        action: 'decreaseLoad',
        magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
        validKind: 'loadPercent',
      },
      {
        action: 'decreaseVolume',
        magnitude: { kind: 'loadPercent', percent: -10 },
        validKind: 'sets',
      },
      { action: 'maintain', magnitude: { kind: 'sets', value: -1 }, validKind: 'none' },
      {
        action: 'evaluateChange',
        magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
        validKind: 'none',
      },
      { action: 'increaseLoad', magnitude: { kind: 'none' }, validKind: 'load' },
    ];

  for (const { action, magnitude, validKind } of mismatches) {
    it(`rejects ${action} with kind '${magnitude.kind}' as policy_violation`, () => {
      const result = validator.validate(proposal({ action, magnitude }), evidence());

      expect(result.status).toBe('rejected');
      if (result.status !== 'rejected') {
        return;
      }
      expect(result.violations).toHaveLength(1);
      const violation = result.violations[0];
      expect(violation.code).toBe('policy_violation');
      expect(violation.field).toBe('magnitude');
      expect(violation.expected).toBe(validKind);
      expect(violation.actual).toBe(magnitude.kind);
    });
  }
});

describe('ProposalValidator — rule (b): directional action-state coherence envelope', () => {
  const validator = new ProposalValidator();

  const states: {
    state: string;
    signals: PerformanceSignal[];
    trend: Trend;
    forbidden: DecisionAction[];
  }[] = [
    {
      state: 'progress ∧ fatigue (contradiction, halt)',
      signals: [progress(), fatigue()],
      trend: Trend.Improving,
      forbidden: ['increaseLoad', 'increaseReps'],
    },
    {
      state: 'progress ∧ regression (contradiction, halt)',
      signals: [progress(), regression()],
      trend: Trend.Stable,
      forbidden: ['increaseLoad', 'increaseReps'],
    },
    {
      state: 'fatigue ∧ declining (decrease)',
      signals: [fatigue()],
      trend: Trend.Declining,
      forbidden: ['increaseLoad', 'increaseReps'],
    },
    {
      state: 'fatigue ∧ stable (decrease)',
      signals: [fatigue()],
      trend: Trend.Stable,
      forbidden: ['increaseLoad', 'increaseReps'],
    },
    {
      state: 'regression ∧ declining (decrease)',
      signals: [regression()],
      trend: Trend.Declining,
      forbidden: ['increaseLoad', 'increaseReps'],
    },
    {
      state: 'progress ∧ improving (increase)',
      signals: [progress()],
      trend: Trend.Improving,
      forbidden: ['decreaseLoad', 'decreaseVolume'],
    },
    {
      state: 'stagnation ∧ stable (increase)',
      signals: [stagnation()],
      trend: Trend.Stable,
      forbidden: ['decreaseLoad', 'decreaseVolume'],
    },
  ];

  for (const { state, signals, trend, forbidden } of states) {
    for (const action of forbidden) {
      it(`rejects ${action} as action_invalid_for_signal when ${state}`, () => {
        const result = validator.validate(
          proposal({ action, magnitude: MAGNITUDE_FOR[action] }),
          evidence({ signals, trend }),
        );

        expect(result.status).toBe('rejected');
        if (result.status !== 'rejected') {
          return;
        }
        expect(result.violations).toHaveLength(1);
        const violation = result.violations[0];
        expect(violation.code).toBe('action_invalid_for_signal');
        expect(violation.field).toBe('action');
        expect(violation.actual).toBe(action);
      });
    }
  }

  const allowed: {
    state: string;
    signals: PerformanceSignal[];
    trend: Trend;
    action: DecisionAction;
  }[] = [
    {
      state: 'progress ∧ fatigue (halt): conservative decrease stays allowed',
      signals: [progress(), fatigue()],
      trend: Trend.Improving,
      action: 'decreaseLoad',
    },
    {
      state: 'fatigue ∧ declining (decrease): same-direction alternative allowed',
      signals: [fatigue()],
      trend: Trend.Declining,
      action: 'decreaseVolume',
    },
    {
      state: 'fatigue ∧ stable (decrease): same-direction alternative allowed',
      signals: [fatigue()],
      trend: Trend.Stable,
      action: 'decreaseLoad',
    },
    {
      state: 'regression ∧ declining (decrease): same-direction alternative allowed',
      signals: [regression()],
      trend: Trend.Declining,
      action: 'decreaseVolume',
    },
    {
      state: 'progress ∧ improving (increase): same-direction alternative allowed',
      signals: [progress()],
      trend: Trend.Improving,
      action: 'increaseReps',
    },
    {
      state: 'stagnation ∧ stable (increase): load bump allowed though engine nudges reps',
      signals: [stagnation()],
      trend: Trend.Stable,
      action: 'increaseLoad',
    },
    {
      state: 'progress ∧ stable (neutral): nothing forbidden',
      signals: [progress()],
      trend: Trend.Stable,
      action: 'decreaseLoad',
    },
    {
      state: 'regression ∧ stable (neutral): nothing forbidden',
      signals: [regression()],
      trend: Trend.Stable,
      action: 'increaseLoad',
    },
  ];

  for (const { state, signals, trend, action } of allowed) {
    it(`accepts ${action} when ${state}`, () => {
      const result = validator.validate(
        proposal({ action, magnitude: MAGNITUDE_FOR[action] }),
        evidence({ signals, trend }),
      );

      expect(result.status).toBe('valid');
    });
  }
});

describe('ProposalValidator — rule (c): magnitude clamping to policy ceilings', () => {
  const validator = new ProposalValidator();

  const overCeiling: {
    action: DecisionAction;
    proposed: DecisionMagnitude;
    clamped: DecisionMagnitude;
    limit: number;
    proposedValue: number;
  }[] = [
    {
      action: 'increaseLoad',
      proposed: { kind: 'load', value: 5, unit: 'kg' },
      clamped: { kind: 'load', value: 2.5, unit: 'kg' },
      limit: 2.5,
      proposedValue: 5,
    },
    {
      action: 'increaseLoad',
      proposed: { kind: 'load', value: 10, unit: 'lb' },
      clamped: { kind: 'load', value: 5, unit: 'lb' },
      limit: 5,
      proposedValue: 10,
    },
    {
      action: 'increaseReps',
      proposed: { kind: 'reps', value: 3 },
      clamped: { kind: 'reps', value: 1 },
      limit: 1,
      proposedValue: 3,
    },
    {
      action: 'decreaseLoad',
      proposed: { kind: 'loadPercent', percent: -25 },
      clamped: { kind: 'loadPercent', percent: -10 },
      limit: -10,
      proposedValue: -25,
    },
    {
      action: 'decreaseVolume',
      proposed: { kind: 'sets', value: -3 },
      clamped: { kind: 'sets', value: -1 },
      limit: -1,
      proposedValue: -3,
    },
  ];

  for (const { action, proposed, clamped, limit, proposedValue } of overCeiling) {
    it(`adjusts ${action} ${proposedValue} to the policy limit ${limit}`, () => {
      const result = validator.validate(proposal({ action, magnitude: proposed }), evidence());

      expect(result.status).toBe('adjusted');
      if (result.status !== 'adjusted') {
        return;
      }
      expect(result.adjustedMagnitude).toEqual(clamped);
      expect(result.violations).toHaveLength(1);
      const violation = result.violations[0];
      expect(violation.code).toBe('magnitude_exceeds_limit');
      expect(violation.field).toBe('magnitude');
      expect(violation.expected).toBe(limit);
      expect(violation.actual).toBe(proposedValue);
    });
  }

  const withinLimits: { action: DecisionAction; magnitude: DecisionMagnitude; label: string }[] = [
    {
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      label: 'at the kg ceiling',
    },
    {
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 1, unit: 'kg' },
      label: 'under the kg ceiling',
    },
    {
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 5, unit: 'lb' },
      label: 'at the lb ceiling',
    },
    {
      action: 'increaseReps',
      magnitude: { kind: 'reps', value: 1 },
      label: 'at the rep ceiling',
    },
    {
      action: 'decreaseLoad',
      magnitude: { kind: 'loadPercent', percent: -10 },
      label: 'at the reduction limit',
    },
    {
      action: 'decreaseLoad',
      magnitude: { kind: 'loadPercent', percent: -5 },
      label: 'conservative under the reduction limit',
    },
    {
      action: 'decreaseVolume',
      magnitude: { kind: 'sets', value: -1 },
      label: 'at the volume limit',
    },
  ];

  for (const { action, magnitude, label } of withinLimits) {
    it(`accepts ${action} ${label} as valid`, () => {
      const result = validator.validate(proposal({ action, magnitude }), evidence());

      expect(result.status).toBe('valid');
    });
  }
});
