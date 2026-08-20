import { Session } from '../exercise/Session.js';
import { Trend } from '../value-objects/Trend.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { SessionInterpreter, SessionPerformance } from './SessionInterpreter.js';

export interface TrendAnalysis {
  readonly trend: Trend;
  readonly signals: PerformanceSignal[];
}

/**
 * Classifies the window trend and detects performance signals.
 * Pure and stateless: all facts come from SessionInterpreter.
 */
export class TrendAnalyzer {
  private readonly interpreter = new SessionInterpreter();

  analyze(sessions: Session[]): TrendAnalysis {
    const performances = this.interpreter.interpret(sessions);
    if (performances.length < 2) {
      return { trend: Trend.Stable, signals: [] };
    }

    const first = performances[0];
    const last = performances[performances.length - 1];
    const volumeChangePct = ((last.volume.value - first.volume.value) / first.volume.value) * 100;
    const trend = this.classifyTrend(volumeChangePct);
    const rirInAllSessions = performances.every((p) => p.effectiveRir !== 'unknown');

    const signals: PerformanceSignal[] = [];

    if (volumeChangePct > ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      const lastRir = last.effectiveRir;
      // With RIR: progress requires high effort (RIR <= 2).
      // Without RIR anywhere: volume/reps deltas drive classification (design row 7).
      if (lastRir === 'unknown' || lastRir <= ProgressionPolicy.PROGRESS_RIR_MAX) {
        signals.push(
          new ProgressSignal({
            windowSize: performances.length,
            volumeChangePct,
            lastEffectiveRir: lastRir,
            rirInAllSessions,
            topSetReps: last.topSet.reps.value,
            loadUnit: last.topSet.load.unit,
          }),
        );
      }
    } else if (volumeChangePct < -ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      const lastRir = last.effectiveRir;
      // Fatigue requires effort evidence: a decline with high RIR.
      if (lastRir !== 'unknown' && lastRir >= ProgressionPolicy.FATIGUE_RIR_MIN) {
        signals.push(
          new FatigueSignal({
            windowSize: performances.length,
            volumeChangePct,
            lastEffectiveRir: lastRir,
          }),
        );
      } else {
        // Decline with low or unknown effort is regression, never fatigue.
        signals.push(
          new RegressionSignal({
            windowSize: performances.length,
            volumeChangePct,
            lastEffectiveRir: lastRir,
          }),
        );
      }
    } else if (Math.abs(volumeChangePct) <= ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      if (this.isWindowFlat(performances)) {
        signals.push(
          new StagnationSignal({
            windowSize: performances.length,
            volumeChangePct,
            topSetReps: last.topSet.reps.value,
            loadUnit: last.topSet.load.unit,
          }),
        );
      }
    }

    return { trend, signals };
  }

  /**
   * Flat means: identical top-set load across the window and a top-set
   * reps drift within the policy tolerance. Volume flatness is already
   * guaranteed by the caller's branch.
   */
  private isWindowFlat(performances: SessionPerformance[]): boolean {
    const firstTopSet = performances[0].topSet;
    const loadsFlat = performances.every((p) => p.topSet.load.equals(firstTopSet.load));
    if (!loadsFlat) {
      return false;
    }
    const repsValues = performances.map((p) => p.topSet.reps.value);
    const drift = Math.max(...repsValues) - Math.min(...repsValues);
    return drift <= ProgressionPolicy.REPS_FLAT_TOLERANCE;
  }

  private classifyTrend(volumeChangePct: number): Trend {
    if (volumeChangePct > ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      return Trend.Improving;
    }
    if (volumeChangePct < -ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      return Trend.Declining;
    }
    return Trend.Stable;
  }
}
