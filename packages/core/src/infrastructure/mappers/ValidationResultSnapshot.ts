import { z } from 'zod';
import { ValidationResult } from '../../domain/boundary/ValidationResult.js';
import { DecisionMagnitudeSchema } from './TrainingProposalSchema.js';

/**
 * Outbound boundary schema for ValidationResult. The result is domain-trusted;
 * the Zod parse here is the WIRE-CONTRACT guarantee for external consumers.
 *
 * `expected`/`actual` are `z.unknown().optional()`: rule (b) coherence
 * violations carry no `expected` payload and rule-specific payloads vary, so
 * the contract certifies presence-if-given without constraining content.
 */
export const ViolationSnapshotSchema = z.object({
  code: z.enum([
    'magnitude_exceeds_limit',
    'action_invalid_for_signal',
    'confidence_mismatch',
    'policy_violation',
    'magnitude_below_minimum',
  ]),
  message: z.string().min(1),
  field: z.enum(['action', 'magnitude', 'confidence']),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
});

export const ValidationResultSnapshotSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('valid') }),
  z.object({
    status: z.literal('adjusted'),
    adjustedMagnitude: DecisionMagnitudeSchema,
    violations: z.array(ViolationSnapshotSchema),
  }),
  z.object({
    status: z.literal('rejected'),
    violations: z.array(ViolationSnapshotSchema),
  }),
]);

export type ViolationSnapshot = z.infer<typeof ViolationSnapshotSchema>;
export type ValidationResultSnapshot = z.infer<typeof ValidationResultSnapshotSchema>;

/**
 * Outbound boundary mapper: the domain tri-state is already snapshot-shaped,
 * so the mapper certifies it through the schema — a parse failure means the
 * domain result drifted from the wire contract, not bad input.
 */
export class ValidationResultSnapshotMapper {
  toSnapshot(result: ValidationResult): ValidationResultSnapshot {
    return ValidationResultSnapshotSchema.parse(result);
  }
}
