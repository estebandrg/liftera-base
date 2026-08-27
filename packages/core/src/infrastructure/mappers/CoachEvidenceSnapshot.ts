import { z } from 'zod';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';
import { PerformanceSignal } from '../../domain/signals/PerformanceSignal.js';
import { ProgressSignal } from '../../domain/signals/ProgressSignal.js';
import { FatigueSignal } from '../../domain/signals/FatigueSignal.js';
import { RegressionSignal } from '../../domain/signals/RegressionSignal.js';
import { StagnationSignal } from '../../domain/signals/StagnationSignal.js';
import { DomainInvariantError } from '../../domain/errors/DomainErrors.js';

/**
 * Outbound boundary schema for CoachEvidence. The evidence is domain-trusted;
 * the Zod parse here is the WIRE-CONTRACT guarantee for external consumers:
 * what the core emits is exactly what the schema declares.
 *
 * Signals are a discriminated union on `kind` with evidence flattened in.
 * `lastEffectiveRir` is `number | 'unknown'` — fatigue always carries a
 * number; progress and regression may not have RIR evidence.
 */
export const LastEffectiveRirSnapshotSchema = z.union([z.number(), z.literal('unknown')]);

export const ProgressSignalSnapshotSchema = z.object({
  kind: z.literal('progress'),
  windowSize: z.number(),
  volumeChangePct: z.number(),
  lastEffectiveRir: LastEffectiveRirSnapshotSchema,
  rirInAllSessions: z.boolean(),
  topSetReps: z.number(),
  loadUnit: z.enum(['kg', 'lb']),
});

export const FatigueSignalSnapshotSchema = z.object({
  kind: z.literal('fatigue'),
  windowSize: z.number(),
  volumeChangePct: z.number(),
  lastEffectiveRir: LastEffectiveRirSnapshotSchema,
});

export const RegressionSignalSnapshotSchema = z.object({
  kind: z.literal('regression'),
  windowSize: z.number(),
  volumeChangePct: z.number(),
  lastEffectiveRir: LastEffectiveRirSnapshotSchema,
});

export const StagnationSignalSnapshotSchema = z.object({
  kind: z.literal('stagnation'),
  windowSize: z.number(),
  volumeChangePct: z.number(),
  topSetReps: z.number(),
  loadUnit: z.enum(['kg', 'lb']),
});

export const SignalSnapshotSchema = z.discriminatedUnion('kind', [
  ProgressSignalSnapshotSchema,
  FatigueSignalSnapshotSchema,
  RegressionSignalSnapshotSchema,
  StagnationSignalSnapshotSchema,
]);

export const PolicyLimitsSnapshotSchema = z.object({
  loadIncrementKg: z.number(),
  loadIncrementLb: z.number(),
  repIncrement: z.number(),
  fatigueLoadReductionPct: z.number(),
  volumeReductionSets: z.number(),
  volumeFlatTolerancePct: z.number(),
  repsFlatTolerance: z.number(),
  repRangeTop: z.number(),
  progressRirMax: z.number(),
  fatigueRirMin: z.number(),
});

export const CoachEvidenceSnapshotSchema = z.object({
  exerciseId: z.object({
    exerciseType: z.string().min(1),
    variation: z.string().min(1),
  }),
  trend: z.enum(['improving', 'stable', 'declining']),
  signals: z.array(SignalSnapshotSchema),
  policyLimits: PolicyLimitsSnapshotSchema,
  windowConfidence: z.enum(['insufficient', 'low', 'medium', 'high']),
});

export type SignalSnapshot = z.infer<typeof SignalSnapshotSchema>;
export type PolicyLimitsSnapshot = z.infer<typeof PolicyLimitsSnapshotSchema>;
export type CoachEvidenceSnapshot = z.infer<typeof CoachEvidenceSnapshotSchema>;

/**
 * Outbound boundary mapper: projects domain CoachEvidence into the wire
 * snapshot and parses it through the schema before returning — a parse
 * failure means THIS mapper drifted from the contract, not bad input.
 * `policyLimits` keys are renamed SCREAMING→camelCase by mapping the
 * embedded reference; values are never duplicated here.
 */
export class CoachEvidenceSnapshotMapper {
  toSnapshot(evidence: CoachEvidence): CoachEvidenceSnapshot {
    return CoachEvidenceSnapshotSchema.parse({
      exerciseId: {
        exerciseType: evidence.exerciseId.exerciseType,
        variation: evidence.exerciseId.variation,
      },
      trend: evidence.trend,
      signals: evidence.signals.map((signal) => this.serializeSignal(signal)),
      policyLimits: this.serializePolicyLimits(evidence.policyLimits),
      windowConfidence: evidence.windowConfidence,
    });
  }

  private serializeSignal(signal: PerformanceSignal): SignalSnapshot {
    if (signal instanceof ProgressSignal) {
      return { kind: signal.kind, ...signal.evidence };
    }
    if (signal instanceof FatigueSignal) {
      return { kind: signal.kind, ...signal.evidence };
    }
    if (signal instanceof RegressionSignal) {
      return { kind: signal.kind, ...signal.evidence };
    }
    if (signal instanceof StagnationSignal) {
      return { kind: signal.kind, ...signal.evidence };
    }
    throw new DomainInvariantError('Unknown performance signal; cannot serialize evidence.');
  }

  private serializePolicyLimits(policy: typeof ProgressionPolicy): PolicyLimitsSnapshot {
    return {
      loadIncrementKg: policy.LOAD_INCREMENT_KG,
      loadIncrementLb: policy.LOAD_INCREMENT_LB,
      repIncrement: policy.REP_INCREMENT,
      fatigueLoadReductionPct: policy.FATIGUE_LOAD_REDUCTION_PCT,
      volumeReductionSets: policy.VOLUME_REDUCTION_SETS,
      volumeFlatTolerancePct: policy.VOLUME_FLAT_TOLERANCE_PCT,
      repsFlatTolerance: policy.REPS_FLAT_TOLERANCE,
      repRangeTop: policy.REP_RANGE_TOP,
      progressRirMax: policy.PROGRESS_RIR_MAX,
      fatigueRirMin: policy.FATIGUE_RIR_MIN,
    };
  }
}
