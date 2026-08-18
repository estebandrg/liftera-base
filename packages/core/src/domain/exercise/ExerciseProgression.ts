import { DomainInvariantError } from '../errors/DomainErrors.js';
import { Confidence } from '../value-objects/Confidence.js';
import { Session } from './Session.js';

export class ExerciseProgression {
  readonly sessions: Session[];

  constructor(sessions: Session[]) {
    if (sessions.length > 3) {
      throw new DomainInvariantError('Window cannot exceed 3 sessions');
    }

    for (let i = 1; i < sessions.length; i++) {
      const prev = sessions[i - 1].performedAt.getTime();
      const curr = sessions[i].performedAt.getTime();

      if (curr === prev) {
        throw new DomainInvariantError('Duplicate session date in window');
      }

      if (curr < prev) {
        throw new DomainInvariantError('Sessions must be ordered by performedAt');
      }
    }

    this.sessions = [...sessions];
  }

  windowConfidence(): Confidence {
    switch (this.sessions.length) {
      case 0:
        return Confidence.Insufficient;
      case 1:
        return Confidence.Insufficient;
      case 2:
        return Confidence.Low;
      case 3:
        return Confidence.Medium;
      default:
        return Confidence.Insufficient;
    }
  }
}
