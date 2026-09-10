import { CoachTools } from '../ports/CoachTools.js';
import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { TrainingProposal } from '../../domain/boundary/TrainingProposal.js';
import { ValidationResult } from '../../domain/boundary/ValidationResult.js';
import { ProposalGenerator } from '../ports/ProposalGenerator.js';

export type RunProgressionCycleResult =
  | {
      readonly status: 'applied' | 'adjusted';
      readonly exerciseId: ExerciseId;
      readonly proposal: TrainingProposal;
      readonly validation: ValidationResult;
      readonly appliedAt: Date;
    }
  | {
      readonly status: 'rejected';
      readonly exerciseId: ExerciseId;
      readonly proposal: TrainingProposal;
      readonly validation: ValidationResult;
    };

export class RunProgressionCycle {
  constructor(
    private readonly history: ExerciseHistoryRepository,
    private readonly tools: CoachTools,
    private readonly proposalSource: ProposalGenerator,
  ) {}

  async execute(exerciseId: ExerciseId): Promise<RunProgressionCycleResult> {
    const evidence = await this.tools.getCoachEvidence(exerciseId);
    const proposal = this.proposalSource.propose(evidence);
    const validation = await this.tools.validateProposal(proposal, evidence);

    if (validation.status === 'rejected') {
      return { status: 'rejected', exerciseId, proposal, validation };
    }

    await this.tools.applyRecommendation(exerciseId, proposal, validation);

    return {
      status: validation.status === 'adjusted' ? 'adjusted' : 'applied',
      exerciseId,
      proposal,
      validation,
      appliedAt: new Date(),
    };
  }
}
