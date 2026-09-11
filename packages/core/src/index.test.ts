import { describe, it, expect } from 'vitest';
import * as surface from './index.js';
import { SignalDetector } from './domain/services/SignalDetector.js';
import { SessionPerformance } from './domain/services/SessionInterpreter.js';
import { ProposalValidator } from './domain/boundary/ProposalValidator.js';
import { CoachEvidence } from './domain/boundary/CoachEvidence.js';
import { TrainingProposal } from './domain/boundary/TrainingProposal.js';
import { ValidationResult } from './domain/boundary/ValidationResult.js';
import { EvidenceEngine } from './application/use-cases/EvidenceEngine.js';
import { RunProgressionCycle } from './application/use-cases/RunProgressionCycle.js';
import { InMemoryRecommendationSink } from './application/ports/InMemoryRecommendationSink.js';
import { CoreCoachTools } from './application/CoreCoachTools.js';
import { ProgressionEngine } from './domain/services/ProgressionEngine.js';
import { PersistenceNotWiredError } from './domain/errors/DomainErrors.js';
import {
  DecisionMagnitudeSchema,
  TrainingProposalSchema,
  TrainingProposalMapper,
} from './infrastructure/mappers/TrainingProposalSchema.js';
// ProposalGenerator is type-only; runtime assertion uses surface.ProposalGenerator.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ProposalGenerator } from './application/ports/ProposalGenerator.js';
import {
  LastEffectiveRirSnapshotSchema,
  ProgressSignalSnapshotSchema,
  FatigueSignalSnapshotSchema,
  RegressionSignalSnapshotSchema,
  StagnationSignalSnapshotSchema,
  SignalSnapshotSchema,
  PolicyLimitsSnapshotSchema,
  CoachEvidenceSnapshotSchema,
  CoachEvidenceSnapshotMapper,
} from './infrastructure/mappers/CoachEvidenceSnapshot.js';
import {
  ViolationSnapshotSchema,
  ValidationResultSnapshotSchema,
  ValidationResultSnapshotMapper,
} from './infrastructure/mappers/ValidationResultSnapshot.js';
import { ExerciseId } from './domain/exercise/ExerciseId.js';
import { ProgressionPolicy } from './domain/recommendation/ProgressionPolicy.js';
import { Trend } from './domain/value-objects/Trend.js';
import { Confidence } from './domain/value-objects/Confidence.js';

// The barrel re-exports the boundary surface; identity assertions prove the
// surfaced symbol IS the module's implementation, never a redefinition.
// Type-only exports (ports, contracts, snapshot types) are compile-time:
// they are verified by tsc over src plus the emitted dist/index.d.ts.
describe('package surface — boundary value exports', () => {
  it('re-exports the boundary domain and application implementations unchanged', () => {
    expect(surface.ProposalValidator).toBe(ProposalValidator);
    expect(surface.EvidenceEngine).toBe(EvidenceEngine);
    expect(surface.RunProgressionCycle).toBe(RunProgressionCycle);
    expect(surface.InMemoryRecommendationSink).toBe(InMemoryRecommendationSink);
    expect(surface.CoreCoachTools).toBe(CoreCoachTools);
    expect(surface.ProgressionEngine).toBe(ProgressionEngine);
    expect(surface.PersistenceNotWiredError).toBe(PersistenceNotWiredError);
  });

  it('exports SignalDetector and SessionInterpreter types from the public barrel', () => {
    expect(surface.SignalDetector).toBe(SignalDetector);
    // Type-level: EffectiveRir is exported as a type; at runtime we verify
    // the constructor it belongs to is reachable.
    expect(surface.SessionPerformance).toBe(SessionPerformance);
  });

  it('exports the ProposalGenerator port interface', () => {
    // Type-level assertion: an object shaped like ProposalGenerator compiles
    // when typed through the barrel export.
    const mock = {
      propose: (): TrainingProposal => ({
        source: 'ai',
        intent: 'progress',
        action: 'maintain',
        magnitude: { kind: 'none' },
        justification: 'test',
        confidence: Confidence.Medium,
      }),
    } satisfies surface.ProposalGenerator;

    expect(typeof mock.propose).toBe('function');
  });

  it('re-exports the boundary wire schemas unchanged', () => {
    expect(surface.DecisionMagnitudeSchema).toBe(DecisionMagnitudeSchema);
    expect(surface.TrainingProposalSchema).toBe(TrainingProposalSchema);
    expect(surface.LastEffectiveRirSnapshotSchema).toBe(LastEffectiveRirSnapshotSchema);
    expect(surface.ProgressSignalSnapshotSchema).toBe(ProgressSignalSnapshotSchema);
    expect(surface.FatigueSignalSnapshotSchema).toBe(FatigueSignalSnapshotSchema);
    expect(surface.RegressionSignalSnapshotSchema).toBe(RegressionSignalSnapshotSchema);
    expect(surface.StagnationSignalSnapshotSchema).toBe(StagnationSignalSnapshotSchema);
    expect(surface.SignalSnapshotSchema).toBe(SignalSnapshotSchema);
    expect(surface.PolicyLimitsSnapshotSchema).toBe(PolicyLimitsSnapshotSchema);
    expect(surface.CoachEvidenceSnapshotSchema).toBe(CoachEvidenceSnapshotSchema);
    expect(surface.ViolationSnapshotSchema).toBe(ViolationSnapshotSchema);
    expect(surface.ValidationResultSnapshotSchema).toBe(ValidationResultSnapshotSchema);
  });

  it('re-exports the boundary mappers unchanged', () => {
    expect(surface.TrainingProposalMapper).toBe(TrainingProposalMapper);
    expect(surface.CoachEvidenceSnapshotMapper).toBe(CoachEvidenceSnapshotMapper);
    expect(surface.ValidationResultSnapshotMapper).toBe(ValidationResultSnapshotMapper);
  });
});

describe('package surface — boundary behavior through the barrel', () => {
  it('rejects a malformed proposal payload via the surfaced inbound schema', () => {
    const result = surface.TrainingProposalSchema.safeParse({
      source: 'ai',
      intent: 'progress',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      justification: 'Missing action must fail shape validation.',
      confidence: 'medium',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a kind-action mismatch via the surfaced validator', () => {
    const evidence: CoachEvidence = {
      exerciseId: new ExerciseId('squat', 'high-bar'),
      trend: Trend.Stable,
      signals: [],
      policyLimits: ProgressionPolicy,
      windowConfidence: Confidence.High,
    };
    const proposal: TrainingProposal = {
      source: 'ai',
      intent: 'progress',
      action: 'increaseLoad',
      magnitude: { kind: 'reps', value: 1 },
      justification: 'Mismatched kind to prove the surfaced validator runs.',
      confidence: Confidence.Medium,
    };

    const result: ValidationResult = new surface.ProposalValidator().validate(proposal, evidence);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.violations[0].code).toBe('policy_violation');
    }
  });

  it('constructs the persistence-not-wired error through the barrel', () => {
    const error = new surface.PersistenceNotWiredError('not wired');

    expect(error).toBeInstanceOf(PersistenceNotWiredError);
    expect(error.name).toBe('PersistenceNotWiredError');
    expect(error.message).toBe('not wired');
  });
});
