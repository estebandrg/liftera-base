import { describe, it, expect } from 'vitest';
import { ExerciseProgression } from './ExerciseProgression.js';
import { Session } from './Session.js';
import { LoggedSet } from './LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';
import { Confidence } from '../value-objects/Confidence.js';

describe('ExerciseProgression', () => {
  const makeSession = (day: number): Session => {
    return new Session(
      [new LoggedSet(new Load(100, 'kg'), new Reps(8))],
      new Date(`2026-08-${day.toString().padStart(2, '0')}`),
    );
  };

  it('accepts up to 3 ordered sessions', () => {
    const sessions = [makeSession(1), makeSession(2), makeSession(3)];
    const progression = new ExerciseProgression(sessions);
    expect(progression.sessions).toHaveLength(3);
  });

  it('rejects more than 3 sessions', () => {
    const sessions = [makeSession(1), makeSession(2), makeSession(3), makeSession(4)];
    expect(() => new ExerciseProgression(sessions)).toThrow(DomainInvariantError);
    expect(() => new ExerciseProgression(sessions)).toThrow('Window cannot exceed 3 sessions');
  });

  it('rejects unordered sessions', () => {
    const sessions = [makeSession(3), makeSession(1), makeSession(2)];
    expect(() => new ExerciseProgression(sessions)).toThrow(DomainInvariantError);
    expect(() => new ExerciseProgression(sessions)).toThrow(
      'Sessions must be ordered by performedAt',
    );
  });

  it('rejects duplicate performedAt', () => {
    const sameDate = new Date('2026-08-10');
    const sessions = [
      new Session([new LoggedSet(new Load(100, 'kg'), new Reps(8))], sameDate),
      new Session([new LoggedSet(new Load(100, 'kg'), new Reps(7))], sameDate),
    ];
    expect(() => new ExerciseProgression(sessions)).toThrow(DomainInvariantError);
    expect(() => new ExerciseProgression(sessions)).toThrow('Duplicate session date in window');
  });

  it('with 1 session returns insufficient confidence', () => {
    const progression = new ExerciseProgression([makeSession(1)]);
    expect(progression.windowConfidence()).toBe(Confidence.Insufficient);
  });

  it('with 2 sessions returns low confidence', () => {
    const progression = new ExerciseProgression([makeSession(1), makeSession(2)]);
    expect(progression.windowConfidence()).toBe(Confidence.Low);
  });

  it('with 3 sessions returns medium confidence', () => {
    const progression = new ExerciseProgression([makeSession(1), makeSession(2), makeSession(3)]);
    expect(progression.windowConfidence()).toBe(Confidence.Medium);
  });
});
