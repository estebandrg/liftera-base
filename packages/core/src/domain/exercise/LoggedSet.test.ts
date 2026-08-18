import { describe, it, expect } from 'vitest';
import { LoggedSet } from './LoggedSet.js';
import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { RIR } from '../value-objects/RIR.js';

describe('LoggedSet', () => {
  it('creates a set with all fields', () => {
    const set = new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(2));
    expect(set.load.value).toBe(100);
    expect(set.reps.value).toBe(8);
    expect(set.rir).toBeDefined();
    expect(set.rir!.value).toBe(2);
  });

  it('creates a set without RIR', () => {
    const set = new LoggedSet(new Load(80, 'lb'), new Reps(10));
    expect(set.load.value).toBe(80);
    expect(set.reps.value).toBe(10);
    expect(set.rir).toBeUndefined();
  });

  it('calculates volume for the set', () => {
    const set = new LoggedSet(new Load(100, 'kg'), new Reps(8));
    expect(set.volume().value).toBe(800);
  });

  it('equals by value including optional RIR', () => {
    const a = new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(2));
    const b = new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(2));
    const c = new LoggedSet(new Load(100, 'kg'), new Reps(8));
    const d = new LoggedSet(new Load(100, 'kg'), new Reps(8), new RIR(3));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });

  it('equals without RIR when both lack it', () => {
    const a = new LoggedSet(new Load(100, 'kg'), new Reps(8));
    const b = new LoggedSet(new Load(100, 'kg'), new Reps(8));
    expect(a.equals(b)).toBe(true);
  });
});
