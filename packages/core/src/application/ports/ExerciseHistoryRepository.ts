import { Exercise } from '../../domain/exercise/Exercise.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { Session } from '../../domain/exercise/Session.js';

/**
 * Outbound port for exercise history. Persistence lives outside this
 * vertical — implementations are provided by the consuming application.
 *
 * Contract:
 * - `getExercise` returns `null` on a miss (the use case maps it to
 *   `ExerciseNotFoundError`); it never throws for absence.
 * - `getRecentSessions` returns at most `limit` sessions for the exercise,
 *   in any order — the use case normalizes chronology before building the
 *   progression window.
 */
export interface ExerciseHistoryRepository {
  getExercise(id: ExerciseId): Promise<Exercise | null>;
  getRecentSessions(id: ExerciseId, limit: number): Promise<Session[]>;
}
