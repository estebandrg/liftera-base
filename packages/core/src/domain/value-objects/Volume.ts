import { DomainInvariantError } from '../errors/DomainErrors.js';
import { Load } from './Load.js';
import { Reps } from './Reps.js';

export class Volume {
  readonly value: number;

  constructor(value: number) {
    if (value < 0) {
      throw new DomainInvariantError('Volume cannot be negative');
    }
    this.value = value;
  }

  static fromSets(sets: { load: Load; reps: Reps }[]): Volume {
    const total = sets.reduce((sum, s) => sum + s.load.value * s.reps.value, 0);
    return new Volume(total);
  }

  equals(other: Volume): boolean {
    return this.value === other.value;
  }
}
