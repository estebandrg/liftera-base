import { describe, it, expect } from 'vitest';
import { RecommendNextSession } from './RecommendNextSession.js';
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
import { DecisionEngine } from '../../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../../domain/services/RecommendationEngine.js';

/**
 * In-memory fake of the history port. The use case is async at the
 * boundary, so the fake is async too — no mocks, no spies.
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

const buildUseCase = (history: ExerciseHistoryRepository): RecommendNextSession =>
  new RecommendNextSession(
    history,
    new TrendAnalyzer(),
    new DecisionEngine(),
    new RecommendationEngine(),
  );

describe('RecommendNextSession — exercise lookup', () => {
  it('throws ExerciseNotFoundError when the repository has no such exercise', async () => {
    const useCase = buildUseCase(new FakeExerciseHistoryRepository());

    await expect(useCase.execute(benchPressId)).rejects.toThrow(ExerciseNotFoundError);
    await expect(useCase.execute(benchPressId)).rejects.toThrow(
      'Exercise not found: Barbell Bench Press (Flat)',
    );
  });
});

describe('RecommendNextSession — insufficient data', () => {
  it('returns insufficient_data with confidence insufficient when no sessions are logged', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), []);
    const useCase = buildUseCase(history);

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('insufficient_data');
    expect(recommendation.confidence).toBe('insufficient');
    expect(recommendation.reason).toContain('0');
  });

  it('returns insufficient_data with confidence insufficient when only one session is logged', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const useCase = buildUseCase(history);

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('insufficient_data');
    expect(recommendation.confidence).toBe('insufficient');
    expect(recommendation.reason).toContain('1');
  });
});

describe('RecommendNextSession — recommendation paths', () => {
  it('returns a preliminary low-confidence recommendation with exactly 2 sessions', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 100, 10, 2),
      topSetOnly(2, 100, 11, 2),
    ]);
    const useCase = buildUseCase(history);

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') {
      throw new Error('expected an actionable recommendation');
    }
    expect(recommendation.action).toBe('increaseReps');
    expect(recommendation.magnitude).toEqual({ kind: 'reps', value: 1 });
    expect(recommendation.confidence).toBe('low');
    expect(recommendation.reason).toContain('Add 1 rep');
  });

  it('returns a high-confidence load increase with 3 progressing sessions at the rep-range top', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 100, 10, 3),
      topSetOnly(2, 100, 11, 2),
      topSetOnly(3, 100, 12, 2),
    ]);
    const useCase = buildUseCase(history);

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') {
      throw new Error('expected an actionable recommendation');
    }
    expect(recommendation.action).toBe('increaseLoad');
    expect(recommendation.magnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
    expect(recommendation.confidence).toBe('high');
    expect(recommendation.reason).toContain('Increase load by 2.5 kg');
  });

  it('tolerates out-of-order sessions from the port by normalizing chronology', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(3, 100, 12, 2),
      topSetOnly(1, 100, 10, 3),
      topSetOnly(2, 100, 11, 2),
    ]);
    const useCase = buildUseCase(history);

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('ok');
    if (recommendation.status !== 'ok') {
      throw new Error('expected an actionable recommendation');
    }
    expect(recommendation.action).toBe('increaseLoad');
  });
});
