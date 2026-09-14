import { DecisionMagnitude } from '../recommendation/Decision.js';
import { ExerciseId } from '../exercise/ExerciseId.js';
import { TrainingProposal } from './TrainingProposal.js';

export type ViolationCode =
  | 'magnitude_exceeds_limit'
  | 'action_invalid_for_signal'
  | 'confidence_mismatch'
  | 'policy_violation'
  | 'magnitude_below_minimum'
  | 'limitation_violation';

export interface Violation {
  readonly code: ViolationCode;
  readonly message: string;
  readonly field: 'action' | 'magnitude' | 'confidence';
  readonly expected?: unknown;
  readonly actual?: unknown;
}

/**
 * Tri-state validation outcome:
 * - `valid`: the proposal fits the domain as-is.
 * - `adjusted`: applicable with a magnitude clamped to policy; the clamp is
 *   transparent to the caller through `violations`.
 * - `rejected`: at least one rejecting violation; any clamp is discarded.
 */
export type ValidationResult =
  | { readonly status: 'valid' }
  | {
      readonly status: 'adjusted';
      readonly adjustedMagnitude: DecisionMagnitude;
      readonly violations: readonly Violation[];
    }
  | { readonly status: 'rejected'; readonly violations: readonly Violation[] };

export interface AppliedRecommendation {
  readonly exerciseId: ExerciseId;
  readonly proposal: TrainingProposal;
  readonly validation: ValidationResult;
  readonly appliedAt: Date;
}
