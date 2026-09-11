import { describe, it, expect } from 'vitest';
import { TrendAnalyzer } from './TrendAnalyzer.js';
import { SessionPerformance } from './SessionInterpreter.js';
import { LoggedSet } from '../exercise/LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { Volume } from '../value-objects/Volume.js';
import { Trend } from '../value-objects/Trend.js';

const perf = (kg: number, reps: number): SessionPerformance => {
  const set = new LoggedSet(new Load(kg, 'kg'), new Reps(reps));
  return new SessionPerformance(set, new Volume(kg * reps), 'unknown');
};

describe('TrendAnalyzer — classifyTrend', () => {
  const analyzer = new TrendAnalyzer();

  it('classifies improving when last volume > first volume by > 2.5%', () => {
    const performances = [perf(100, 10), perf(100, 11), perf(100, 12)];
    expect(analyzer.classifyTrend(performances)).toBe(Trend.Improving);
  });

  it('classifies declining when last volume < first volume by > 2.5%', () => {
    const performances = [perf(100, 10), perf(100, 9), perf(100, 8)];
    expect(analyzer.classifyTrend(performances)).toBe(Trend.Declining);
  });

  it('classifies stable when |volume change| <= 2.5%', () => {
    const performances = [perf(100, 10), perf(100, 10), perf(100, 10)];
    expect(analyzer.classifyTrend(performances)).toBe(Trend.Stable);
  });

  it('treats volume at exactly +2.5% as stable (boundary)', () => {
    // 1000 -> 1025 is exactly the flat tolerance boundary.
    const performances = [
      new SessionPerformance(
        new LoggedSet(new Load(100, 'kg'), new Reps(10)),
        new Volume(1000),
        'unknown',
      ),
      new SessionPerformance(
        new LoggedSet(new Load(100, 'kg'), new Reps(10)),
        new Volume(1025),
        'unknown',
      ),
    ];
    expect(analyzer.classifyTrend(performances)).toBe(Trend.Stable);
  });

  it('returns stable for a single session (insufficient data)', () => {
    expect(analyzer.classifyTrend([perf(100, 10)])).toBe(Trend.Stable);
    expect(analyzer.classifyTrend([])).toBe(Trend.Stable);
  });
});
