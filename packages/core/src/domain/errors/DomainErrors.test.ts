import { describe, it, expect } from 'vitest';
import {
  DomainInvariantError,
  BoundaryValidationError,
  ExerciseNotFoundError,
} from './DomainErrors.js';

describe('DomainErrors', () => {
  it('DomainInvariantError has correct name and message', () => {
    const err = new DomainInvariantError('load must be positive');
    expect(err.name).toBe('DomainInvariantError');
    expect(err.message).toBe('load must be positive');
    expect(err).toBeInstanceOf(Error);
  });

  it('BoundaryValidationError has correct name and message', () => {
    const err = new BoundaryValidationError('invalid snapshot');
    expect(err.name).toBe('BoundaryValidationError');
    expect(err.message).toBe('invalid snapshot');
    expect(err).toBeInstanceOf(Error);
  });

  it('ExerciseNotFoundError has correct name and message', () => {
    const err = new ExerciseNotFoundError('bench-press');
    expect(err.name).toBe('ExerciseNotFoundError');
    expect(err.message).toBe('Exercise not found: bench-press');
    expect(err).toBeInstanceOf(Error);
  });
});
