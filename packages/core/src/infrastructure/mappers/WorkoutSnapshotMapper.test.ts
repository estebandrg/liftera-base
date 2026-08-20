import { describe, it, expect } from 'vitest';
import { WorkoutSnapshotMapper } from './WorkoutSnapshotMapper.js';
import { BoundaryValidationError } from '../../domain/errors/DomainErrors.js';
import { DomainInvariantError } from '../../domain/errors/DomainErrors.js';

const validSnapshot = {
  workoutId: 'w-1',
  performedAt: '2026-08-03T10:00:00.000Z',
  exercises: [
    {
      exerciseType: 'Barbell Bench Press',
      variation: 'Flat',
      sets: [
        { weight: 80, unit: 'kg', reps: 10, rir: 3 },
        { weight: 100, unit: 'kg', reps: 8, rir: 2 },
      ],
    },
    {
      exerciseType: 'Barbell Row',
      variation: 'Pendlay',
      sets: [{ weight: 60, unit: 'kg', reps: 12 }],
    },
  ],
};

const expectBoundaryError = (input: unknown): BoundaryValidationError => {
  try {
    new WorkoutSnapshotMapper().fromSnapshot(input);
  } catch (error) {
    expect(error).toBeInstanceOf(BoundaryValidationError);
    // Boundary validation must fire before any domain construction.
    expect(error).not.toBeInstanceOf(DomainInvariantError);
    return error as BoundaryValidationError;
  }
  throw new Error('expected fromSnapshot to throw BoundaryValidationError');
};

describe('WorkoutSnapshotMapper.fromSnapshot — valid input', () => {
  const mapper = new WorkoutSnapshotMapper();

  it('maps one Session per exercise with LoggedSet value objects', () => {
    const sessions = mapper.fromSnapshot(validSnapshot);

    expect(sessions).toHaveLength(2);

    const [bench, row] = sessions;
    expect(bench.performedAt).toEqual(new Date('2026-08-03T10:00:00.000Z'));
    expect(bench.sets).toHaveLength(2);
    expect(bench.sets[0].load.value).toBe(80);
    expect(bench.sets[0].load.unit).toBe('kg');
    expect(bench.sets[0].reps.value).toBe(10);
    expect(bench.sets[0].rir?.value).toBe(3);
    expect(bench.sets[1].load.value).toBe(100);

    expect(row.sets).toHaveLength(1);
    expect(row.sets[0].rir).toBeUndefined();
  });

  it('accepts a Date instance for performedAt', () => {
    const sessions = mapper.fromSnapshot({ ...validSnapshot, performedAt: new Date('2026-08-03') });

    expect(sessions[0].performedAt).toEqual(new Date('2026-08-03'));
  });

  it('strips unknown keys so producers can evolve without breaking the boundary', () => {
    const withExtras = {
      ...validSnapshot,
      source: 'coach-app',
      exercises: [
        {
          ...validSnapshot.exercises[0],
          notes: 'felt heavy',
          sets: validSnapshot.exercises[0].sets.map((s) => ({ ...s, tempo: '2-0-2' })),
        },
      ],
    };

    const sessions = mapper.fromSnapshot(withExtras);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets[0].load.value).toBe(80);
  });
});

describe('WorkoutSnapshotMapper.fromSnapshot — invalid input rejected before the domain', () => {
  it('rejects a negative load (domain invariant mirrored at the boundary)', () => {
    const input = {
      ...validSnapshot,
      exercises: [{ ...validSnapshot.exercises[0], sets: [{ weight: -5, unit: 'kg', reps: 10 }] }],
    };

    const error = expectBoundaryError(input);
    expect(error.message).toContain('exercises.0.sets.0.weight');
  });

  it('rejects non-integer reps', () => {
    const input = {
      ...validSnapshot,
      exercises: [
        { ...validSnapshot.exercises[0], sets: [{ weight: 100, unit: 'kg', reps: 8.5 }] },
      ],
    };

    const error = expectBoundaryError(input);
    expect(error.message).toContain('exercises.0.sets.0.reps');
  });

  it('rejects RIR outside 0-10', () => {
    const input = {
      ...validSnapshot,
      exercises: [
        { ...validSnapshot.exercises[0], sets: [{ weight: 100, unit: 'kg', reps: 8, rir: 11 }] },
      ],
    };

    const error = expectBoundaryError(input);
    expect(error.message).toContain('exercises.0.sets.0.rir');
  });

  it('rejects an unknown load unit', () => {
    const input = {
      ...validSnapshot,
      exercises: [
        { ...validSnapshot.exercises[0], sets: [{ weight: 100, unit: 'stone', reps: 8 }] },
      ],
    };

    expectBoundaryError(input);
  });

  it('rejects an exercise with no sets (Session invariant mirrored at the boundary)', () => {
    const input = {
      ...validSnapshot,
      exercises: [{ ...validSnapshot.exercises[0], sets: [] }],
    };

    const error = expectBoundaryError(input);
    expect(error.message).toContain('exercises.0.sets');
  });

  it('rejects an unparseable performedAt', () => {
    expectBoundaryError({ ...validSnapshot, performedAt: 'not a date' });
  });

  it('aggregates all issues with their paths instead of failing on the first', () => {
    const input = {
      workoutId: '',
      performedAt: '2026-08-03T10:00:00.000Z',
      exercises: [
        {
          exerciseType: '',
          variation: 'Flat',
          sets: [{ weight: 0, unit: 'kg', reps: -2 }],
        },
      ],
    };

    const error = expectBoundaryError(input);
    expect(error.message).toContain('workoutId');
    expect(error.message).toContain('exercises.0.exerciseType');
    expect(error.message).toContain('exercises.0.sets.0.weight');
    expect(error.message).toContain('exercises.0.sets.0.reps');
  });
});
