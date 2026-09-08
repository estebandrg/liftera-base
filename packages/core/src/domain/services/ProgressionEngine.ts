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
 */
export class ProgressionEngine {
  static readonly WINDOW_SIZE = PROGRESSION_WINDOW_SIZE;

  computeMagnitude(
    action: DecisionAction,
    signals: PerformanceSignal[],
    _trend: Trend,
  ): DecisionMagnitude {
    void _trend;
    const progress = signals.find((s): s is ProgressSignal => s instanceof ProgressSignal);
    const stagnation = signals.find((s): s is StagnationSignal => s instanceof StagnationSignal);

    switch (action) {
      case 'increaseLoad': {
        const evidence = progress?.evidence ?? stagnation?.evidence;
        if (!evidence) return { kind: 'none' };
        return {
          kind: 'load',
          value:
            evidence.loadUnit === 'kg'
              ? ProgressionPolicy.LOAD_INCREMENT_KG
              : ProgressionPolicy.LOAD_INCREMENT_LB,
          unit: evidence.loadUnit,
        };
      }
      case 'increaseReps':
        return { kind: 'reps', value: ProgressionPolicy.REP_INCREMENT };
      case 'decreaseLoad':
        return {
          kind: 'loadPercent',
          percent: -ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT,
        };
      case 'decreaseVolume':
        return {
          kind: 'sets',
          value: -ProgressionPolicy.VOLUME_REDUCTION_SETS,
        };
      case 'maintain':
      case 'evaluateChange':
        return { kind: 'none' };
    }
  }
}
