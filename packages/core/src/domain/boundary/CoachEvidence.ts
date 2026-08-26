import { ExerciseId } from '../exercise/ExerciseId.js';
import { Trend } from '../value-objects/Trend.js';
import { PerformanceSignal } from '../signals/PerformanceSignal.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { Confidence } from '../value-objects/Confidence.js';

/**
 * Evidence the core hands to an external actor so it can propose the next
 * training step. `policyLimits` is embedded BY REFERENCE: the policy stays a
 * single source of truth and consumers map keys, never duplicate values.
 */
export interface CoachEvidence {
  readonly exerciseId: ExerciseId;
  readonly trend: Trend;
  readonly signals: readonly PerformanceSignal[];
  readonly policyLimits: typeof ProgressionPolicy;
  readonly windowConfidence: Confidence;
}
