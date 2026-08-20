import { Confidence } from '../value-objects/Confidence.js';
import { DecisionAction, DecisionMagnitude } from './Decision.js';

export interface ActionableRecommendation {
  readonly status: 'ok';
  readonly action: DecisionAction;
  readonly magnitude: DecisionMagnitude;
  readonly confidence: Confidence;
  readonly reason: string;
}

/**
 * Expected outcome when the window is too small to decide.
 * A valid result variant — never thrown as an exception.
 */
export interface InsufficientData {
  readonly status: 'insufficient_data';
  readonly confidence: Confidence;
  readonly reason: string;
}

export type Recommendation = ActionableRecommendation | InsufficientData;
