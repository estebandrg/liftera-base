import { Trend } from '../value-objects/Trend.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { SessionPerformance } from './SessionInterpreter.js';

/**
 * Detects performance signals from interpreted session facts and a
 * pre-computed trend. Stateless: branching is driven by the passed Trend.
 */
export class SignalDetector {
  detect(performances: SessionPerformance[], trend: Trend): PerformanceSignal[] {
    if (performances.length < 2) {
      return [];
    }

    const first = performances[0];
    const last = performances[performances.length - 1];
    const volumeChangePct = ((last.volume.value - first.volume.value) / first.volume.value) * 100;
    const rirInAllSessions = performances.every((p) => p.effectiveRir !== 'unknown');
    const signals: PerformanceSignal[] = [];

    if (trend === Trend.Improving) {
      const lastRir = last.effectiveRir;
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
    } else if (trend === Trend.Declining) {
      const lastRir = last.effectiveRir;
      if (lastRir !== 'unknown' && lastRir >= ProgressionPolicy.FATIGUE_RIR_MIN) {
        signals.push(
          new FatigueSignal({
            windowSize: performances.length,
            volumeChangePct,
            lastEffectiveRir: lastRir,
          }),
        );
      } else {
        signals.push(
          new RegressionSignal({
            windowSize: performances.length,
            volumeChangePct,
            lastEffectiveRir: lastRir,
          }),
        );
      }
    } else if (trend === Trend.Stable) {
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

    return signals;
  }

  /**
   * Flat means: identical top-set load across the window and a top-set
   * reps drift within the policy tolerance. Volume flatness is already
   * guaranteed by the caller's branch (Trend.Stable).
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
}
