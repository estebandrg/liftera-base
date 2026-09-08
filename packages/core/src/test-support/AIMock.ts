import { CoachEvidence } from '../domain/boundary/CoachEvidence.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';

export interface AIMockRule {
  match(evidence: CoachEvidence): boolean;
  proposal: TrainingProposal;
}

export class AIMock {
  constructor(private readonly rules: AIMockRule[]) {}

  propose(evidence: CoachEvidence): TrainingProposal {
    const rule = this.rules.find((r) => r.match(evidence));
    if (!rule) {
      throw new Error('No AIMock rule matched the evidence.');
    }
    return rule.proposal;
  }
}
