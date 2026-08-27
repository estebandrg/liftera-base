import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { TrainingProposal } from '../../domain/boundary/TrainingProposal.js';
import { ValidationResult } from '../../domain/boundary/ValidationResult.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';

/**
 * Inbound tool port for coach-facing actors (AI, user, system, external).
 * The core is the authority over what is VALID, never over the ORIGIN of a
 * proposal: every actor drives the same three-step flow.
 *
 * Contract:
 * - `getCoachEvidence` returns the evidence an actor needs to propose the
 *   next training step; unknown exercises surface as `ExerciseNotFoundError`.
 * - `validateProposal` is PURE and STATELESS: same inputs, same result, no
 *   side effects, no persistence. It never throws for a bad proposal — it
 *   returns a `rejected` ValidationResult.
 * - `applyRecommendation` enforces the domain guard BEFORE any persistence:
 *   a `rejected` validation is a caller bug and throws `DomainInvariantError`.
 *   In boundary v0 persistence is not wired (OQ-2), so any applicable
 *   validation (`valid` or `adjusted`) throws a typed
 *   `PersistenceNotWiredError` instead of silently dropping the proposal.
 */
export interface CoachTools {
  getCoachEvidence(exerciseId: ExerciseId): Promise<CoachEvidence>;
  validateProposal(proposal: TrainingProposal, evidence: CoachEvidence): Promise<ValidationResult>;
  applyRecommendation(
    exerciseId: ExerciseId,
    proposal: TrainingProposal,
    validation: ValidationResult,
  ): Promise<void>;
}
