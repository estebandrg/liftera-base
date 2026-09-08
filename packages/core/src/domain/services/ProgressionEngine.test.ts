import { describe, it, expect } from 'vitest';
import { ProgressionEngine } from './ProgressionEngine.js';
import { ProgressSignal, ProgressEvidence } from '../signals/ProgressSignal.js';
import { StagnationSignal, StagnationEvidence } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { Trend } from '../value-objects/Trend.js';
import { DecisionMagnitude } from '../recommendation/Decision.js';

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

const fatigue = (windowSize = 3): FatigueSignal =>
  new FatigueSignal({ windowSize, volumeChangePct: -12, lastEffectiveRir: 5 });

describe('ProgressionEngine — magnitude computation', () => {
  const engine = new ProgressionEngine();

  const cases: {
    name: string;
    action: 'increaseLoad' | 'decreaseLoad' | 'increaseReps' | 'maintain' | 'evaluateChange';
    signals: PerformanceSignal[];
    trend: Trend;
    expected: DecisionMagnitude;
  }[] = [
    {
      name: 'progress + improving + top reps (kg) → load increment',
      action: 'increaseLoad',
      signals: [progress()],
      trend: Trend.Improving,
      expected: { kind: 'load', value: 2.5, unit: 'kg' },
    },
    {
      name: 'progress + improving + top reps (lb) → load increment',
      action: 'increaseLoad',
      signals: [progress({ loadUnit: 'lb' })],
      trend: Trend.Improving,
      expected: { kind: 'load', value: 5, unit: 'lb' },
    },
    {
      name: 'fatigue + declining → load percent reduction',
      action: 'decreaseLoad',
      signals: [fatigue()],
      trend: Trend.Declining,
      expected: { kind: 'loadPercent', percent: -10 },
    },
    {
      name: 'stagnation + stable + low reps → rep increment',
      action: 'increaseReps',
      signals: [stagnation()],
      trend: Trend.Stable,
      expected: { kind: 'reps', value: 1 },
    },
    {
      name: 'no signal → none',
      action: 'maintain',
      signals: [],
      trend: Trend.Improving,
      expected: { kind: 'none' },
    },
    {
      name: 'evaluateChange → none',
      action: 'evaluateChange',
      signals: [],
      trend: Trend.Stable,
      expected: { kind: 'none' },
    },
  ];

  it.each(cases)('$name', ({ action, signals, trend, expected }) => {
    const magnitude = engine.computeMagnitude(action, signals, trend);
    expect(magnitude).toEqual(expected);
  });
});

describe('ProgressionEngine — window constant', () => {
  it('references PROGRESSION_WINDOW_SIZE = 3', () => {
    expect(ProgressionEngine.WINDOW_SIZE).toBe(3);
  });
});
