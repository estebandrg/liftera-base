import { describe, it, expect } from 'vitest';
import { Volume } from './Volume.js';
import { Load } from './Load.js';
import { Reps } from './Reps.js';
import { DomainInvariantError } from '../errors/DomainErrors.js';

describe('Volume', () => {
  it('calculates volume from multiple sets', () => {
    const sets = [
      { load: new Load(100, 'kg'), reps: new Reps(8) },
      { load: new Load(100, 'kg'), reps: new Reps(7) },
    ];
    const volume = Volume.fromSets(sets);
    expect(volume.value).toBe(100 * 8 + 100 * 7); // 1500
  });

  it('calculates volume from a single set', () => {
    const sets = [{ load: new Load(80, 'lb'), reps: new Reps(10) }];
    const volume = Volume.fromSets(sets);
    expect(volume.value).toBe(800);
  });

  it('rejects negative volume value directly', () => {
    expect(() => new Volume(-1)).toThrow(DomainInvariantError);
    expect(() => new Volume(-1)).toThrow('Volume cannot be negative');
  });

  it('equals by value', () => {
    const a = Volume.fromSets([{ load: new Load(50, 'kg'), reps: new Reps(10) }]);
    const b = Volume.fromSets([{ load: new Load(50, 'kg'), reps: new Reps(10) }]);
    const c = Volume.fromSets([{ load: new Load(60, 'kg'), reps: new Reps(10) }]);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
