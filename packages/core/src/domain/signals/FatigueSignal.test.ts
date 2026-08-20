import { describe, it, expect } from 'vitest';
import { PerformanceSignal } from './PerformanceSignal.js';
import { FatigueSignal } from './FatigueSignal.js';

describe('FatigueSignal', () => {
  const evidence = {
    windowSize: 3,
    volumeChangePct: -11.5,
    lastEffectiveRir: 5,
  };

  it('is a PerformanceSignal with kind fatigue', () => {
    const signal = new FatigueSignal(evidence);
    expect(signal).toBeInstanceOf(PerformanceSignal);
    expect(signal.kind).toBe('fatigue');
  });

  it('carries its detection evidence', () => {
    const signal = new FatigueSignal(evidence);
    expect(signal.evidence).toEqual(evidence);
  });
});
