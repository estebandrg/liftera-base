import { describe, it, expect } from 'vitest';
import { ActionableRecommendation, Recommendation } from './Recommendation.js';
import { Confidence } from '../value-objects/Confidence.js';

describe('Recommendation', () => {
  it('actionable variant carries action, magnitude, confidence, and reason', () => {
    const recommendation: ActionableRecommendation = {
      status: 'ok',
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      confidence: Confidence.High,
      reason: 'Increase load by 2.5 kg.',
    };

    expect(recommendation.status).toBe('ok');
    expect(recommendation.action).toBe('increaseLoad');
    expect(recommendation.confidence).toBe(Confidence.High);
    expect(recommendation.reason.length).toBeGreaterThan(0);
  });

  it('insufficient_data is a result variant, never an exception', () => {
    const build = (): Recommendation => ({
      status: 'insufficient_data',
      confidence: Confidence.Insufficient,
      reason: 'Log at least 2 sessions to get a recommendation.',
    });

    expect(build).not.toThrow();
    const recommendation = build();
    expect(recommendation.status).toBe('insufficient_data');
    expect(recommendation.confidence).toBe(Confidence.Insufficient);
  });

  it('narrows the union by status discriminant', () => {
    const insufficient: Recommendation = {
      status: 'insufficient_data',
      confidence: Confidence.Insufficient,
      reason: 'Not enough data.',
    };

    if (insufficient.status === 'ok') {
      throw new Error('should not narrow to actionable');
    }
    expect(insufficient.status).toBe('insufficient_data');
  });
});
