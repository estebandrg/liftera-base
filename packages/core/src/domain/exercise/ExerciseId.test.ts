import { describe, it, expect } from 'vitest';
import { ExerciseId } from './ExerciseId.js';

describe('ExerciseId', () => {
  it('creates an identity from type and variation', () => {
    const id = new ExerciseId('Barbell Bench Press', 'Flat');
    expect(id.exerciseType).toBe('Barbell Bench Press');
    expect(id.variation).toBe('Flat');
  });

  it('equals when both fields match', () => {
    const a = new ExerciseId('Squat', 'High Bar');
    const b = new ExerciseId('Squat', 'High Bar');
    expect(a.equals(b)).toBe(true);
  });

  it('not equals when type differs', () => {
    const a = new ExerciseId('Squat', 'High Bar');
    const b = new ExerciseId('Deadlift', 'High Bar');
    expect(a.equals(b)).toBe(false);
  });

  it('not equals when variation differs', () => {
    const a = new ExerciseId('Bench Press', 'Flat');
    const b = new ExerciseId('Bench Press', 'Incline');
    expect(a.equals(b)).toBe(false);
  });

  it('toString returns readable identity', () => {
    const id = new ExerciseId('Press', 'Overhead');
    expect(id.toString()).toBe('Press (Overhead)');
  });
});
