export type SignalKind = 'progress' | 'stagnation' | 'fatigue' | 'regression';

/**
 * Base class for all performance signals detected in a session window.
 * The `kind` literal acts as the discriminant for consumers.
 */
export abstract class PerformanceSignal {
  abstract readonly kind: SignalKind;
}
