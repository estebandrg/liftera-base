import { DomainInvariantError } from '../errors/DomainErrors.js';

/**
 * Immutable value object representing athlete context readable by the IA.
 * Open composition: all fields are optional free strings except limitations,
 * which is an exact-exercise forbidden list.
 */
export class AthleteProfile {
  readonly methodology?: string;
  readonly experience?: string;
  readonly limitations?: readonly string[];
  readonly goals?: string;

  constructor(props: {
    methodology?: string;
    experience?: string;
    limitations?: readonly string[];
    goals?: string;
  }) {
    if (props.limitations !== undefined && props.limitations.length === 0) {
      throw new DomainInvariantError('Limitations cannot be empty when present');
    }
    this.methodology = props.methodology;
    this.experience = props.experience;
    this.limitations = props.limitations;
    this.goals = props.goals;
  }

  /**
   * Exact-match veto: returns true if the exercise name exactly matches
   * any entry in the limitations list. No fuzzy, pattern, or substring
   * matching — product decision: exact exercise names only.
   */
  forbids(exerciseName: string): boolean {
    return this.limitations?.includes(exerciseName) ?? false;
  }
}
