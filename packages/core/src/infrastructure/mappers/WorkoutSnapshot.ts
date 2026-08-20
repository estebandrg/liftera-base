import { z } from 'zod';

/**
 * Boundary schema for a logged workout. THIS IS THE ONLY ZOD SITE in the
 * package: validation lives at the edge so the domain never sees untrusted
 * data. Field constraints deliberately mirror the domain invariants
 * (positive load, positive integer reps, RIR 0-10, at least one set) so a
 * bad payload fails here with a BoundaryValidationError instead of
 * surfacing as a DomainInvariantError deep in the pipeline.
 *
 * Unknown keys are stripped (Zod default object mode), not rejected:
 * producers may add fields over time without breaking this consumer.
 */
export const LoggedSetSnapshotSchema = z.object({
  weight: z.number().positive(),
  unit: z.enum(['kg', 'lb']),
  reps: z.number().int().positive(),
  rir: z.number().int().min(0).max(10).optional(),
});

export const ExerciseSnapshotSchema = z.object({
  exerciseType: z.string().min(1),
  variation: z.string().min(1),
  sets: z.array(LoggedSetSnapshotSchema).min(1),
});

export const WorkoutSnapshotSchema = z.object({
  workoutId: z.string().min(1),
  performedAt: z.coerce.date(),
  exercises: z.array(ExerciseSnapshotSchema).min(1),
});

export type LoggedSetSnapshot = z.infer<typeof LoggedSetSnapshotSchema>;
export type ExerciseSnapshot = z.infer<typeof ExerciseSnapshotSchema>;
export type WorkoutSnapshot = z.infer<typeof WorkoutSnapshotSchema>;
