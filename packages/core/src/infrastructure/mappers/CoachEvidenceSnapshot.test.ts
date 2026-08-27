import { describe, it, expect } from 'vitest';
import {
  CoachEvidenceSnapshotSchema,
  CoachEvidenceSnapshotMapper,
} from './CoachEvidenceSnapshot.js';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';
import { ProgressSignal } from '../../domain/signals/ProgressSignal.js';
import { FatigueSignal } from '../../domain/signals/FatigueSignal.js';
import { RegressionSignal } from '../../domain/signals/RegressionSignal.js';
import { StagnationSignal } from '../../domain/signals/StagnationSignal.js';
import { Trend } from '../../domain/value-objects/Trend.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';

const mapper = new CoachEvidenceSnapshotMapper();

const evidence = (overrides: Partial<CoachEvidence> = {}): CoachEvidence => ({
  exerciseId: new ExerciseId('squat', 'high-bar'),
  trend: Trend.Improving,
  signals: [],
  policyLimits: ProgressionPolicy,
  windowConfidence: Confidence.Medium,
  ...overrides,
});

describe('CoachEvidenceSnapshotMapper.toSnapshot — evidence shape', () => {
  it('flattens exerciseId to exerciseType plus variation and carries trend and confidence', () => {
    const snapshot = mapper.toSnapshot(
      evidence({ trend: Trend.Declining, windowConfidence: Confidence.Low }),
    );

    expect(snapshot.exerciseId).toEqual({ exerciseType: 'squat', variation: 'high-bar' });
    expect(snapshot.trend).toBe('declining');
    expect(snapshot.windowConfidence).toBe('low');
    expect(snapshot.signals).toEqual([]);
  });

  it('renames every policy limit SCREAMING key to camelCase, values flowing from the embedded reference', () => {
    const snapshot = mapper.toSnapshot(evidence());

    expect(snapshot.policyLimits).toEqual({
      loadIncrementKg: ProgressionPolicy.LOAD_INCREMENT_KG,
      loadIncrementLb: ProgressionPolicy.LOAD_INCREMENT_LB,
      repIncrement: ProgressionPolicy.REP_INCREMENT,
      fatigueLoadReductionPct: ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT,
      volumeReductionSets: ProgressionPolicy.VOLUME_REDUCTION_SETS,
      volumeFlatTolerancePct: ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT,
      repsFlatTolerance: ProgressionPolicy.REPS_FLAT_TOLERANCE,
      repRangeTop: ProgressionPolicy.REP_RANGE_TOP,
      progressRirMax: ProgressionPolicy.PROGRESS_RIR_MAX,
      fatigueRirMin: ProgressionPolicy.FATIGUE_RIR_MIN,
    });
  });

  it('round-trips through the snapshot schema (wire-contract guarantee)', () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        signals: [
          new ProgressSignal({
            windowSize: 3,
            volumeChangePct: 20,
            lastEffectiveRir: 1.5,
            rirInAllSessions: true,
            topSetReps: 12,
            loadUnit: 'kg',
          }),
        ],
      }),
    );

    expect(CoachEvidenceSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe('CoachEvidenceSnapshotMapper.toSnapshot — signals discriminated union', () => {
  it('serializes a progress signal with rirInAllSessions, topSetReps and loadUnit', () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        signals: [
          new ProgressSignal({
            windowSize: 3,
            volumeChangePct: 20,
            lastEffectiveRir: 1.5,
            rirInAllSessions: true,
            topSetReps: 12,
            loadUnit: 'kg',
          }),
        ],
      }),
    );

    expect(snapshot.signals).toEqual([
      {
        kind: 'progress',
        windowSize: 3,
        volumeChangePct: 20,
        lastEffectiveRir: 1.5,
        rirInAllSessions: true,
        topSetReps: 12,
        loadUnit: 'kg',
      },
    ]);
  });

  it('serializes a fatigue signal without progress-only fields', () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        trend: Trend.Declining,
        signals: [new FatigueSignal({ windowSize: 3, volumeChangePct: -15, lastEffectiveRir: 4 })],
      }),
    );

    expect(snapshot.signals).toEqual([
      { kind: 'fatigue', windowSize: 3, volumeChangePct: -15, lastEffectiveRir: 4 },
    ]);
    expect('rirInAllSessions' in snapshot.signals[0]).toBe(false);
    expect('topSetReps' in snapshot.signals[0]).toBe(false);
  });

  it("serializes a regression signal carrying lastEffectiveRir 'unknown'", () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        trend: Trend.Declining,
        signals: [
          new RegressionSignal({
            windowSize: 3,
            volumeChangePct: -12,
            lastEffectiveRir: 'unknown',
          }),
        ],
      }),
    );

    expect(snapshot.signals).toEqual([
      { kind: 'regression', windowSize: 3, volumeChangePct: -12, lastEffectiveRir: 'unknown' },
    ]);
  });

  it('serializes a stagnation signal with topSetReps and loadUnit but no lastEffectiveRir', () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        trend: Trend.Stable,
        signals: [
          new StagnationSignal({
            windowSize: 3,
            volumeChangePct: 0.5,
            topSetReps: 10,
            loadUnit: 'lb',
          }),
        ],
      }),
    );

    expect(snapshot.signals).toEqual([
      { kind: 'stagnation', windowSize: 3, volumeChangePct: 0.5, topSetReps: 10, loadUnit: 'lb' },
    ]);
    expect('lastEffectiveRir' in snapshot.signals[0]).toBe(false);
  });

  it('serializes a mixed signal window preserving order', () => {
    const snapshot = mapper.toSnapshot(
      evidence({
        signals: [
          new ProgressSignal({
            windowSize: 3,
            volumeChangePct: 20,
            lastEffectiveRir: 1,
            rirInAllSessions: true,
            topSetReps: 12,
            loadUnit: 'kg',
          }),
          new FatigueSignal({ windowSize: 3, volumeChangePct: -8, lastEffectiveRir: 5 }),
        ],
      }),
    );

    expect(snapshot.signals.map((signal) => signal.kind)).toEqual(['progress', 'fatigue']);
  });
});

describe('CoachEvidenceSnapshotSchema — malformed snapshots rejected', () => {
  it('rejects an unknown trend', () => {
    const result = CoachEvidenceSnapshotSchema.safeParse({
      exerciseId: { exerciseType: 'squat', variation: 'high-bar' },
      trend: 'sideways',
      signals: [],
      policyLimits: {},
      windowConfidence: 'medium',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a signal with an unknown kind', () => {
    const result = CoachEvidenceSnapshotSchema.safeParse({
      exerciseId: { exerciseType: 'squat', variation: 'high-bar' },
      trend: 'stable',
      signals: [{ kind: 'overreach', windowSize: 3 }],
      policyLimits: {},
      windowConfidence: 'medium',
    });

    expect(result.success).toBe(false);
  });
});
