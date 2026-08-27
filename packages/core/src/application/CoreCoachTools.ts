import { CoachTools } from './ports/CoachTools.js';
import { EvidenceEngine } from './use-cases/EvidenceEngine.js';
import { ExerciseHistoryRepository } from './ports/ExerciseHistoryRepository.js';
import { CoachEvidence } from '../domain/boundary/CoachEvidence.js';
import { ProposalValidator } from '../domain/boundary/ProposalValidator.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ValidationResult } from '../domain/boundary/ValidationResult.js';
import { DomainInvariantError, PersistenceNotWiredError } from '../domain/errors/DomainErrors.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';

/** Builds the tools once the consumer supplies a history port. */
export type CoachToolsFactory = (history: ExerciseHistoryRepository) => CoreCoachTools;

/**
 * CoachTools implementation: composes the EvidenceEngine and the universal
 * ProposalValidator behind the tool port. Evidence and validation delegate
 * untouched — the tools add the apply guard, not new domain logic.
 */
export class CoreCoachTools implements CoachTools {
  constructor(
    private readonly evidenceEngine: EvidenceEngine,
    private readonly validator: ProposalValidator,
  ) {}

  getCoachEvidence(exerciseId: ExerciseId): Promise<CoachEvidence> {
    return this.evidenceEngine.produceEvidence(exerciseId);
  }

  /**
   * Pure and stateless passthrough: the validator owns every rule; this
   * method adds no side effects, no mutation, no persistence.
   */
  validateProposal(proposal: TrainingProposal, evidence: CoachEvidence): Promise<ValidationResult> {
    return Promise.resolve(this.validator.validate(proposal, evidence));
  }

  /**
   * Applying a REJECTED validation is a caller bug, not a domain outcome:
   * the guard fires before any persistence concern. Applicable validations
   * (valid or adjusted) then hit the v0 boundary: persistence is not wired
   * yet (OQ-2), so the call fails loudly with a typed error instead of
   * silently dropping the proposal.
   */
  async applyRecommendation(
    exerciseId: ExerciseId,
    _proposal: TrainingProposal,
    validation: ValidationResult,
  ): Promise<void> {
    if (validation.status === 'rejected') {
      throw new DomainInvariantError(
        `Cannot apply a rejected recommendation for exercise ${exerciseId.toString()}.`,
      );
    }
    throw new PersistenceNotWiredError(
      'Recommendation persistence is not wired in boundary v0 (OQ-2).',
    );
  }
}
