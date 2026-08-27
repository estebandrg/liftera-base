import { describe, it, expect } from 'vitest';
import { CoreCoachTools } from './CoreCoachTools.js';
import { EvidenceEngine } from './use-cases/EvidenceEngine.js';
import { ExerciseHistoryRepository } from './ports/ExerciseHistoryRepository.js';
import { DomainInvariantError } from '../domain/errors/DomainErrors.js';
import { ProposalValidator } from '../domain/boundary/ProposalValidator.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ValidationResult, ViolationCode } from '../domain/boundary/ValidationResult.js';
import { Exercise } from '../domain/exercise/Exercise.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';
import { Session } from '../domain/exercise/Session.js';
import { TrendAnalyzer } from '../domain/services/TrendAnalyzer.js';
import { Confidence } from '../domain/value-objects/Confidence.js';

/**
 * In-memory fake of the history port (RecommendNextSession.test.ts pattern).
 * No mocks: the engine and validator under the tools are the real ones.
 */
class FakeExerciseHistoryRepository implements ExerciseHistoryRepository {
  private readonly exercises = new Map<string, Exercise>();
  private readonly sessionsByExercise = new Map<string, Session[]>();

  seed(exercise: Exercise, sessions: Session[]): void {
    const key = this.key(exercise.id);
    this.exercises.set(key, exercise);
    this.sessionsByExercise.set(key, sessions);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | null> {
    return this.exercises.get(this.key(id)) ?? null;
  }

  async getRecentSessions(id: ExerciseId, limit: number): Promise<Session[]> {
    const all = this.sessionsByExercise.get(this.key(id)) ?? [];
    return all.slice(-limit);
  }

  private key(id: ExerciseId): string {
    return `${id.exerciseType}::${id.variation}`;
  }
}

const benchPressId = new ExerciseId('Barbell Bench Press', 'Flat');

const proposal = (overrides: Partial<TrainingProposal> = {}): TrainingProposal => ({
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Evidence-backed proposal.',
  confidence: Confidence.Medium,
  ...overrides,
});

const VIOLATION_FIELD: Record<ViolationCode, 'action' | 'magnitude' | 'confidence'> = {
  policy_violation: 'magnitude',
  action_invalid_for_signal: 'action',
  magnitude_exceeds_limit: 'magnitude',
  confidence_mismatch: 'confidence',
};

const rejected = (code: ViolationCode): ValidationResult => ({
  status: 'rejected',
  violations: [{ code, message: `Rejected by ${code}.`, field: VIOLATION_FIELD[code] }],
});

const buildTools = (history: ExerciseHistoryRepository): CoreCoachTools =>
  new CoreCoachTools(new EvidenceEngine(history, new TrendAnalyzer()), new ProposalValidator());

describe('CoreCoachTools — applyRecommendation guard', () => {
  it('throws DomainInvariantError when the validation is rejected', async () => {
    const tools = buildTools(new FakeExerciseHistoryRepository());

    await expect(
      tools.applyRecommendation(benchPressId, proposal(), rejected('policy_violation')),
    ).rejects.toThrow(DomainInvariantError);
  });

  it('guards any rejecting violation code and names the exercise', async () => {
    const tools = buildTools(new FakeExerciseHistoryRepository());

    const apply = tools.applyRecommendation(
      benchPressId,
      proposal(),
      rejected('confidence_mismatch'),
    );

    await expect(apply).rejects.toThrow(DomainInvariantError);
    await expect(apply).rejects.toThrow('Barbell Bench Press (Flat)');
  });
});
