import { ExerciseId } from './ExerciseId.js';
import { ExerciseProgression } from './ExerciseProgression.js';

export class Exercise {
  readonly id: ExerciseId;
  readonly progression?: ExerciseProgression;

  constructor(id: ExerciseId, progression?: ExerciseProgression) {
    this.id = id;
    this.progression = progression;
  }

  equals(other: Exercise): boolean {
    return this.id.equals(other.id);
  }
}
