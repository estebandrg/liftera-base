import { describe, it, expect } from 'vitest';
import { Trend } from './Trend.js';

describe('Trend', () => {
  it('has the three expected values', () => {
    expect(Trend.Improving).toBe('improving');
    expect(Trend.Stable).toBe('stable');
    expect(Trend.Declining).toBe('declining');
  });

  it('values are immutable strings', () => {
    const trend: Trend = Trend.Improving;
    expect(trend).toBe('improving');
  });
});
