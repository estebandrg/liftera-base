import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { TrainingProposal } from '../../domain/boundary/TrainingProposal.js';

/**
 * Port interface for proposal generation. RunProgressionCycle depends on this
 * abstraction instead of importing a concrete test-support mock, fixing the
 * layering violation (Q1). No production implementation exists yet; AIMock in
 * test-support/ satisfies this interface at test time.
 */
export interface ProposalGenerator {
  propose(evidence: CoachEvidence): TrainingProposal;
}
