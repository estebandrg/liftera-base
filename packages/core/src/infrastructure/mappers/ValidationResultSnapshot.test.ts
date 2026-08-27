import { describe, it, expect } from 'vitest';
import {
  ValidationResultSnapshotSchema,
  ValidationResultSnapshotMapper,
} from './ValidationResultSnapshot.js';
import { ValidationResult } from '../../domain/boundary/ValidationResult.js';

const mapper = new ValidationResultSnapshotMapper();

describe('ValidationResultSnapshotMapper.toSnapshot — tri-state preserved', () => {
  it('round-trips a valid result', () => {
    const valid: ValidationResult = { status: 'valid' };

    const snapshot = mapper.toSnapshot(valid);

    expect(snapshot).toEqual({ status: 'valid' });
    expect(ValidationResultSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('round-trips an adjusted result with clamped magnitude and violation payloads', () => {
    const adjusted: ValidationResult = {
      status: 'adjusted',
      adjustedMagnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      violations: [
        {
          code: 'magnitude_exceeds_limit',
          message: 'Proposed 5 kg exceeds the policy limit of 2.5 kg; clamped to the limit.',
          field: 'magnitude',
          expected: 2.5,
          actual: 5,
        },
      ],
    };

    const snapshot = mapper.toSnapshot(adjusted);

    expect(snapshot).toEqual(adjusted);
    expect(ValidationResultSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('round-trips an adjusted result with a loadPercent magnitude', () => {
    const adjusted: ValidationResult = {
      status: 'adjusted',
      adjustedMagnitude: { kind: 'loadPercent', percent: -10 },
      violations: [
        {
          code: 'magnitude_exceeds_limit',
          message: 'Proposed -20% exceeds the fatigue reduction limit of -10%; clamped.',
          field: 'magnitude',
          expected: -10,
          actual: -20,
        },
      ],
    };

    const snapshot = mapper.toSnapshot(adjusted);

    expect(snapshot.status).toBe('adjusted');
    if (snapshot.status === 'adjusted') {
      expect(snapshot.adjustedMagnitude).toEqual({ kind: 'loadPercent', percent: -10 });
    }
  });

  it('round-trips a rejected result collecting every violation', () => {
    const rejected: ValidationResult = {
      status: 'rejected',
      violations: [
        {
          code: 'policy_violation',
          message: "Magnitude kind 'reps' is incompatible with action 'increaseLoad'.",
          field: 'magnitude',
          expected: 'load',
          actual: 'reps',
        },
        {
          code: 'confidence_mismatch',
          message: "Proposal confidence 'high' exceeds the floor of 'medium'.",
          field: 'confidence',
          expected: 'medium',
          actual: 'high',
        },
      ],
    };

    const snapshot = mapper.toSnapshot(rejected);

    expect(snapshot).toEqual(rejected);
    expect(ValidationResultSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe('ValidationResultSnapshotMapper.toSnapshot — violations tolerate absent expected/actual', () => {
  it('serializes a coherence violation that carries no expected payload', () => {
    const rejected: ValidationResult = {
      status: 'rejected',
      violations: [
        {
          code: 'action_invalid_for_signal',
          message: "Action 'increaseLoad' opposes the direction of the current evidence.",
          field: 'action',
          actual: 'increaseLoad',
        },
      ],
    };

    const snapshot = mapper.toSnapshot(rejected);

    expect(snapshot.status).toBe('rejected');
    if (snapshot.status === 'rejected') {
      expect(snapshot.violations[0].code).toBe('action_invalid_for_signal');
      expect('expected' in snapshot.violations[0]).toBe(false);
      expect(snapshot.violations[0].actual).toBe('increaseLoad');
    }
  });

  it('serializes a violation carrying neither expected nor actual', () => {
    const rejected: ValidationResult = {
      status: 'rejected',
      violations: [
        {
          code: 'policy_violation',
          message: 'Structurally incompatible proposal.',
          field: 'action',
        },
      ],
    };

    const snapshot = mapper.toSnapshot(rejected);

    expect(snapshot).toEqual(rejected);
  });
});

describe('ValidationResultSnapshotSchema — malformed snapshots rejected', () => {
  it('rejects an unknown status', () => {
    const result = ValidationResultSnapshotSchema.safeParse({ status: 'maybe' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown violation code', () => {
    const result = ValidationResultSnapshotSchema.safeParse({
      status: 'rejected',
      violations: [{ code: 'unknown_code', message: 'Nope.', field: 'action' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an adjusted result without adjustedMagnitude', () => {
    const result = ValidationResultSnapshotSchema.safeParse({
      status: 'adjusted',
      violations: [],
    });

    expect(result.success).toBe(false);
  });
});
