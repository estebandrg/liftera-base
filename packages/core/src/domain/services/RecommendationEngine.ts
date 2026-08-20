import { Decision } from '../recommendation/Decision.js';
import { Recommendation } from '../recommendation/Recommendation.js';

/**
 * Translates a Decision into a user-facing Recommendation.
 * Every actionable decision gets a reason the user can understand.
 * Pure and stateless.
 */
export class RecommendationEngine {
  translate(decision: Decision): Recommendation {
    return {
      status: 'ok',
      action: decision.action,
      magnitude: decision.magnitude,
      confidence: decision.confidence,
      reason: this.buildReason(decision),
    };
  }

  private buildReason(decision: Decision): string {
    return `${this.headline(decision)} ${this.explanation(decision)}`.trim();
  }

  private headline(decision: Decision): string {
    const magnitude = decision.magnitude;
    switch (decision.action) {
      case 'increaseLoad':
        return magnitude.kind === 'load'
          ? `Increase load by ${magnitude.value} ${magnitude.unit}.`
          : 'Increase load.';
      case 'increaseReps':
        return magnitude.kind === 'reps'
          ? `Add ${magnitude.value} rep per set at your current load.`
          : 'Add reps.';
      case 'decreaseLoad':
        return magnitude.kind === 'loadPercent'
          ? `Reduce load by ${Math.abs(magnitude.percent)}%.`
          : 'Reduce load.';
      case 'decreaseVolume':
        return magnitude.kind === 'sets'
          ? `Remove ${Math.abs(magnitude.value)} set from your next session.`
          : 'Reduce volume.';
      case 'evaluateChange':
        return 'Evaluate changing the exercise or its plan.';
      case 'maintain':
        return 'Keep the current plan.';
    }
  }

  private explanation(decision: Decision): string {
    const basis = decision.basis;
    const pct =
      basis.volumeChangePct !== undefined ? this.formatPct(basis.volumeChangePct) : undefined;
    switch (basis.signal) {
      case 'progress':
        return basis.lastEffectiveRir !== undefined && basis.lastEffectiveRir !== 'unknown'
          ? `Volume rose ${pct}% across the window and the last session ended with ${basis.lastEffectiveRir} reps in reserve.`
          : `Volume rose ${pct}% across the window.`;
      case 'stagnation':
        return `Load, reps, and volume stayed flat across ${basis.windowSize} sessions.`;
      case 'fatigue':
        return `Volume fell ${pct}% while effort stayed high (RIR ${basis.lastEffectiveRir}).`;
      case 'regression':
        return basis.lastEffectiveRir === 'unknown'
          ? `Volume fell ${pct}% with no effort data logged.`
          : `Volume fell ${pct}% with RIR ${basis.lastEffectiveRir}.`;
      case 'contradiction':
        return 'Progress and decline evidence conflict within the same window.';
      case 'none':
        return 'No clear progression pattern in the recent window.';
    }
  }

  private formatPct(value: number): number {
    return Math.abs(Math.round(value * 10) / 10);
  }
}
