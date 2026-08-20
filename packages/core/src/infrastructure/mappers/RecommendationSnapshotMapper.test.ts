import { describe, it, expect } from 'vitest';
import { RecommendationSnapshotMapper } from './RecommendationSnapshotMapper.js';
import { ActionableRecommendation } from '../../domain/recommendation/Recommendation.js';
import { InsufficientData } from '../../domain/recommendation/Recommendation.js';

const mapper = new RecommendationSnapshotMapper();

const actionable = (
  overrides: Partial<ActionableRecommendation> &
    Pick<ActionableRecommendation, 'action' | 'magnitude'>,
): ActionableRecommendation => ({
  status: 'ok',
  confidence: 'medium',
  reason: 'Some reason.',
  ...overrides,
});

describe('RecommendationSnapshotMapper.toSnapshot — actionable recommendations', () => {
  it('maps a load magnitude to value plus unit', () => {
    const snapshot = mapper.toSnapshot(
      actionable({
        action: 'increaseLoad',
        magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
        confidence: 'high',
        reason: 'Increase load by 2.5 kg. Volume rose 20% across the window.',
      }),
    );

    expect(snapshot).toEqual({
      status: 'ok',
      action: 'increaseLoad',
      magnitude: 2.5,
      unit: 'kg',
      reason: 'Increase load by 2.5 kg. Volume rose 20% across the window.',
      confidence: 'high',
    });
  });

  it('keeps the signed percent for loadPercent magnitudes, without a unit', () => {
    const snapshot = mapper.toSnapshot(
      actionable({
        action: 'decreaseLoad',
        magnitude: { kind: 'loadPercent', percent: -10 },
        reason: 'Reduce load by 10%.',
      }),
    );

    expect(snapshot.status).toBe('ok');
    expect(snapshot.action).toBe('decreaseLoad');
    expect(snapshot.magnitude).toBe(-10);
    expect(snapshot.unit).toBeUndefined();
  });

  it('maps a reps magnitude without a unit', () => {
    const snapshot = mapper.toSnapshot(
      actionable({ action: 'increaseReps', magnitude: { kind: 'reps', value: 1 } }),
    );

    expect(snapshot.magnitude).toBe(1);
    expect(snapshot.unit).toBeUndefined();
  });

  it('maps a sets magnitude without a unit', () => {
    const snapshot = mapper.toSnapshot(
      actionable({ action: 'decreaseVolume', magnitude: { kind: 'sets', value: -1 } }),
    );

    expect(snapshot.magnitude).toBe(-1);
    expect(snapshot.unit).toBeUndefined();
  });

  it('omits magnitude and unit when the decision carries no magnitude', () => {
    const snapshot = mapper.toSnapshot(
      actionable({ action: 'maintain', magnitude: { kind: 'none' }, confidence: 'low' }),
    );

    expect(snapshot.action).toBe('maintain');
    expect(snapshot.magnitude).toBeUndefined();
    expect(snapshot.unit).toBeUndefined();
  });

  it('never leaks pipeline internals like windowSize into the snapshot', () => {
    const snapshot = mapper.toSnapshot(
      actionable({ action: 'maintain', magnitude: { kind: 'none' } }),
    );

    expect('windowSize' in snapshot).toBe(false);
    expect('basis' in snapshot).toBe(false);
  });
});

describe('RecommendationSnapshotMapper.toSnapshot — insufficient data', () => {
  it('maps the variant without action, magnitude, or unit', () => {
    const insufficient: InsufficientData = {
      status: 'insufficient_data',
      confidence: 'insufficient',
      reason: 'Need at least 2 logged sessions to recommend; got 1.',
    };

    const snapshot = mapper.toSnapshot(insufficient);

    expect(snapshot).toEqual({
      status: 'insufficient_data',
      reason: 'Need at least 2 logged sessions to recommend; got 1.',
      confidence: 'insufficient',
    });
  });
});
