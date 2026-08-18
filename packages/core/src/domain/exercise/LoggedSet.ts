import { Load } from '../value-objects/Load.js';
import { Reps } from '../value-objects/Reps.js';
import { RIR } from '../value-objects/RIR.js';
import { Volume } from '../value-objects/Volume.js';

export class LoggedSet {
  readonly load: Load;
  readonly reps: Reps;
  readonly rir?: RIR;

  constructor(load: Load, reps: Reps, rir?: RIR) {
    this.load = load;
    this.reps = reps;
    this.rir = rir;
  }

  volume(): Volume {
    return new Volume(this.load.value * this.reps.value);
  }

  equals(other: LoggedSet): boolean {
    const rirMatch =
      this.rir === undefined && other.rir === undefined
        ? true
        : this.rir !== undefined && other.rir !== undefined && this.rir.equals(other.rir);
    return this.load.equals(other.load) && this.reps.equals(other.reps) && rirMatch;
  }
}
