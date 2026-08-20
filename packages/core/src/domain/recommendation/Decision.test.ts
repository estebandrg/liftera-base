import { describe, it, expect } from 'vitest';
import { Decision } from './Decision.js';
import { Confidence } from '../value-objects/Confidence.js';

describe('Decision', () => {
  it('carries action, magnitude, confidence, and basis', () => {
    const decision = new Decision(
      'increaseLoad',
      { kind: 'load', value: 2.5, unit: 'kg' },
      Confidence.High,
      { signal: 'progress', trend: 'improving', windowSize: 3 },
    );

    expect(decision.action).toBe('increaseLoad');
    expect(decision.magnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
    expect(decision.confidence).toBe(Confidence.High);
    expect(decision.basis.signal).toBe('progress');
  });

  it('supports a percent-based load magnitude for fatigue reduction', () => {
    const decision = new Decision(
      'decreaseLoad',
      { kind: 'loadPercent', percent: -10 },
      Confidence.Medium,
      { signal: 'fatigue', trend: 'declining', windowSize: 3 },
    );

    expect(decision.magnitude).toEqual({ kind: 'loadPercent', percent: -10 });
  });

  it('supports set, rep, and empty magnitudes', () => {
    const bySets = new Decision('decreaseVolume', { kind: 'sets', value: -1 }, Confidence.Medium, {
      signal: 'fatigue',
      trend: 'stable',
      windowSize: 3,
    });
    const byReps = new Decision('increaseReps', { kind: 'reps', value: 1 }, Confidence.Medium, {
      signal: 'stagnation',
      trend: 'stable',
      windowSize: 3,
    });
    const none = new Decision('evaluateChange', { kind: 'none' }, Confidence.Low, {
      signal: 'contradiction',
      trend: 'improving',
      windowSize: 3,
    });

    expect(bySets.magnitude).toEqual({ kind: 'sets', value: -1 });
    expect(byReps.magnitude).toEqual({ kind: 'reps', value: 1 });
    expect(none.magnitude).toEqual({ kind: 'none' });
  });
});
