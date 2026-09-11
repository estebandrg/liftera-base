import { Trend } from '../value-objects/Trend.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { SessionPerformance } from './SessionInterpreter.js';

/**
 * Classifies a SessionPerformance window into a Trend.
 * Pure and stateless.
 */
export class TrendAnalyzer {
  classifyTrend(performances: SessionPerformance[]): Trend {
    if (performances.length < 2) {
      return Trend.Stable;
    }
    const first = performances[0];
    const last = performances[performances.length - 1];
    const volumeChangePct = ((last.volume.value - first.volume.value) / first.volume.value) * 100;
    return this.classifyTrendFromPct(volumeChangePct);
  }

  private classifyTrendFromPct(volumeChangePct: number): Trend {
    if (volumeChangePct > ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      return Trend.Improving;
    }
    if (volumeChangePct < -ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT) {
      return Trend.Declining;
    }
    return Trend.Stable;
  }
}
