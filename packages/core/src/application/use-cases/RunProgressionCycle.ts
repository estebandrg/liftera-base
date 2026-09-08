import { CoachTools } from '../application/ports/CoachTools.js';
import { ExerciseHistoryRepository } from '../application/ports/ExerciseHistoryRepository.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ValidationResult } from '../domain/boundary/ValidationResult.js';
import { AIMock } from '../test-support/AIMock.js';

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
    private readonly aiMock: AIMock,
  ) {}

  async execute(exerciseId: ExerciseId): Promise<RunProgressionCycleResult> {
    const evidence = await this.tools.getCoachEvidence(exerciseId);
    const proposal = this.aiMock.propose(evidence);
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
