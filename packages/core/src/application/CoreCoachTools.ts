import { EvidenceEngine } from './use-cases/EvidenceEngine.js';
import { ProposalValidator } from '../domain/boundary/ProposalValidator.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ValidationResult } from '../domain/boundary/ValidationResult.js';
import { DomainInvariantError } from '../domain/errors/DomainErrors.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';

/**
 * CoachTools implementation: composes the EvidenceEngine and the universal
 * ProposalValidator behind the tool port.
 */
export class CoreCoachTools {
  constructor(
    private readonly evidenceEngine: EvidenceEngine,
    private readonly validator: ProposalValidator,
  ) {}

  /**
   * Applying a REJECTED validation is a caller bug, not a domain outcome:
   * the guard fires before any persistence concern (OQ-2).
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
  }
}
