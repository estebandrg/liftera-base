import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { Confidence } from '../value-objects/Confidence.js';

export type ProposalSource = 'ai' | 'user' | 'system' | 'external';

export type ProposalIntent =
  'progress' | 'conservative_progress' | 'deload' | 'maintain' | 'evaluate_change';

export interface ProposalProvenance {
  readonly source: ProposalSource;
  readonly intent: ProposalIntent;
  readonly evidenceRefs: readonly string[];
}

/**
 * An absolute-magnitude proposal from ANY external actor (AI, user, system,
 * external import). The core is the authority over what is VALID, not over
 * the ORIGIN of the proposal: every source passes through the same validator.
 */
export interface TrainingProposal {
  readonly source: ProposalSource;
  readonly intent: ProposalIntent;
  readonly action: DecisionAction;
  readonly magnitude: DecisionMagnitude;
  readonly justification: string;
  readonly confidence: Confidence;
  readonly provenance?: ProposalProvenance;
}
