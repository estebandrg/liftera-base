import { describe, it, expect } from 'vitest';
import { TrendAnalyzer } from './TrendAnalyzer.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { Session } from '../exercise/Session.js';
import { LoggedSet } from '../exercise/LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { RIR } from '../value-objects/RIR.js';
import { Trend } from '../value-objects/Trend.js';

const sessionOn = (day: number, sets: LoggedSet[]): Session =>
  new Session(sets, new Date(`2026-08-${day.toString().padStart(2, '0')}`));

const topSetOnly = (day: number, kg: number, reps: number, rir?: number): Session =>
  sessionOn(day, [
    new LoggedSet(new Load(kg, 'kg'), new Reps(reps), rir !== undefined ? new RIR(rir) : undefined),
  ]);

describe('TrendAnalyzer — progress', () => {
  const analyzer = new TrendAnalyzer();

  it('emits ProgressSignal when volume rises and last RIR <= 2', () => {
    const sessions = [
      topSetOnly(1, 100, 10, 3),
      topSetOnly(2, 100, 11, 2),
      topSetOnly(3, 100, 12, 2),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Improving);
    expect(analysis.signals).toHaveLength(1);
    const signal = analysis.signals[0];
    expect(signal).toBeInstanceOf(ProgressSignal);
    const progress = signal as ProgressSignal;
    expect(progress.evidence.volumeChangePct).toBeCloseTo(20, 5);
    expect(progress.evidence.lastEffectiveRir).toBe(2);
    expect(progress.evidence.rirInAllSessions).toBe(true);
    expect(progress.evidence.topSetReps).toBe(12);
    expect(progress.evidence.loadUnit).toBe('kg');
    expect(progress.evidence.windowSize).toBe(3);
  });

  it('emits ProgressSignal from volume and reps only when RIR is absent in the window', () => {
    const sessions = [topSetOnly(1, 100, 10), topSetOnly(2, 100, 11), topSetOnly(3, 100, 12)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Improving);
    expect(analysis.signals).toHaveLength(1);
    const progress = analysis.signals[0] as ProgressSignal;
    expect(progress).toBeInstanceOf(ProgressSignal);
    expect(progress.evidence.lastEffectiveRir).toBe('unknown');
    expect(progress.evidence.rirInAllSessions).toBe(false);
  });

  it('emits no signal when volume rises but effort is moderate (RIR 3)', () => {
    const sessions = [
      topSetOnly(1, 100, 10, 3),
      topSetOnly(2, 100, 11, 3),
      topSetOnly(3, 100, 12, 3),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Improving);
    expect(analysis.signals).toHaveLength(0);
  });

  it('returns a stable trend with no signals for a single session', () => {
    const analysis = analyzer.analyze([topSetOnly(1, 100, 10, 2)]);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals).toHaveLength(0);
  });
});

describe('TrendAnalyzer — stagnation', () => {
  const analyzer = new TrendAnalyzer();

  it('emits StagnationSignal when load, reps, and volume are flat across the window', () => {
    const sessions = [topSetOnly(1, 100, 8, 2), topSetOnly(2, 100, 8, 3), topSetOnly(3, 100, 8, 2)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals).toHaveLength(1);
    const signal = analysis.signals[0];
    expect(signal).toBeInstanceOf(StagnationSignal);
    const stagnation = signal as StagnationSignal;
    expect(stagnation.evidence.windowSize).toBe(3);
    expect(stagnation.evidence.topSetReps).toBe(8);
    expect(stagnation.evidence.loadUnit).toBe('kg');
  });

  it('tolerates a +/-1 rep drift within the flat band', () => {
    const sessions = [topSetOnly(1, 100, 8), topSetOnly(2, 100, 9), topSetOnly(3, 100, 8)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals[0]).toBeInstanceOf(StagnationSignal);
  });

  it('treats volume at exactly +2.5% as still flat', () => {
    // 1000 -> 1025 is exactly the flat tolerance boundary.
    const sessions = [
      topSetOnly(1, 100, 10),
      sessionOn(2, [
        new LoggedSet(new Load(100, 'kg'), new Reps(10)),
        new LoggedSet(new Load(12.5, 'kg'), new Reps(1)),
      ]),
      sessionOn(3, [
        new LoggedSet(new Load(100, 'kg'), new Reps(10)),
        new LoggedSet(new Load(25, 'kg'), new Reps(1)),
      ]),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals[0]).toBeInstanceOf(StagnationSignal);
  });

  it('does not emit StagnationSignal when load moved across the window', () => {
    const sessions = [topSetOnly(1, 100, 8), topSetOnly(2, 102.5, 8), topSetOnly(3, 100, 8)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals).toHaveLength(0);
  });

  it('does not emit StagnationSignal when reps drifted more than 1', () => {
    // Total volume stays at 1000 in every session while top-set reps move 8 -> 10.
    const sessions = [
      sessionOn(1, [
        new LoggedSet(new Load(100, 'kg'), new Reps(8)),
        new LoggedSet(new Load(50, 'kg'), new Reps(4)),
      ]),
      sessionOn(2, [
        new LoggedSet(new Load(100, 'kg'), new Reps(9)),
        new LoggedSet(new Load(50, 'kg'), new Reps(2)),
      ]),
      sessionOn(3, [new LoggedSet(new Load(100, 'kg'), new Reps(10))]),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Stable);
    expect(analysis.signals).toHaveLength(0);
  });
});

