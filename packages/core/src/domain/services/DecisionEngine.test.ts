import { describe, it, expect } from 'vitest';
import { DecisionEngine } from './DecisionEngine.js';
import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal, ProgressEvidence } from '../signals/ProgressSignal.js';
import { StagnationSignal, StagnationEvidence } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';

const fatigue = (windowSize = 3): FatigueSignal =>
  new FatigueSignal({ windowSize, volumeChangePct: -12, lastEffectiveRir: 5 });

const regression = (windowSize = 3): RegressionSignal =>
  new RegressionSignal({ windowSize, volumeChangePct: -9, lastEffectiveRir: 'unknown' });

const progress = (overrides: Partial<ProgressEvidence> = {}): ProgressSignal =>
  new ProgressSignal({
    windowSize: 3,
    volumeChangePct: 8,
    lastEffectiveRir: 2,
    rirInAllSessions: true,
    topSetReps: 12,
    loadUnit: 'kg',
    ...overrides,
  });

const stagnation = (overrides: Partial<StagnationEvidence> = {}): StagnationSignal =>
  new StagnationSignal({
    windowSize: 3,
    volumeChangePct: 0.5,
    topSetReps: 8,
    loadUnit: 'kg',
    ...overrides,
  });

describe('DecisionEngine — decision table (priority top-down, first match wins)', () => {
  const engine = new DecisionEngine();

  const rows: {
    row: string;
    signals: PerformanceSignal[];
    trend: Trend;
    action: DecisionAction;
    magnitude: DecisionMagnitude;
    confidence: Confidence;
  }[] = [
    {
      row: '1 — FatigueSignal + declining → decreaseLoad -10%',
      signals: [fatigue()],
      trend: Trend.Declining,
      action: 'decreaseLoad',
      magnitude: { kind: 'loadPercent', percent: -10 },
      confidence: Confidence.Medium,
    },
    {
      row: '2 — FatigueSignal + stable → decreaseVolume -1 set, capped medium',
      signals: [fatigue()],
      trend: Trend.Stable,
      action: 'decreaseVolume',
      magnitude: { kind: 'sets', value: -1 },
      confidence: Confidence.Medium,
    },
    {
      row: '2 — FatigueSignal + improving → decreaseVolume -1 set, capped medium',
      signals: [fatigue()],
      trend: Trend.Improving,
      action: 'decreaseVolume',
      magnitude: { kind: 'sets', value: -1 },
      confidence: Confidence.Medium,
    },
    {
      row: '3 — RegressionSignal + declining → decreaseLoad -10%, capped medium',
      signals: [regression()],
      trend: Trend.Declining,
      action: 'decreaseLoad',
      magnitude: { kind: 'loadPercent', percent: -10 },
      confidence: Confidence.Medium,
    },
    {
      row: '5 — ProgressSignal + improving + reps at range top → increaseLoad, high with full RIR',
      signals: [progress()],
      trend: Trend.Improving,
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      confidence: Confidence.High,
    },
    {
      row: '5 — ProgressSignal + improving + reps below range top → increaseReps +1',
      signals: [progress({ topSetReps: 10 })],
      trend: Trend.Improving,
      action: 'increaseReps',
      magnitude: { kind: 'reps', value: 1 },
      confidence: Confidence.High,
    },
    {
      row: '5 — increaseLoad uses the 5 lb increment for lb loads',
      signals: [progress({ loadUnit: 'lb' })],
      trend: Trend.Improving,
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 5, unit: 'lb' },
      confidence: Confidence.High,
    },
    {
      row: '5/7 — ProgressSignal without full RIR is capped at medium',
      signals: [progress({ rirInAllSessions: false })],
      trend: Trend.Improving,
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      confidence: Confidence.Medium,
    },
    {
      row: '7 — RIR absent in whole window: classify from volume+reps, capped medium',
      signals: [progress({ lastEffectiveRir: 'unknown', rirInAllSessions: false, topSetReps: 10 })],
      trend: Trend.Improving,
      action: 'increaseReps',
      magnitude: { kind: 'reps', value: 1 },
      confidence: Confidence.Medium,
    },
    {
      row: '6 — StagnationSignal + stable + reps below range top → increaseReps +1, capped medium',
      signals: [stagnation()],
      trend: Trend.Stable,
      action: 'increaseReps',
      magnitude: { kind: 'reps', value: 1 },
      confidence: Confidence.Medium,
    },
    {
      row: '6 — StagnationSignal + stable + reps at range top → increaseLoad, capped medium',
      signals: [stagnation({ topSetReps: 12 })],
      trend: Trend.Stable,
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      confidence: Confidence.Medium,
    },
  ];

  it.each(rows)('$row', ({ signals, trend, action, magnitude, confidence }) => {
    const decision = engine.recommend(signals, trend);

    expect(decision.action).toBe(action);
    expect(decision.magnitude).toEqual(magnitude);
    expect(decision.confidence).toBe(confidence);
  });

  it('scales confidence with the window size: 2 sessions cap to low', () => {
    const decision = engine.recommend([fatigue(2)], Trend.Declining);

    expect(decision.action).toBe('decreaseLoad');
    expect(decision.confidence).toBe(Confidence.Low);
  });

  it('falls back to maintain with low confidence when no signal fires', () => {
    const decision = engine.recommend([], Trend.Improving);

    expect(decision.action).toBe('maintain');
    expect(decision.magnitude).toEqual({ kind: 'none' });
    expect(decision.confidence).toBe(Confidence.Low);
    expect(decision.basis.signal).toBe('none');
  });

  it('records the triggering signal and trend in the decision basis', () => {
    const decision = engine.recommend([fatigue()], Trend.Declining);

    expect(decision.basis.signal).toBe('fatigue');
    expect(decision.basis.trend).toBe(Trend.Declining);
    expect(decision.basis.volumeChangePct).toBe(-12);
    expect(decision.basis.lastEffectiveRir).toBe(5);
  });
});

describe('DecisionEngine — contradictory signals', () => {
  const engine = new DecisionEngine();

  it.each([Trend.Improving, Trend.Stable, Trend.Declining])(
    'Progress + Fatigue with trend %s → evaluateChange with low confidence',
    (trend) => {
      const decision = engine.recommend([progress(), fatigue()], trend);

      expect(decision.action).toBe('evaluateChange');
      expect(decision.magnitude).toEqual({ kind: 'none' });
      expect(decision.confidence).toBe(Confidence.Low);
      expect(decision.basis.signal).toBe('contradiction');
    },
  );

  it('Progress + Regression → evaluateChange with low confidence', () => {
    const decision = engine.recommend([progress(), regression()], Trend.Declining);

    expect(decision.action).toBe('evaluateChange');
    expect(decision.confidence).toBe(Confidence.Low);
  });

  it('contradiction overrides row priority even when a fatigue row would match', () => {
    // Without contradiction handling, Fatigue + declining would win as row 1.
    const decision = engine.recommend([progress(), fatigue()], Trend.Declining);

    expect(decision.action).not.toBe('decreaseLoad');
    expect(decision.action).toBe('evaluateChange');
  });
});
