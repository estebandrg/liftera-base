import { DomainInvariantError } from '../errors/DomainErrors.js';

export class Reps {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainInvariantError('Reps must be a positive integer');
    }
    this.value = value;
  }

  equals(other: Reps): boolean {
    return this.value === other.value;
  }
}
