import { DecisionAction, DecisionMagnitude } from '../recommendation/Decision.js';
import { ProgressSignal } from '../signals/ProgressSignal.js';
import { FatigueSignal } from '../signals/FatigueSignal.js';
import { RegressionSignal } from '../signals/RegressionSignal.js';
import { StagnationSignal } from '../signals/StagnationSignal.js';
import { Trend } from '../value-objects/Trend.js';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { ValidationResult, Violation, ViolationCode } from './ValidationResult.js';

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

interface MagnitudeClamp {
  readonly magnitude: DecisionMagnitude;
  readonly violation: Violation;
}

const clampTo = (
  magnitude: DecisionMagnitude,
  limit: number,
  proposed: number,
  action: DecisionAction,
): MagnitudeClamp => ({
  magnitude,
  violation: {
    code: 'magnitude_exceeds_limit',
    message: `Magnitude ${proposed} for action '${action}' exceeds the policy limit ${limit}; clamped to the limit.`,
    field: 'magnitude',
    expected: limit,
    actual: proposed,
  },
});

// Rule (c): clamp magnitudes to the ProgressionPolicy ceilings carried by
// the evidence. Only over-ceiling proposals are adjusted; conservative
// under-limit proposals stay valid. Runs only on structurally matched
// kind/action pairs — rule (a) owns mismatches.
const magnitudeClamp = ({ proposal, evidence }: ValidationInput): MagnitudeClamp | undefined => {
  const { action, magnitude } = proposal;
  const limits = evidence.policyLimits;

  if (action === 'increaseLoad' && magnitude.kind === 'load') {
    const ceiling = magnitude.unit === 'kg' ? limits.LOAD_INCREMENT_KG : limits.LOAD_INCREMENT_LB;
    if (magnitude.value > ceiling) {
      return clampTo(
        { kind: 'load', value: ceiling, unit: magnitude.unit },
        ceiling,
        magnitude.value,
        action,
      );
    }
    return undefined;
  }
  if (action === 'increaseReps' && magnitude.kind === 'reps') {
    if (magnitude.value > limits.REP_INCREMENT) {
      return clampTo(
        { kind: 'reps', value: limits.REP_INCREMENT },
        limits.REP_INCREMENT,
        magnitude.value,
        action,
      );
    }
    return undefined;
  }
  if (action === 'decreaseLoad' && magnitude.kind === 'loadPercent') {
    const floor = -limits.FATIGUE_LOAD_REDUCTION_PCT;
    if (magnitude.percent < floor) {
      return clampTo({ kind: 'loadPercent', percent: floor }, floor, magnitude.percent, action);
    }
    return undefined;
  }
  if (action === 'decreaseVolume' && magnitude.kind === 'sets') {
    const floor = -limits.VOLUME_REDUCTION_SETS;
    if (magnitude.value < floor) {
      return clampTo({ kind: 'sets', value: floor }, floor, magnitude.value, action);
    }
    return undefined;
  }
  return undefined;
};

// Violation codes that reject the proposal outright; any other violation
// (currently only magnitude_exceeds_limit) produces an adjustment instead.
const REJECTING_CODES: ReadonlySet<ViolationCode> = new Set([
  'policy_violation',
  'action_invalid_for_signal',
  'confidence_mismatch',
]);

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
    const clamp = magnitudeClamp(input);
    if (clamp) {
      violations.push(clamp.violation);
    }

    if (violations.some((violation) => REJECTING_CODES.has(violation.code))) {
      return { status: 'rejected', violations };
    }
    if (clamp) {
      return { status: 'adjusted', adjustedMagnitude: clamp.magnitude, violations };
    }
    return { status: 'valid' };
  }
}
