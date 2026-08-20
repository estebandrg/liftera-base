import { Session } from '../exercise/Session.js';
import { LoggedSet } from '../exercise/LoggedSet.js';
import { Volume } from '../value-objects/Volume.js';

/**
 * Effective effort of a session: the top-set RIR value, the mean of the
 * sets carrying RIR when the top set has none, or 'unknown'.
 * A fractional mean is kept as-is: rounding would distort the
 * RIR thresholds used downstream.
 */
export type EffectiveRir = number | 'unknown';

export class SessionPerformance {
  constructor(
    readonly topSet: LoggedSet,
    readonly volume: Volume,
    readonly effectiveRir: EffectiveRir,
  ) {}
}

/**
 * Translates raw sessions into performance facts. Pure and stateless.
 */
export class SessionInterpreter {
  interpret(sessions: Session[]): SessionPerformance[] {
    return sessions.map((session) => {
      const topSet = this.findTopSet(session);
      return new SessionPerformance(
        topSet,
        session.totalVolume(),
        this.resolveEffectiveRir(session, topSet),
      );
    });
  }

  private findTopSet(session: Session): LoggedSet {
    return session.sets.reduce((heaviest, set) =>
      set.load.value > heaviest.load.value ? set : heaviest,
    );
  }

  private resolveEffectiveRir(session: Session, topSet: LoggedSet): EffectiveRir {
    if (topSet.rir !== undefined) {
      return topSet.rir.value;
    }
    const rirValues = session.sets.flatMap((set) => (set.rir !== undefined ? [set.rir.value] : []));
    if (rirValues.length === 0) {
      return 'unknown';
    }
    return rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length;
  }
}
