export class ExerciseId {
  readonly exerciseType: string;
  readonly variation: string;

  constructor(exerciseType: string, variation: string) {
    this.exerciseType = exerciseType;
    this.variation = variation;
  }

  equals(other: ExerciseId): boolean {
    return this.exerciseType === other.exerciseType && this.variation === other.variation;
  }

  toString(): string {
    return `${this.exerciseType} (${this.variation})`;
  }
}
