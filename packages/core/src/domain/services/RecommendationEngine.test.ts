import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from './RecommendationEngine.js';
import { Decision } from '../recommendation/Decision.js';
import { Confidence } from '../value-objects/Confidence.js';

describe('RecommendationEngine', () => {
  const engine = new RecommendationEngine();

  it('translates increaseLoad with its magnitude and an explanation', () => {
    const decision = new Decision(
      'increaseLoad',
      { kind: 'load', value: 2.5, unit: 'kg' },
      Confidence.High,
      {
        signal: 'progress',
        trend: 'improving',
        windowSize: 3,
        volumeChangePct: 8,
        lastEffectiveRir: 2,
      },
    );

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('increaseLoad');
    expect(recommendation.magnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
    expect(recommendation.confidence).toBe(Confidence.High);
    expect(recommendation.reason).toContain('Increase load by 2.5 kg');
    expect(recommendation.reason).toContain('2 reps in reserve');
  });

  it('translates increaseReps', () => {
    const decision = new Decision('increaseReps', { kind: 'reps', value: 1 }, Confidence.Medium, {
      signal: 'stagnation',
      trend: 'stable',
      windowSize: 3,
      volumeChangePct: 0.5,
    });

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('increaseReps');
    expect(recommendation.reason).toContain('Add 1 rep');
    expect(recommendation.reason).toContain('flat');
  });

  it('translates decreaseLoad as a percent reduction with fatigue context', () => {
    const decision = new Decision(
      'decreaseLoad',
      { kind: 'loadPercent', percent: -10 },
      Confidence.Medium,
      {
        signal: 'fatigue',
        trend: 'declining',
        windowSize: 3,
        volumeChangePct: -12,
        lastEffectiveRir: 5,
      },
    );

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('decreaseLoad');
    expect(recommendation.reason).toContain('Reduce load by 10%');
    expect(recommendation.reason).toContain('RIR 5');
  });

  it('translates decreaseVolume as dropping one set', () => {
    const decision = new Decision(
      'decreaseVolume',
      { kind: 'sets', value: -1 },
      Confidence.Medium,
      {
        signal: 'fatigue',
        trend: 'stable',
        windowSize: 3,
        volumeChangePct: -8,
        lastEffectiveRir: 4,
      },
    );

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('decreaseVolume');
    expect(recommendation.reason).toContain('Remove 1 set');
  });

  it('translates evaluateChange with the contradiction explanation', () => {
    const decision = new Decision('evaluateChange', { kind: 'none' }, Confidence.Low, {
      signal: 'contradiction',
      trend: 'declining',
      windowSize: 3,
    });

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('evaluateChange');
    expect(recommendation.magnitude).toEqual({ kind: 'none' });
    expect(recommendation.confidence).toBe(Confidence.Low);
    expect(recommendation.reason).toContain('conflict');
  });

  it('translates maintain', () => {
    const decision = new Decision('maintain', { kind: 'none' }, Confidence.Low, {
      signal: 'none',
      trend: 'improving',
      windowSize: 0,
    });

    const recommendation = engine.translate(decision);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.action).toBe('maintain');
    expect(recommendation.reason).toContain('Keep the current plan');
  });

  it('explains regression without effort data honestly', () => {
    const decision = new Decision(
      'decreaseLoad',
      { kind: 'loadPercent', percent: -10 },
      Confidence.Medium,
      {
        signal: 'regression',
        trend: 'declining',
        windowSize: 3,
        volumeChangePct: -9,
        lastEffectiveRir: 'unknown',
      },
    );

    const recommendation = engine.translate(decision);

    if (recommendation.status !== 'ok') throw new Error('unreachable');
    expect(recommendation.reason).toContain('Reduce load by 10%');
    expect(recommendation.reason).toContain('no effort data');
  });
});
