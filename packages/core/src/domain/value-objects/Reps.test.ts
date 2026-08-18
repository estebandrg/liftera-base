import { describe, it, expect } from 'vitest';
import { Reps } from './Reps.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('Reps', () => {
  it('creates valid reps', () => {
    const reps = new Reps(8);
    expect(reps.value).toBe(8);
  });

  it('rejects zero reps', () => {
    expect(() => new Reps(0)).toThrow(DomainInvariantError);
    expect(() => new Reps(0)).toThrow('Reps must be a positive integer');
  });

  it('rejects negative reps', () => {
    expect(() => new Reps(-1)).toThrow(DomainInvariantError);
    expect(() => new Reps(-1)).toThrow('Reps must be a positive integer');
  });

  it('rejects fractional reps', () => {
    expect(() => new Reps(8.5)).toThrow(DomainInvariantError);
    expect(() => new Reps(8.5)).toThrow('Reps must be a positive integer');
  });

  it('equals by value', () => {
    const a = new Reps(10);
    const b = new Reps(10);
    const c = new Reps(8);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
