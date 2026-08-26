import { describe, it, expect } from 'vitest';
import { EvidenceEngine } from './EvidenceEngine.js';
import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { Exercise } from '../../domain/exercise/Exercise.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { Session } from '../../domain/exercise/Session.js';
import { LoggedSet } from '../../domain/exercise/LoggedSet.js';
import { Load } from '../../domain/value-objects/Load.js';
import { Reps } from '../../domain/value-objects/Reps.js';
import { RIR } from '../../domain/value-objects/RIR.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';

/**
 * In-memory fake of the history port (GoldenValidation pattern): async at
 * the boundary, no mocks, no spies.
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

const sessionOn = (day: number, sets: LoggedSet[]): Session =>
  new Session(sets, new Date(`2026-08-${day.toString().padStart(2, '0')}`));

const topSetOnly = (day: number, kg: number, reps: number, rir?: number): Session =>
  sessionOn(day, [
    new LoggedSet(new Load(kg, 'kg'), new Reps(reps), rir !== undefined ? new RIR(rir) : undefined),
  ]);

const buildEngine = (history: ExerciseHistoryRepository): EvidenceEngine =>
  new EvidenceEngine(history, new TrendAnalyzer());

describe('EvidenceEngine — exercise lookup', () => {
  it('throws ExerciseNotFoundError when the repository has no such exercise', async () => {
    const engine = buildEngine(new FakeExerciseHistoryRepository());

    await expect(engine.produceEvidence(benchPressId)).rejects.toThrow(ExerciseNotFoundError);
    await expect(engine.produceEvidence(benchPressId)).rejects.toThrow(
      'Exercise not found: Barbell Bench Press (Flat)',
    );
  });

  it('produces evidence carrying the requested exercise id when the exercise exists', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.exerciseId).toEqual(benchPressId);
  });
});
