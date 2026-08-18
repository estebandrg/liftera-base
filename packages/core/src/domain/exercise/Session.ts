import { DomainInvariantError } from '../errors/DomainErrors.js';
import { LoggedSet } from './LoggedSet.js';
import { Volume } from '../value-objects/Volume.js';

export class Session {
  readonly sets: LoggedSet[];
  readonly performedAt: Date;

  constructor(sets: LoggedSet[], performedAt: Date) {
    if (sets.length === 0) {
      throw new DomainInvariantError('Session must contain at least one set');
    }
    this.sets = [...sets];
    this.performedAt = performedAt;
  }

  totalVolume(): Volume {
    return Volume.fromSets(this.sets.map((s) => ({ load: s.load, reps: s.reps })));
  }
}
