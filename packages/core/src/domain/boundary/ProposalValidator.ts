import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { Trend } from '../value-objects/Trend.js';
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

const INCREASE_ACTIONS: readonly DecisionAction[] = ['increaseLoad', 'increaseReps'];
const DECREASE_ACTIONS: readonly DecisionAction[] = ['decreaseLoad', 'decreaseVolume'];

// Rule (b): directional envelope (OQ-1). Only actions opposing the direction
// implied by the evidence state are forbidden; same-direction alternatives
// stay allowed and any other state forbids nothing. Rows mirror the
// DecisionEngine priority table without modifying it.
const coherenceViolations = ({ proposal, evidence }: ValidationInput): Violation[] => {
  const signals = evidence.signals;
  const progress = signals.find((s): s is ProgressSignal => s instanceof ProgressSignal);
  const fatigue = signals.find((s): s is FatigueSignal => s instanceof FatigueSignal);
  const regression = signals.find((s): s is RegressionSignal => s instanceof RegressionSignal);
  const stagnation = signals.find((s): s is StagnationSignal => s instanceof StagnationSignal);

  let forbidden: readonly DecisionAction[] = [];
  if (progress && (fatigue || regression)) {
    // Contradiction: halt progression.
    forbidden = INCREASE_ACTIONS;
  } else if (fatigue || (regression && evidence.trend === Trend.Declining)) {
    // Decrease direction (fatigue with any trend, regression when declining).
    forbidden = INCREASE_ACTIONS;
  } else if (progress && evidence.trend === Trend.Improving) {
    forbidden = DECREASE_ACTIONS;
  } else if (stagnation && evidence.trend === Trend.Stable) {
    forbidden = DECREASE_ACTIONS;
  }

  if (!forbidden.includes(proposal.action)) {
    return [];
  }
  return [
    {
      code: 'action_invalid_for_signal',
      message: `Action '${proposal.action}' opposes the direction implied by the current evidence state.`,
      field: 'action',
      actual: proposal.action,
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
    const violations: Violation[] = [
      ...structuralPairingViolations(input),
      ...coherenceViolations(input),
    ];

    if (violations.length > 0) {
      return { status: 'rejected', violations };
    }
    return { status: 'valid' };
  }
}
