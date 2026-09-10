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
    action:
      | 'increaseLoad'
      | 'decreaseLoad'
      | 'increaseReps'
      | 'decreaseVolume'
      | 'maintain'
      | 'evaluateChange';
    signals: PerformanceSignal[];
    trend: Trend;
    expected: DecisionMagnitude;
  }[] = [
    // increaseLoad
    {
      name: 'progress + improving + top reps (kg) → full load increment',
      action: 'increaseLoad',
      signals: [progress()],
      trend: Trend.Improving,
      expected: { kind: 'load', value: 2.5, unit: 'kg' },
    },
    {
      name: 'progress + stable + top reps (kg) → half load increment',
      action: 'increaseLoad',
      signals: [progress()],
      trend: Trend.Stable,
      expected: { kind: 'load', value: 1.25, unit: 'kg' },
    },
    {
      name: 'increaseLoad + declining → none',
      action: 'increaseLoad',
      signals: [progress()],
      trend: Trend.Declining,
      expected: { kind: 'none' },
    },
    {
      name: 'increaseLoad + no evidence → none',
      action: 'increaseLoad',
      signals: [],
      trend: Trend.Improving,
      expected: { kind: 'none' },
    },

    // increaseReps
    {
      name: 'stagnation + improving + low reps → full rep increment',
      action: 'increaseReps',
      signals: [stagnation()],
      trend: Trend.Improving,
      expected: { kind: 'reps', value: 1 },
    },
    {
      name: 'stagnation + stable + low reps → none',
      action: 'increaseReps',
      signals: [stagnation()],
      trend: Trend.Stable,
      expected: { kind: 'none' },
    },
    {
      name: 'increaseReps + declining → none',
      action: 'increaseReps',
      signals: [stagnation()],
      trend: Trend.Declining,
      expected: { kind: 'none' },
    },

    // decreaseLoad
    {
      name: 'fatigue + declining → full load percent reduction',
      action: 'decreaseLoad',
      signals: [fatigue()],
      trend: Trend.Declining,
      expected: { kind: 'loadPercent', percent: -10 },
    },
    {
      name: 'fatigue + stable → half load percent reduction',
      action: 'decreaseLoad',
      signals: [fatigue()],
      trend: Trend.Stable,
      expected: { kind: 'loadPercent', percent: -5 },
    },
    {
      name: 'decreaseLoad + improving → none',
      action: 'decreaseLoad',
      signals: [fatigue()],
      trend: Trend.Improving,
      expected: { kind: 'none' },
    },

    // decreaseVolume
    {
      name: 'fatigue + declining → full volume reduction',
      action: 'decreaseVolume',
      signals: [fatigue()],
      trend: Trend.Declining,
      expected: { kind: 'sets', value: -1 },
    },
    {
      name: 'decreaseVolume + stable → none',
      action: 'decreaseVolume',
      signals: [fatigue()],
      trend: Trend.Stable,
      expected: { kind: 'none' },
    },
    {
      name: 'decreaseVolume + improving → none',
      action: 'decreaseVolume',
      signals: [fatigue()],
      trend: Trend.Improving,
      expected: { kind: 'none' },
    },

    // maintain / evaluateChange
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
