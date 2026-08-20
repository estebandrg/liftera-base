import { LoadUnit } from '../value-objects/Load.js';
import { PerformanceSignal } from './PerformanceSignal.js';

export interface ProgressEvidence {
  readonly windowSize: number;
  readonly volumeChangePct: number;
  readonly lastEffectiveRir: number | 'unknown';
  readonly rirInAllSessions: boolean;
  readonly topSetReps: number;
  readonly loadUnit: LoadUnit;
}

/**
 * Volume is rising and effort evidence supports pushing progression.
 * When RIR is absent, classification rests on volume/reps only
 * (design: RIR-absent weighting, confidence capped at medium).
 */
export class ProgressSignal extends PerformanceSignal {
  readonly kind = 'progress' as const;

  constructor(readonly evidence: ProgressEvidence) {
    super();
  }
}
