import { describe, it, expect } from 'vitest';
import { PerformanceSignal } from './PerformanceSignal.js';
import { ProgressSignal } from './ProgressSignal.js';

describe('ProgressSignal', () => {
  const evidence = {
    windowSize: 3,
    volumeChangePct: 6.5,
    lastEffectiveRir: 2 as number | 'unknown',
    rirInAllSessions: true,
    topSetReps: 12,
    loadUnit: 'kg' as const,
  };

  it('is a PerformanceSignal with kind progress', () => {
    const signal = new ProgressSignal(evidence);
    expect(signal).toBeInstanceOf(PerformanceSignal);
    expect(signal.kind).toBe('progress');
  });

  it('carries its detection evidence', () => {
    const signal = new ProgressSignal(evidence);
    expect(signal.evidence).toEqual(evidence);
  });

  it('accepts unknown last RIR when progress is classified from volume only', () => {
    const signal = new ProgressSignal({
      ...evidence,
      lastEffectiveRir: 'unknown',
      rirInAllSessions: false,
    });
    expect(signal.evidence.lastEffectiveRir).toBe('unknown');
  });
});
