import { describe, it, expect } from 'vitest';
import { SignalDetector } from './SignalDetector.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { SessionPerformance } from './SessionInterpreter.js';
import { LoggedSet } from '../exercise/LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { RIR } from '../value-objects/RIR.js';
import { Volume } from '../value-objects/Volume.js';
import { Trend } from '../value-objects/Trend.js';

const perf = (kg: number, reps: number, rir?: number): SessionPerformance => {
  const set = new LoggedSet(
    new Load(kg, 'kg'),
    new Reps(reps),
    rir !== undefined ? new RIR(rir) : undefined,
  );
  return new SessionPerformance(set, new Volume(kg * reps), rir !== undefined ? rir : 'unknown');
};

const detector = new SignalDetector();

describe('SignalDetector — progress', () => {
  it('emits ProgressSignal when volume rises and last RIR <= 2', () => {
    const performances = [perf(100, 10, 3), perf(100, 11, 2), perf(100, 12, 2)];

    const signals = detector.detect(performances, Trend.Improving);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as ProgressSignal;
    expect(signal).toBeInstanceOf(ProgressSignal);
    expect(signal.evidence.volumeChangePct).toBeCloseTo(20, 5);
    expect(signal.evidence.lastEffectiveRir).toBe(2);
    expect(signal.evidence.rirInAllSessions).toBe(true);
    expect(signal.evidence.topSetReps).toBe(12);
    expect(signal.evidence.loadUnit).toBe('kg');
    expect(signal.evidence.windowSize).toBe(3);
  });

  it('emits ProgressSignal from volume and reps only when RIR is absent in the window', () => {
    const performances = [perf(100, 10), perf(100, 11), perf(100, 12)];

    const signals = detector.detect(performances, Trend.Improving);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as ProgressSignal;
    expect(signal).toBeInstanceOf(ProgressSignal);
    expect(signal.evidence.lastEffectiveRir).toBe('unknown');
    expect(signal.evidence.rirInAllSessions).toBe(false);
  });

  it('emits no signal when volume rises but effort is moderate (RIR 3)', () => {
    const performances = [perf(100, 10, 3), perf(100, 11, 3), perf(100, 12, 3)];

    const signals = detector.detect(performances, Trend.Improving);

    expect(signals).toHaveLength(0);
  });
});

describe('SignalDetector — fatigue', () => {
  it('emits FatigueSignal when volume declines and last RIR >= 4', () => {
    const performances = [perf(100, 10, 2), perf(100, 9, 3), perf(100, 8, 4)];

    const signals = detector.detect(performances, Trend.Declining);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as FatigueSignal;
    expect(signal).toBeInstanceOf(FatigueSignal);
    expect(signal.evidence.volumeChangePct).toBeCloseTo(-20, 5);
    expect(signal.evidence.lastEffectiveRir).toBe(4);
    expect(signal.evidence.windowSize).toBe(3);
  });
});

describe('SignalDetector — regression', () => {
  it('emits RegressionSignal when volume declines and RIR is unknown', () => {
    const performances = [perf(100, 10), perf(100, 9), perf(100, 8)];

    const signals = detector.detect(performances, Trend.Declining);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as RegressionSignal;
    expect(signal).toBeInstanceOf(RegressionSignal);
    expect(signal.evidence.lastEffectiveRir).toBe('unknown');
    expect(signal.evidence.volumeChangePct).toBeCloseTo(-20, 5);
    expect(signal.evidence.windowSize).toBe(3);
  });

  it('emits RegressionSignal when volume declines and last RIR is low (< 4)', () => {
    const performances = [perf(100, 10, 1), perf(100, 9, 2), perf(100, 8, 2)];

    const signals = detector.detect(performances, Trend.Declining);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(RegressionSignal);
    expect((signals[0] as RegressionSignal).evidence.lastEffectiveRir).toBe(2);
  });

  it('never emits FatigueSignal without effort evidence', () => {
    const performances = [perf(100, 10), perf(100, 9), perf(100, 8)];

    const signals = detector.detect(performances, Trend.Declining);

    expect(signals.some((s) => s instanceof FatigueSignal)).toBe(false);
  });
});

describe('SignalDetector — stagnation', () => {
  it('emits StagnationSignal when load, reps, and volume are flat across the window', () => {
    const performances = [perf(100, 8, 2), perf(100, 8, 3), perf(100, 8, 2)];

    const signals = detector.detect(performances, Trend.Stable);

    expect(signals).toHaveLength(1);
    const signal = signals[0] as StagnationSignal;
    expect(signal).toBeInstanceOf(StagnationSignal);
    expect(signal.evidence.windowSize).toBe(3);
    expect(signal.evidence.topSetReps).toBe(8);
    expect(signal.evidence.loadUnit).toBe('kg');
  });

  it('tolerates a +/-1 rep drift within the flat band', () => {
    const performances = [perf(100, 8), perf(100, 9), perf(100, 8)];

    const signals = detector.detect(performances, Trend.Stable);

    expect(signals[0]).toBeInstanceOf(StagnationSignal);
  });

  it('does not emit StagnationSignal when load moved across the window', () => {
    const performances = [perf(100, 8), perf(102.5, 8), perf(100, 8)];

    const signals = detector.detect(performances, Trend.Stable);

    expect(signals).toHaveLength(0);
  });

  it('does not emit StagnationSignal when reps drifted more than 1', () => {
    // Total volume stays at 1000 in every session while top-set reps move 8 -> 10.
    const performances = [
      new SessionPerformance(
        new LoggedSet(new Load(100, 'kg'), new Reps(8)),
        new Volume(1000),
        'unknown',
      ),
      new SessionPerformance(
        new LoggedSet(new Load(100, 'kg'), new Reps(9)),
        new Volume(1000),
        'unknown',
      ),
      new SessionPerformance(
        new LoggedSet(new Load(100, 'kg'), new Reps(10)),
        new Volume(1000),
        'unknown',
      ),
    ];

    const signals = detector.detect(performances, Trend.Stable);

    expect(signals).toHaveLength(0);
  });
});

describe('SignalDetector — insufficient data', () => {
  it('returns an empty array when fewer than 2 performances are given', () => {
    expect(detector.detect([perf(100, 10)], Trend.Stable)).toEqual([]);
    expect(detector.detect([], Trend.Stable)).toEqual([]);
  });
});
