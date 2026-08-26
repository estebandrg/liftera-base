import { describe, it, expect } from 'vitest';
import { ProposalValidator } from './ProposalValidator.js';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { ExerciseId } from '../exercise/ExerciseId.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';

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
