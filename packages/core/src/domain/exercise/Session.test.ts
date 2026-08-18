import { describe, it, expect } from 'vitest';
import { Session } from './Session.js';
import { LoggedSet } from './LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('Session', () => {
  it('creates a session with sets and performedAt', () => {
    const performedAt = new Date('2026-08-10');
    const sets = [new LoggedSet(new Load(100, 'kg'), new Reps(8))];
    const session = new Session(sets, performedAt);
    expect(session.sets).toHaveLength(1);
    expect(session.performedAt).toBe(performedAt);
  });

  it('rejects empty session', () => {
    expect(() => new Session([], new Date())).toThrow(DomainInvariantError);
    expect(() => new Session([], new Date())).toThrow('Session must contain at least one set');
  });

  it('preserves set order', () => {
    const s1 = new LoggedSet(new Load(100, 'kg'), new Reps(8));
    const s2 = new LoggedSet(new Load(100, 'kg'), new Reps(7));
    const session = new Session([s1, s2], new Date());
    expect(session.sets[0].equals(s1)).toBe(true);
    expect(session.sets[1].equals(s2)).toBe(true);
  });

  it('calculates total volume', () => {
    const sets = [
      new LoggedSet(new Load(100, 'kg'), new Reps(8)),
      new LoggedSet(new Load(100, 'kg'), new Reps(7)),
    ];
    const session = new Session(sets, new Date());
    expect(session.totalVolume().value).toBe(1500);
  });
});
