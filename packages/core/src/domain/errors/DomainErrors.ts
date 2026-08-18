export class DomainInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainInvariantError';
  }
}

export class BoundaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryValidationError';
  }
}

export class ExerciseNotFoundError extends Error {
  constructor(exerciseId: string) {
    super(`Exercise not found: ${exerciseId}`);
    this.name = 'ExerciseNotFoundError';
  }
}
