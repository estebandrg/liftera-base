import { z, ZodError } from 'zod';
import { BoundaryValidationError } from '../../domain/errors/DomainErrors.js';
import { TrainingProposal } from '../../domain/boundary/TrainingProposal.js';

/**
 * Inbound boundary schema for a TrainingProposal from ANY external actor
 * (AI, user, system, external import). Validation lives at the edge: the
 * schema enforces SHAPE only — policy semantics (clamping, coherence,
 * confidence floor) belong to the domain ProposalValidator.
 *
 * Unknown keys are stripped (Zod default object mode), not rejected:
 * producers may add fields over time without breaking this consumer.
 */
export const DecisionMagnitudeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('load'), value: z.number(), unit: z.enum(['kg', 'lb']) }),
  z.object({ kind: z.literal('loadPercent'), percent: z.number() }),
  z.object({ kind: z.literal('reps'), value: z.number() }),
  z.object({ kind: z.literal('sets'), value: z.number() }),
  z.object({ kind: z.literal('none') }),
]);

export const TrainingProposalSchema = z.object({
  source: z.enum(['ai', 'user', 'system', 'external']),
  intent: z.enum(['progress', 'conservative_progress', 'deload', 'maintain', 'evaluate_change']),
  action: z.enum([
    'increaseLoad',
    'increaseReps',
    'maintain',
    'decreaseLoad',
    'decreaseVolume',
    'evaluateChange',
  ]),
  magnitude: DecisionMagnitudeSchema,
  justification: z.string().min(1),
  confidence: z.enum(['insufficient', 'low', 'medium', 'high']),
});

export type DecisionMagnitudeSnapshot = z.infer<typeof DecisionMagnitudeSchema>;
export type TrainingProposalSnapshot = z.infer<typeof TrainingProposalSchema>;

/**
 * Inbound boundary mapper. Validates the untrusted payload with Zod and
 * only then hands a domain TrainingProposal to the caller — a rejected
 * payload throws BoundaryValidationError before any domain code runs.
 */
export class TrainingProposalMapper {
  fromSnapshot(input: unknown): TrainingProposal {
    const parsed = TrainingProposalSchema.safeParse(input);
    if (!parsed.success) {
      throw new BoundaryValidationError(this.formatIssues(parsed.error));
    }
    return parsed.data;
  }

  /** Aggregates every issue with its nested path — never just the first. */
  private formatIssues(error: ZodError): string {
    const details = error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    return `Invalid TrainingProposal: ${details}`;
  }
}
