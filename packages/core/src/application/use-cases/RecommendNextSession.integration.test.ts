import { describe, it, expect } from 'vitest';
// Everything consumed through the package's public API — this test is the
// proof that index.ts exports the surface a consumer (e.g. a coach tool)
// actually needs.
import {
  container,
  CoreTokens,
  RecommendNextSessionFactory,
  ExerciseHistoryRepository,
  Exercise,
  ExerciseId,
  Session,
  WorkoutSnapshotMapper,
  RecommendationSnapshotMapper,
  BoundaryValidationError,
} from '../../index.js';

/**
 * Full decision cycle across the boundary:
 * raw workout snapshots → fromSnapshot → Session[] → fake history port →
 * RecommendNextSession (resolved from the DI container) → Recommendation →
 * toSnapshot → wire-ready recommendation snapshot.
 */

const workout = (
  id: string,
  day: number,
  sets: { weight: number; unit: 'kg' | 'lb'; reps: number; rir?: number }[],
) => ({
  workoutId: id,
  performedAt: `2026-08-${day.toString().padStart(2, '0')}T07:30:00.000Z`,
  exercises: [
    {
      exerciseType: 'Barbell Bench Press',
      variation: 'Flat',
      sets,
    },
  ],
});

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

const progressSnapshots = [
  workout('w-1', 1, [{ weight: 100, unit: 'kg', reps: 10, rir: 3 }]),
  workout('w-2', 2, [{ weight: 100, unit: 'kg', reps: 11, rir: 2 }]),
  workout('w-3', 3, [{ weight: 100, unit: 'kg', reps: 12, rir: 2 }]),
];

const seedFromSnapshots = (rawSnapshots: unknown[]): FakeExerciseHistoryRepository => {
  const mapper = new WorkoutSnapshotMapper();
  const sessions = rawSnapshots.flatMap((raw) => mapper.fromSnapshot(raw));
  const first = rawSnapshots[0] as {
    exercises: { exerciseType: string; variation: string }[];
  };
  const exerciseId = new ExerciseId(first.exercises[0].exerciseType, first.exercises[0].variation);
  const history = new FakeExerciseHistoryRepository();
  history.seed(new Exercise(exerciseId), sessions);
  return history;
};

describe('decision cycle integration — snapshot in, snapshot out', () => {
  it('turns three progressing workout snapshots into a load-increase snapshot', async () => {
    const history = seedFromSnapshots(progressSnapshots);
    const factory = container.resolve<RecommendNextSessionFactory>(CoreTokens.recommendNextSession);
    const useCase = factory(history);

    const recommendation = await useCase.execute(new ExerciseId('Barbell Bench Press', 'Flat'));
    const snapshot = new RecommendationSnapshotMapper().toSnapshot(recommendation);

    expect(snapshot).toEqual({
      status: 'ok',
      action: 'increaseLoad',
      magnitude: 2.5,
      unit: 'kg',
      reason:
        'Increase load by 2.5 kg. Volume rose 20% across the window and the last session ended with 2 reps in reserve.',
      confidence: 'high',
    });
  });

  it('returns an insufficient_data snapshot when history holds a single session', async () => {
    const history = seedFromSnapshots(progressSnapshots.slice(0, 1));
    const factory = container.resolve<RecommendNextSessionFactory>(CoreTokens.recommendNextSession);
    const useCase = factory(history);

    const recommendation = await useCase.execute(new ExerciseId('Barbell Bench Press', 'Flat'));
    const snapshot = new RecommendationSnapshotMapper().toSnapshot(recommendation);

    expect(snapshot).toEqual({
      status: 'insufficient_data',
      reason: 'Need at least 2 logged sessions to recommend; got 1.',
      confidence: 'insufficient',
    });
  });

  it('rejects a malformed snapshot at the boundary before the pipeline runs', () => {
    const broken = workout('w-x', 1, [{ weight: -100, unit: 'kg', reps: 10 }]);

    expect(() => new WorkoutSnapshotMapper().fromSnapshot(broken)).toThrow(BoundaryValidationError);
  });
});
