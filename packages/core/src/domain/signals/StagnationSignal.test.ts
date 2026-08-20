import { describe, it, expect } from 'vitest';
import { PerformanceSignal } from './PerformanceSignal.js';
import { StagnationSignal } from './StagnationSignal.js';

describe('StagnationSignal', () => {
  const evidence = {
    windowSize: 3,
    volumeChangePct: 0.4,
    topSetReps: 8,
    loadUnit: 'kg' as const,
  };

  it('is a PerformanceSignal with kind stagnation', () => {
    const signal = new StagnationSignal(evidence);
    expect(signal).toBeInstanceOf(PerformanceSignal);
    expect(signal.kind).toBe('stagnation');
  });

  it('carries its detection evidence', () => {
    const signal = new StagnationSignal(evidence);
    expect(signal.evidence).toEqual(evidence);
  });
});
