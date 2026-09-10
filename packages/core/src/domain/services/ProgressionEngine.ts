import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { Trend } from '../value-objects/Trend.js';
import { PROGRESSION_WINDOW_SIZE } from '../../application/use-cases/ProgressionWindow.js';

/**
 * Mirrors DecisionEngine magnitude logic for a given action.
 * Domain-pure: no confidence computation, no side effects.
 *
 * Trend modulation (step-scaling):
 * - Load multiplier:      Improving = 1.0, Stable = 0.5, Declining = 0.0
 * - Discrete multiplier:  Improving = 1,   Stable = 0,   Declining = 0
 * - Decrease multiplier:  Declining = 1.0, Stable = 0.5, Improving = 0.0
 *
 * Zero-resolution rule: when a modulated increase/decrease magnitude
 * resolves to 0, the engine emits { kind: 'none' } instead of a
 * zero-magnitude action.
 */
export class ProgressionEngine {
  static readonly WINDOW_SIZE = PROGRESSION_WINDOW_SIZE;

  computeMagnitude(
    action: DecisionAction,
    signals: PerformanceSignal[],
    trend: Trend,
  ): DecisionMagnitude {
    const progress = signals.find((s): s is ProgressSignal => s instanceof ProgressSignal);
    const stagnation = signals.find((s): s is StagnationSignal => s instanceof StagnationSignal);

    switch (action) {
      case 'increaseLoad': {
        const evidence = progress?.evidence ?? stagnation?.evidence;
        if (!evidence) return { kind: 'none' };
        const multiplier = this.increaseLoadMultiplier(trend);
        if (multiplier === 0) return { kind: 'none' };
        const value =
          evidence.loadUnit === 'kg'
            ? ProgressionPolicy.LOAD_INCREMENT_KG * multiplier
            : ProgressionPolicy.LOAD_INCREMENT_LB * multiplier;
        return { kind: 'load', value, unit: evidence.loadUnit };
      }
      case 'increaseReps': {
        const multiplier = this.increaseDiscreteMultiplier(trend);
        const value = Math.trunc(ProgressionPolicy.REP_INCREMENT * multiplier);
        if (value === 0) return { kind: 'none' };
        return { kind: 'reps', value };
      }
      case 'decreaseLoad': {
        const multiplier = this.decreaseMultiplier(trend);
        const percent = -ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT * multiplier;
        if (percent === 0) return { kind: 'none' };
        return { kind: 'loadPercent', percent };
      }
      case 'decreaseVolume': {
        const multiplier = this.decreaseMultiplier(trend);
        const raw = -ProgressionPolicy.VOLUME_REDUCTION_SETS * multiplier;
        const value = Math.trunc(raw);
        if (value === 0) return { kind: 'none' };
        return { kind: 'sets', value };
      }
      case 'maintain':
      case 'evaluateChange':
        return { kind: 'none' };
    }
  }

  private increaseLoadMultiplier(trend: Trend): number {
    switch (trend) {
      case Trend.Improving:
        return 1.0;
      case Trend.Stable:
        return 0.5;
      case Trend.Declining:
        return 0.0;
      default:
        throw new Error(`Unexpected trend: ${trend}`);
    }
  }

  private increaseDiscreteMultiplier(trend: Trend): number {
    switch (trend) {
      case Trend.Improving:
        return 1;
      case Trend.Stable:
        return 0;
      case Trend.Declining:
        return 0;
      default:
        throw new Error(`Unexpected trend: ${trend}`);
    }
  }

  private decreaseMultiplier(trend: Trend): number {
    switch (trend) {
      case Trend.Declining:
        return 1.0;
      case Trend.Stable:
        return 0.5;
      case Trend.Improving:
        return 0.0;
      default:
        throw new Error(`Unexpected trend: ${trend}`);
    }
  }
}
