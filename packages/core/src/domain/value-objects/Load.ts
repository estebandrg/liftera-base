import { DomainInvariantError } from '../errors/DomainErrors.js';

export type LoadUnit = 'kg' | 'lb';

export class Load {
  readonly value: number;
  readonly unit: LoadUnit;

  constructor(value: number, unit: LoadUnit) {
    if (value <= 0) {
      throw new DomainInvariantError('Load must be positive');
    }
    if (unit !== 'kg' && unit !== 'lb') {
      throw new DomainInvariantError("Load unit must be 'kg' or 'lb'");
    }
    this.value = value;
    this.unit = unit;
  }

  equals(other: Load): boolean {
    return this.value === other.value && this.unit === other.unit;
  }
}
