import { PerformanceSignal } from './PerformanceSignal.js';

export interface FatigueEvidence {
  readonly windowSize: number;
  readonly volumeChangePct: number;
  readonly lastEffectiveRir: number;
}

/**
 * Performance declined while effort stayed high (RIR >= 4).
 * Fatigue always requires effort evidence; without RIR a decline
 * is a RegressionSignal instead.
 */
export class FatigueSignal extends PerformanceSignal {
  readonly kind = 'fatigue' as const;

  constructor(readonly evidence: FatigueEvidence) {
    super();
  }
}
