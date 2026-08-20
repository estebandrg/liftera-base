import { PerformanceSignal } from './PerformanceSignal.js';

export interface RegressionEvidence {
  readonly windowSize: number;
  readonly volumeChangePct: number;
  readonly lastEffectiveRir: number | 'unknown';
}

/**
 * Volume declined with low or unknown effort evidence.
 * Decline without RIR emits this signal, never FatigueSignal.
 */
export class RegressionSignal extends PerformanceSignal {
  readonly kind = 'regression' as const;

  constructor(readonly evidence: RegressionEvidence) {
    super();
  }
}
