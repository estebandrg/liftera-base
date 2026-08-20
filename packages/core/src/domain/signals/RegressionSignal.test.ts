import { describe, it, expect } from 'vitest';
import { PerformanceSignal } from './PerformanceSignal.js';
import { RegressionSignal } from './RegressionSignal.js';

describe('RegressionSignal', () => {
  const evidence = {
    windowSize: 3,
    volumeChangePct: -9,
    lastEffectiveRir: 'unknown' as number | 'unknown',
  };

  it('is a PerformanceSignal with kind regression', () => {
    const signal = new RegressionSignal(evidence);
    expect(signal).toBeInstanceOf(PerformanceSignal);
    expect(signal.kind).toBe('regression');
  });

  it('carries its detection evidence', () => {
    const signal = new RegressionSignal(evidence);
    expect(signal.evidence).toEqual(evidence);
  });

  it('accepts a low numeric RIR as evidence', () => {
    const signal = new RegressionSignal({ ...evidence, lastEffectiveRir: 2 });
    expect(signal.evidence.lastEffectiveRir).toBe(2);
  });
});
