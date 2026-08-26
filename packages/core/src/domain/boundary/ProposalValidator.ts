import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { ValidationResult, Violation } from './ValidationResult.js';

const EXPECTED_MAGNITUDE_KIND: Record<DecisionAction, DecisionMagnitude['kind']> = {
  increaseLoad: 'load',
  increaseReps: 'reps',
  decreaseLoad: 'loadPercent',
  decreaseVolume: 'sets',
  maintain: 'none',
  evaluateChange: 'none',
};

interface ValidationInput {
  readonly proposal: TrainingProposal;
  readonly evidence: CoachEvidence;
}

// Rule (a): the magnitude kind must structurally match the action.
const structuralPairingViolations = ({ proposal }: ValidationInput): Violation[] => {
  const expectedKind = EXPECTED_MAGNITUDE_KIND[proposal.action];
  if (proposal.magnitude.kind === expectedKind) {
    return [];
  }
  return [
    {
      code: 'policy_violation',
      message: `Magnitude kind '${proposal.magnitude.kind}' is incompatible with action '${proposal.action}' (expected '${expectedKind}').`,
      field: 'magnitude',
      expected: expectedKind,
      actual: proposal.magnitude.kind,
    },
  ];
};

/**
 * Universal authority boundary between ANY external actor and the domain:
 * no external actor can make effective a number the domain does not allow.
 * Pure and stateless; every rule runs over the same input and violations
 * are collected before the tri-state outcome is decided.
 */
export class ProposalValidator {
  validate(proposal: TrainingProposal, evidence: CoachEvidence): ValidationResult {
    const input: ValidationInput = { proposal, evidence };
    const violations: Violation[] = [...structuralPairingViolations(input)];

    if (violations.length > 0) {
      return { status: 'rejected', violations };
    }
    return { status: 'valid' };
  }
}
