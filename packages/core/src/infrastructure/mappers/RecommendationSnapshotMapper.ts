import { Recommendation } from '../../domain/recommendation/Recommendation.js';
import { DecisionAction, DecisionMagnitude } from '../../domain/recommendation/Decision.js';
import { LoadUnit } from '../../domain/value-objects/Load.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';

/**
 * Minimal, structured evidence for the consuming coach — no prose beyond
 * the reason, no pipeline internals. `magnitude` carries the raw signed
 * number from the decision (direction is already expressed by `action`);
 * `unit` is present only for absolute load magnitudes. `windowSize` and
 * the rest of the decision basis stay inside the domain by design.
 */
export interface RecommendationSnapshot {
  readonly status: 'ok' | 'insufficient_data';
  readonly action?: DecisionAction;
  readonly magnitude?: number;
  readonly unit?: LoadUnit;
  readonly reason: string;
  readonly confidence: Confidence;
}

/**
 * Outbound boundary mapper: flattens a domain Recommendation into the
 * wire snapshot. Pure projection — no validation, the domain object is
 * already trusted.
 */
export class RecommendationSnapshotMapper {
  toSnapshot(recommendation: Recommendation): RecommendationSnapshot {
    if (recommendation.status === 'insufficient_data') {
      return {
        status: 'insufficient_data',
        reason: recommendation.reason,
        confidence: recommendation.confidence,
      };
    }

    const magnitude = recommendation.magnitude;
    const value = this.magnitudeValue(magnitude);
    return {
      status: 'ok',
      action: recommendation.action,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
      ...(value !== undefined ? { magnitude: value } : {}),
      ...(magnitude.kind === 'load' ? { unit: magnitude.unit } : {}),
    };
  }

  private magnitudeValue(magnitude: DecisionMagnitude): number | undefined {
    switch (magnitude.kind) {
      case 'load':
        return magnitude.value;
      case 'loadPercent':
        return magnitude.percent;
      case 'reps':
        return magnitude.value;
      case 'sets':
        return magnitude.value;
      case 'none':
        return undefined;
    }
  }
}
