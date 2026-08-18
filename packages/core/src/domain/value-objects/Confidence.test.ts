import { describe, it, expect } from 'vitest';
import { Confidence } from './Confidence.js';

describe('Confidence', () => {
  it('has the four expected values', () => {
    expect(Confidence.Insufficient).toBe('insufficient');
    expect(Confidence.Low).toBe('low');
    expect(Confidence.Medium).toBe('medium');
    expect(Confidence.High).toBe('high');
  });

  it('values are assignable to Confidence type', () => {
    const c: Confidence = Confidence.High;
    expect(c).toBe('high');
  });
});