describe('TrendAnalyzer — fatigue', () => {
  const analyzer = new TrendAnalyzer();

  it('emits FatigueSignal when volume declines and last RIR >= 4', () => {
    const sessions = [
      topSetOnly(1, 100, 10, 2),
      topSetOnly(2, 100, 9, 3),
      topSetOnly(3, 100, 8, 4),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Declining);
    expect(analysis.signals).toHaveLength(1);
    const signal = analysis.signals[0];
    expect(signal).toBeInstanceOf(FatigueSignal);
    const fatigue = signal as FatigueSignal;
    expect(fatigue.evidence.volumeChangePct).toBeCloseTo(-20, 5);
    expect(fatigue.evidence.lastEffectiveRir).toBe(4);
    expect(fatigue.evidence.windowSize).toBe(3);
  });

  it('uses the mean-RIR fallback for the fatigue threshold when the top set lacks RIR', () => {
    const sessions = [
      topSetOnly(1, 100, 10, 2),
      topSetOnly(2, 100, 9, 3),
      sessionOn(3, [
        new LoggedSet(new Load(100, 'kg'), new Reps(8)),
        new LoggedSet(new Load(10, 'kg'), new Reps(1), new RIR(4)),
        new LoggedSet(new Load(10, 'kg'), new Reps(1), new RIR(6)),
      ]),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Declining);
    expect(analysis.signals[0]).toBeInstanceOf(FatigueSignal);
    expect((analysis.signals[0] as FatigueSignal).evidence.lastEffectiveRir).toBe(5);
  });
});

describe('TrendAnalyzer — regression', () => {
  const analyzer = new TrendAnalyzer();

  it('emits RegressionSignal when volume declines and RIR is unknown', () => {
    const sessions = [topSetOnly(1, 100, 10), topSetOnly(2, 100, 9), topSetOnly(3, 100, 8)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Declining);
    expect(analysis.signals).toHaveLength(1);
    const signal = analysis.signals[0];
    expect(signal).toBeInstanceOf(RegressionSignal);
    const regression = signal as RegressionSignal;
    expect(regression.evidence.lastEffectiveRir).toBe('unknown');
    expect(regression.evidence.volumeChangePct).toBeCloseTo(-20, 5);
    expect(regression.evidence.windowSize).toBe(3);
  });

  it('emits RegressionSignal when volume declines and last RIR is low (< 4)', () => {
    const sessions = [
      topSetOnly(1, 100, 10, 1),
      topSetOnly(2, 100, 9, 2),
      topSetOnly(3, 100, 8, 2),
    ];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.trend).toBe(Trend.Declining);
    expect(analysis.signals).toHaveLength(1);
    expect(analysis.signals[0]).toBeInstanceOf(RegressionSignal);
    expect((analysis.signals[0] as RegressionSignal).evidence.lastEffectiveRir).toBe(2);
  });

  it('never emits FatigueSignal without effort evidence', () => {
    const sessions = [topSetOnly(1, 100, 10), topSetOnly(2, 100, 9), topSetOnly(3, 100, 8)];

    const analysis = analyzer.analyze(sessions);

    expect(analysis.signals.some((s) => s instanceof FatigueSignal)).toBe(false);
  });
});
