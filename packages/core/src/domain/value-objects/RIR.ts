import { DomainInvariantError } from '../errors/DomainErrors.js';

export class RIR {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new DomainInvariantError('RIR must be between 0 and 10');
    }
    this.value = value;
  }

  equals(other: RIR): boolean {
    return this.value === other.value;
  }
}
