import { LoadUnit } from '../value-objects/Load.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';
import { SignalKind } from '../signals/PerformanceSignal.js';

export type DecisionAction =
  | 'increaseLoad'
  | 'increaseReps'
  | 'maintain'
  | 'decreaseLoad'
  | 'decreaseVolume'
  | 'evaluateChange';

export type DecisionMagnitude =
  | { readonly kind: 'load'; readonly value: number; readonly unit: LoadUnit }
  | { readonly kind: 'loadPercent'; readonly percent: number }
  | { readonly kind: 'reps'; readonly value: number }
  | { readonly kind: 'sets'; readonly value: number }
  | { readonly kind: 'none' };

export type DecisionBasisSignal = SignalKind | 'contradiction' | 'none';

/**
 * Evidence behind a decision, kept so the recommendation layer can
 * explain WHY without re-running the analysis.
 */
export interface DecisionBasis {
  readonly signal: DecisionBasisSignal;
  readonly trend: Trend;
  readonly windowSize: number;
  readonly volumeChangePct?: number;
  readonly lastEffectiveRir?: number | 'unknown';
}

/**
 * What to do next: an action, its magnitude, the confidence ceiling
 * already applied, and the basis for the explanation.
 */
export class Decision {
  constructor(
    readonly action: DecisionAction,
    readonly magnitude: DecisionMagnitude,
    readonly confidence: Confidence,
    readonly basis: DecisionBasis,
  ) {}
}
