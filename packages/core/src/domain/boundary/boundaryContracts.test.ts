import { describe, it, expect } from 'vitest';
import { CoachEvidence } from './CoachEvidence.js';
import { TrainingProposal } from './TrainingProposal.js';
import { ValidationResult, Violation, AppliedRecommendation } from './ValidationResult.js';
import { ExerciseId } from '../exercise/ExerciseId.js';
import { ProgressionPolicy } from '../recommendation/ProgressionPolicy.js';
import { Trend } from '../value-objects/Trend.js';
import { Confidence } from '../value-objects/Confidence.js';

describe('boundary contracts', () => {
  it('contract modules resolve and stay type-only (zero runtime exports by design)', async () => {
    // Pure-domain contracts must not introduce runtime code; the modules
    // transpile to empty namespaces. This import also proves the files exist.
    const coachEvidence = await import('./CoachEvidence.js');
    const trainingProposal = await import('./TrainingProposal.js');
    const validationResult = await import('./ValidationResult.js');

    expect(Object.keys(coachEvidence)).toEqual([]);
    expect(Object.keys(trainingProposal)).toEqual([]);
    expect(Object.keys(validationResult)).toEqual([]);
  });

  it('CoachEvidence embeds policyLimits by reference to ProgressionPolicy', () => {
    const evidence: CoachEvidence = {
      exerciseId: new ExerciseId('squat', 'high-bar'),
      trend: Trend.Stable,
      signals: [],
      policyLimits: ProgressionPolicy,
      windowConfidence: Confidence.Medium,
    };

    expect(evidence.policyLimits).toBe(ProgressionPolicy);
    expect(evidence.trend).toBe(Trend.Stable);
    expect(evidence.signals).toHaveLength(0);
    expect(evidence.windowConfidence).toBe(Confidence.Medium);
  });

  it('CoachEvidence optionally carries evidenceAt and completeness', () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const full: CoachEvidence = {
      exerciseId: new ExerciseId('squat', 'high-bar'),
      trend: Trend.Stable,
      signals: [],
      policyLimits: ProgressionPolicy,
      windowConfidence: Confidence.Medium,
      evidenceAt: now,
      completeness: 'full',
    };

    expect(full.evidenceAt).toBe(now);
    expect(full.completeness).toBe('full');

    const partial: CoachEvidence = {
      exerciseId: new ExerciseId('squat', 'high-bar'),
      trend: Trend.Stable,
      signals: [],
      policyLimits: ProgressionPolicy,
      windowConfidence: Confidence.Medium,
      completeness: 'partial',
    };

    expect(partial.completeness).toBe('partial');
    expect(partial.evidenceAt).toBeUndefined();
  });

  it('TrainingProposal carries source, intent, action, magnitude, justification and confidence', () => {
    const proposal: TrainingProposal = {
      source: 'ai',
      intent: 'progress',
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      justification: 'Top set reps hit the range top with RIR 1 across the window.',
      confidence: Confidence.Medium,
    };

    expect(proposal.source).toBe('ai');
    expect(proposal.intent).toBe('progress');
    expect(proposal.action).toBe('increaseLoad');
    expect(proposal.magnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
    expect(proposal.justification.length).toBeGreaterThan(0);
    expect(proposal.confidence).toBe(Confidence.Medium);
  });

  it('TrainingProposal optionally carries provenance with source, intent and evidenceRefs', () => {
    const proposal: TrainingProposal = {
      source: 'ai',
      intent: 'progress',
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      justification: 'Evidence-backed proposal.',
      confidence: Confidence.Medium,
      provenance: {
        source: 'ai',
        intent: 'conservative_progress',
        evidenceRefs: ['decreaseVolume:percent=-20'],
      },
    };

    expect(proposal.provenance).toBeDefined();
    if (proposal.provenance) {
      expect(proposal.provenance.source).toBe('ai');
      expect(proposal.provenance.intent).toBe('conservative_progress');
      expect(proposal.provenance.evidenceRefs).toEqual(['decreaseVolume:percent=-20']);
    }

    const withoutProvenance: TrainingProposal = {
      source: 'user',
      intent: 'maintain',
      action: 'maintain',
      magnitude: { kind: 'none' },
      justification: 'Deload week.',
      confidence: Confidence.Low,
    };

    expect(withoutProvenance.provenance).toBeUndefined();
  });

  it('ValidationResult supports the valid/adjusted/rejected tri-state with violations', () => {
    const clampViolation: Violation = {
      code: 'magnitude_exceeds_limit',
      message: 'Proposed 5 kg exceeds the policy limit of 2.5 kg; clamped to the limit.',
      field: 'magnitude',
      expected: 2.5,
      actual: 5,
    };
    const rejectingViolation: Violation = {
      code: 'policy_violation',
      message: "Magnitude kind 'reps' is incompatible with action 'increaseLoad'.",
      field: 'magnitude',
      expected: 'load',
      actual: 'reps',
    };

    const valid: ValidationResult = { status: 'valid' };
    const adjusted: ValidationResult = {
      status: 'adjusted',
      adjustedMagnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      violations: [clampViolation],
    };
    const rejected: ValidationResult = { status: 'rejected', violations: [rejectingViolation] };

    expect(valid.status).toBe('valid');
    expect(adjusted.status).toBe('adjusted');
    if (adjusted.status === 'adjusted') {
      expect(adjusted.adjustedMagnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
      expect(adjusted.violations).toHaveLength(1);
      expect(adjusted.violations[0].code).toBe('magnitude_exceeds_limit');
    }
    expect(rejected.status).toBe('rejected');
    if (rejected.status === 'rejected') {
      expect(rejected.violations[0].code).toBe('policy_violation');
    }
  });

  it('ViolationCode accepts magnitude_below_minimum as a rejecting code', () => {
    const violation: Violation = {
      code: 'magnitude_below_minimum',
      message: 'Increase magnitude 0 is below the minimum > 0.',
      field: 'magnitude',
      expected: '> 0',
      actual: 0,
    };

    const rejected: ValidationResult = { status: 'rejected', violations: [violation] };

    expect(rejected.status).toBe('rejected');
    if (rejected.status === 'rejected') {
      expect(rejected.violations[0].code).toBe('magnitude_below_minimum');
      expect(rejected.violations[0].field).toBe('magnitude');
    }
  });

  it('AppliedRecommendation links the proposal, its validation and the application timestamp', () => {
    const applied: AppliedRecommendation = {
      exerciseId: new ExerciseId('squat', 'high-bar'),
      proposal: {
        source: 'user',
        intent: 'maintain',
        action: 'maintain',
        magnitude: { kind: 'none' },
        justification: 'Deload week requested by the athlete.',
        confidence: Confidence.Low,
      },
      validation: { status: 'valid' },
      appliedAt: new Date('2026-08-26T00:00:00Z'),
    };

    expect(applied.exerciseId.exerciseType).toBe('squat');
    expect(applied.proposal.action).toBe('maintain');
    expect(applied.validation.status).toBe('valid');
    expect(applied.appliedAt.toISOString()).toBe('2026-08-26T00:00:00.000Z');
  });
});
