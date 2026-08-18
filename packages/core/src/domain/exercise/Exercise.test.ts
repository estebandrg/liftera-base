import { describe, it, expect } from 'vitest';
import { Exercise } from './Exercise.js';
import { ExerciseId } from './ExerciseId.js';

describe('Exercise', () => {
  it('creates an exercise with identity only', () => {
    const id = new ExerciseId('Squat', 'High Bar');
    const exercise = new Exercise(id);
    expect(exercise.id.equals(id)).toBe(true);
    expect(exercise.progression).toBeUndefined();
  });

  it('equals by identity', () => {
    const a = new Exercise(new ExerciseId('Press', 'Overhead'));
    const b = new Exercise(new ExerciseId('Press', 'Overhead'));
    const c = new Exercise(new ExerciseId('Press', 'Seated'));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
