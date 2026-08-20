import { LoadUnit } from '../value-objects/Load.js';
import { PerformanceSignal } from './PerformanceSignal.js';

export interface StagnationEvidence {
  readonly windowSize: number;
  readonly volumeChangePct: number;
  readonly topSetReps: number;
  readonly loadUnit: LoadUnit;
}

/**
 * Load, reps, and volume stayed flat within tolerance across the window.
 */
export class StagnationSignal extends PerformanceSignal {
  readonly kind = 'stagnation' as const;

  constructor(readonly evidence: StagnationEvidence) {
    super();
  }
}
