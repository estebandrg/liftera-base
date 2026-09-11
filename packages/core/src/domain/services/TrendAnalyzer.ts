import { Session } from '../exercise/Session.js';
import { Trend } from '../value-objects/Trend.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { SessionInterpreter, SessionPerformance } from './SessionInterpreter.js';
import { SignalDetector } from './SignalDetector.js';

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
  private readonly signalDetector = new SignalDetector();

  analyze(sessions: Session[]): TrendAnalysis {
    const performances = this.interpreter.interpret(sessions);
    if (performances.length < 2) {
      return { trend: Trend.Stable, signals: [] };
    }

    const trend = this.classifyTrend(performances);
    const signals = this.signalDetector.detect(performances, trend);

    return { trend, signals };
  }

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
