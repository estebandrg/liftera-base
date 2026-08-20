import {
  Decision,
  DecisionAction,
  DecisionBasis,
  DecisionMagnitude,
} from '../recommendation/Decision.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';
import { LoadUnit } from '../value-objects/Load.js';

const CONFIDENCE_RANK: Record<Confidence, number> = {
  insufficient: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Maps detected signals + trend to a Decision using the policy matrix.
 * Priority is top-down; first match wins. Pure and stateless.
 */
export class DecisionEngine {
  recommend(signals: PerformanceSignal[], trend: Trend): Decision {
    const fatigue = signals.find((s): s is FatigueSignal => s instanceof FatigueSignal);
    const regression = signals.find((s): s is RegressionSignal => s instanceof RegressionSignal);
    const progress = signals.find((s): s is ProgressSignal => s instanceof ProgressSignal);
    const stagnation = signals.find((s): s is StagnationSignal => s instanceof StagnationSignal);

    // Contradictory signals (Progress + Fatigue/Regression) override the
    // priority table — design decision: contradiction is the only honest
    // trigger for evaluateChange, never winner-takes-all.
    if (progress && (fatigue || regression)) {
      const windowSize = Math.max(progress.evidence.windowSize, 0);
      return this.decision('evaluateChange', { kind: 'none' }, Confidence.Low, {
        signal: 'contradiction',
        trend,
        windowSize,
        volumeChangePct: progress.evidence.volumeChangePct,
        lastEffectiveRir: progress.evidence.lastEffectiveRir,
      });
    }

    // Row 1: fatigue with declining trend → back off the load.
    if (fatigue && trend === Trend.Declining) {
      return this.decision(
        'decreaseLoad',
        { kind: 'loadPercent', percent: -ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT },
        this.confidence(fatigue.evidence.windowSize, Confidence.High, false, false),
        this.basis('fatigue', trend, fatigue.evidence),
      );
    }

    // Row 2: fatigue without a declining trend → trim one set instead.
    if (fatigue) {
      return this.decision(
        'decreaseVolume',
        { kind: 'sets', value: -ProgressionPolicy.VOLUME_REDUCTION_SETS },
        this.confidence(fatigue.evidence.windowSize, Confidence.Medium, false, false),
        this.basis('fatigue', trend, fatigue.evidence),
      );
    }

    // Row 3: regression with declining trend → back off the load, capped medium.
    if (regression && trend === Trend.Declining) {
      return this.decision(
        'decreaseLoad',
        { kind: 'loadPercent', percent: -ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT },
        this.confidence(regression.evidence.windowSize, Confidence.Medium, false, false),
        this.basis('regression', trend, regression.evidence),
      );
    }

    // Rows 5 + 7: progress with improving trend → push load or reps.
    if (progress && trend === Trend.Improving) {
      const evidence = progress.evidence;
      const cap = evidence.rirInAllSessions ? Confidence.High : Confidence.Medium;
      const confidence = this.confidence(
        evidence.windowSize,
        cap,
        evidence.rirInAllSessions,
        evidence.rirInAllSessions,
      );
      if (evidence.topSetReps >= ProgressionPolicy.REP_RANGE_TOP) {
        return this.decision(
          'increaseLoad',
          this.loadIncrement(evidence.loadUnit),
          confidence,
          this.basis('progress', trend, evidence),
        );
      }
      return this.decision(
        'increaseReps',
        { kind: 'reps', value: ProgressionPolicy.REP_INCREMENT },
        confidence,
        this.basis('progress', trend, evidence),
      );
    }

    // Row 6: stagnation with stable trend → nudge reps first, load at range top.
    if (stagnation && trend === Trend.Stable) {
      const evidence = stagnation.evidence;
      const confidence = this.confidence(evidence.windowSize, Confidence.Medium, false, false);
      if (evidence.topSetReps < ProgressionPolicy.REP_RANGE_TOP) {
        return this.decision(
          'increaseReps',
          { kind: 'reps', value: ProgressionPolicy.REP_INCREMENT },
          confidence,
          this.basis('stagnation', trend, evidence),
        );
      }
      return this.decision(
        'increaseLoad',
        this.loadIncrement(evidence.loadUnit),
        confidence,
        this.basis('stagnation', trend, evidence),
      );
    }

    // No signal fired: keep the plan, but with low confidence —
    // the absence of a detected pattern is weak evidence.
    return this.decision('maintain', { kind: 'none' }, Confidence.Low, {
      signal: 'none',
      trend,
      windowSize: 0,
    });
  }

  private loadIncrement(unit: LoadUnit): DecisionMagnitude {
    return {
      kind: 'load',
      value:
        unit === 'kg' ? ProgressionPolicy.LOAD_INCREMENT_KG : ProgressionPolicy.LOAD_INCREMENT_LB,
      unit,
    };
  }

  private confidence(
    windowSize: number,
    cap: Confidence,
    allowHigh: boolean,
    rirInAllSessions: boolean,
  ): Confidence {
    let value: Confidence =
      windowSize >= 3
        ? Confidence.Medium
        : windowSize === 2
          ? Confidence.Low
          : Confidence.Insufficient;
    if (allowHigh && rirInAllSessions && windowSize >= 3) {
      value = Confidence.High;
    }
    return CONFIDENCE_RANK[value] > CONFIDENCE_RANK[cap] ? cap : value;
  }

  private basis(
    signal: DecisionBasis['signal'],
    trend: Trend,
    evidence: {
      windowSize: number;
      volumeChangePct: number;
      lastEffectiveRir?: number | 'unknown';
    },
  ): DecisionBasis {
    return {
      signal,
      trend,
      windowSize: evidence.windowSize,
      volumeChangePct: evidence.volumeChangePct,
      lastEffectiveRir: evidence.lastEffectiveRir,
    };
  }

  private decision(
    action: DecisionAction,
    magnitude: DecisionMagnitude,
    confidence: Confidence,
    basis: DecisionBasis,
  ): Decision {
    return new Decision(action, magnitude, confidence, basis);
  }
}
