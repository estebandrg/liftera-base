import { ZodError } from 'zod';
import { WorkoutSnapshotSchema } from './WorkoutSnapshot.js';
import { BoundaryValidationError } from '../../domain/errors/DomainErrors.js';
import { Session } from '../../domain/exercise/Session.js';
import { LoggedSet } from '../../domain/exercise/LoggedSet.js';
import { Load } from '../../domain/value-objects/Load.js';
import { Reps } from '../../domain/value-objects/Reps.js';
import { RIR } from '../../domain/value-objects/RIR.js';

/**
 * Inbound boundary mapper. Validates the untrusted payload with Zod and
 * only then builds domain objects — a rejected snapshot throws
 * BoundaryValidationError before any domain constructor runs.
 */
export class WorkoutSnapshotMapper {
  /**
   * Maps a validated snapshot to one `Session` per logged exercise.
   * The snapshot carries no exercise identity into the Session; callers
   * correlate by position with `exercises[i]` when they need it.
   */
  fromSnapshot(input: unknown): Session[] {
    const parsed = WorkoutSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      throw new BoundaryValidationError(this.formatIssues(parsed.error));
    }

    const { performedAt, exercises } = parsed.data;
    return exercises.map(
      (exercise) =>
        new Session(
          exercise.sets.map(
            (set) =>
              new LoggedSet(
                new Load(set.weight, set.unit),
                new Reps(set.reps),
                set.rir !== undefined ? new RIR(set.rir) : undefined,
              ),
          ),
          performedAt,
        ),
    );
  }

  /** Aggregates every issue with its nested path — never just the first. */
  private formatIssues(error: ZodError): string {
    const details = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    return `Invalid WorkoutSnapshot: ${details}`;
  }
}
