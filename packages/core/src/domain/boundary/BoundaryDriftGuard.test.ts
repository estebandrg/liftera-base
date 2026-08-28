import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../services/DecisionEngine.js';
import { Decision, DecisionAction } from '../recommendation/Decision.js';
import { ExerciseId } from '../exercise/ExerciseId.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal, ProgressEvidence } from '../signals/ProgressSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { ProposalValidator } from './ProposalValidator.js';

/**
 * Drift guard (design: Testing Strategy). The DecisionEngine priority table
 * and the ProposalValidator envelope/floor are two READINGS of the same
 * policy; this suite proves they cannot drift apart: replaying the engine's
 * own decision as a proposal MUST stay inside the validator's envelope
 * (rule b) and at or below its confidence floor (rule d), for every state
 * of the coherence derivation table.
 *
 * Every signal carries windowSize 3, so the matching real pipeline floor is
 * ExerciseProgression.windowConfidence() === 'medium' — the elevation to
 * 'high' fires only when a ProgressSignal has rirInAllSessions === true.
 */
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

const fatigue = (): FatigueSignal =>
  new FatigueSignal({ windowSize: 3, volumeChangePct: -12, lastEffectiveRir: 5 });

const regression = (): RegressionSignal =>
  new RegressionSignal({ windowSize: 3, volumeChangePct: -9, lastEffectiveRir: 'unknown' });

const stagnation = (topSetReps = 8): StagnationSignal =>
  new StagnationSignal({ windowSize: 3, volumeChangePct: 0.5, topSetReps, loadUnit: 'kg' });

interface EngineState {
  readonly name: string;
  readonly signals: readonly PerformanceSignal[];
  readonly trend: Trend;
  readonly expectedAction: DecisionAction;
  readonly expectedConfidence: Confidence;
}

const ENGINE_STATES: readonly EngineState[] = [
  {
    name: 'progress ∧ fatigue (contradiction)',
    signals: [progress(), fatigue()],
    trend: Trend.Improving,
    expectedAction: 'evaluateChange',
    expectedConfidence: Confidence.Low,
  },
  {
    name: 'progress ∧ regression (contradiction)',
    signals: [progress(), regression()],
    trend: Trend.Stable,
    expectedAction: 'evaluateChange',
    expectedConfidence: Confidence.Low,
  },
  {
    name: 'fatigue ∧ declining',
    signals: [fatigue()],
    trend: Trend.Declining,
    expectedAction: 'decreaseLoad',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'fatigue ∧ stable',
    signals: [fatigue()],
    trend: Trend.Stable,
    expectedAction: 'decreaseVolume',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'fatigue ∧ improving',
    signals: [fatigue()],
    trend: Trend.Improving,
    expectedAction: 'decreaseVolume',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'regression ∧ declining',
    signals: [regression()],
    trend: Trend.Declining,
    expectedAction: 'decreaseLoad',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'regression ∧ stable (no engine row)',
    signals: [regression()],
    trend: Trend.Stable,
    expectedAction: 'maintain',
    expectedConfidence: Confidence.Low,
  },
  {
    name: 'progress ∧ improving, top set at range top',
    signals: [progress({ topSetReps: 12 })],
    trend: Trend.Improving,
    expectedAction: 'increaseLoad',
    expectedConfidence: Confidence.High,
  },
  {
    name: 'progress ∧ improving, top set below range top',
    signals: [progress({ topSetReps: 8 })],
    trend: Trend.Improving,
    expectedAction: 'increaseReps',
    expectedConfidence: Confidence.High,
  },
  {
    name: 'progress ∧ improving without full RIR evidence',
    signals: [progress({ rirInAllSessions: false, topSetReps: 8 })],
    trend: Trend.Improving,
    expectedAction: 'increaseReps',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'stagnation ∧ stable, top set below range top',
    signals: [stagnation(8)],
    trend: Trend.Stable,
    expectedAction: 'increaseReps',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'stagnation ∧ stable, top set at range top',
    signals: [stagnation(12)],
    trend: Trend.Stable,
    expectedAction: 'increaseLoad',
    expectedConfidence: Confidence.Medium,
  },
  {
    name: 'stagnation ∧ improving (no engine row)',
    signals: [stagnation()],
    trend: Trend.Improving,
    expectedAction: 'maintain',
    expectedConfidence: Confidence.Low,
  },
  {
    name: 'progress ∧ stable (no engine row)',
    signals: [progress()],
    trend: Trend.Stable,
    expectedAction: 'maintain',
    expectedConfidence: Confidence.Low,
  },
  {
    name: 'no signal fired',
    signals: [],
    trend: Trend.Stable,
    expectedAction: 'maintain',
    expectedConfidence: Confidence.Low,
  },
];

const evidenceFor = (state: EngineState): CoachEvidence => ({
  exerciseId: new ExerciseId('Back Squat', 'Low Bar'),
  trend: state.trend,
  signals: state.signals,
  policyLimits: ProgressionPolicy,
  windowConfidence: Confidence.Medium,
});

// Replays the engine's decision as a proposal: magnitude comes from the
// decision itself, so rules (a) and (c) cannot interfere — only the guarded
// invariants (coherence envelope and confidence floor) can fire.
const proposalFromDecision = (decision: Decision, state: EngineState): TrainingProposal => ({
  source: 'system',
  intent: 'progress',
  action: decision.action,
  magnitude: decision.magnitude,
  justification: `Engine replay for drift-guard state: ${state.name}.`,
  confidence: decision.confidence,
});

const violationCodes = (state: EngineState) => {
  const decision = new DecisionEngine().recommend([...state.signals], state.trend);
  const result = new ProposalValidator().validate(
    proposalFromDecision(decision, state),
    evidenceFor(state),
  );
  const codes = result.status === 'valid' ? [] : result.violations.map((v) => v.code);
  return { decision, codes };
};

describe('BoundaryDriftGuard — coherence envelope', () => {
  it('never forbids the action the DecisionEngine itself recommends', () => {
    for (const state of ENGINE_STATES) {
      const { decision, codes } = violationCodes(state);

      expect(decision.action, `${state.name}: engine row changed`).toBe(state.expectedAction);
      expect(
        codes,
        `${state.name}: engine action '${decision.action}' must never be validator-forbidden`,
      ).not.toContain('action_invalid_for_signal');
    }
  });
});

describe('BoundaryDriftGuard — confidence floor', () => {
  it('never rates engine confidence above the validator floor', () => {
    for (const state of ENGINE_STATES) {
      const { decision, codes } = violationCodes(state);

      expect(decision.confidence, `${state.name}: engine confidence changed`).toBe(
        state.expectedConfidence,
      );
      expect(
        codes,
        `${state.name}: engine confidence '${decision.confidence}' must stay at or below the validator floor`,
      ).not.toContain('confidence_mismatch');
    }
  });
});

describe('BoundaryDriftGuard — full replay', () => {
  it('keeps every engine decision fully valid through the boundary', () => {
    for (const state of ENGINE_STATES) {
      const decision = new DecisionEngine().recommend([...state.signals], state.trend);
      const result = new ProposalValidator().validate(
        proposalFromDecision(decision, state),
        evidenceFor(state),
      );

      expect(result.status, `${state.name}: ${JSON.stringify(result)}`).toBe('valid');
    }
  });
});
