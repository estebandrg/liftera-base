import { describe, it, expect } from 'vitest';
import { TrainingProposalSchema, TrainingProposalMapper } from './TrainingProposalSchema.js';
import { BoundaryValidationError } from '../../domain/errors/DomainErrors.js';
import { DomainInvariantError } from '../../domain/errors/DomainErrors.js';

const validProposal = {
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Top set reps hit the range top with RIR 1 across the window.',
  confidence: 'medium',
};

const expectBoundaryError = (input: unknown): BoundaryValidationError => {
  try {
    new TrainingProposalMapper().fromSnapshot(input);
  } catch (error) {
    expect(error).toBeInstanceOf(BoundaryValidationError);
    // Boundary validation must fire before any domain construction.
    expect(error).not.toBeInstanceOf(DomainInvariantError);
    return error as BoundaryValidationError;
  }
  throw new Error('expected fromSnapshot to throw BoundaryValidationError');
};

describe('TrainingProposalSchema.safeParse — malformed payloads rejected', () => {
  it('rejects a payload missing action', () => {
    const withoutAction: Record<string, unknown> = { ...validProposal };
    delete withoutAction.action;

    const result = TrainingProposalSchema.safeParse(withoutAction);

    expect(result.success).toBe(false);
  });

  it('rejects a magnitude union edge: kind load without unit', () => {
    const result = TrainingProposalSchema.safeParse({
      ...validProposal,
      magnitude: { kind: 'load', value: 2.5 },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty justification', () => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, justification: '' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown source', () => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, source: 'coach' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown action', () => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, action: 'maxOut' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown confidence', () => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, confidence: 'certain' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown intent', () => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, intent: 'bulk' });

    expect(result.success).toBe(false);
  });
});

describe('TrainingProposalSchema.safeParse — unknown keys stripped', () => {
  it('strips unknown root and nested keys and parses the rest', () => {
    const result = TrainingProposalSchema.safeParse({
      ...validProposal,
      foo: 1,
      magnitude: { kind: 'load', value: 2.5, unit: 'kg', tempo: '2-0-2' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect('foo' in result.data).toBe(false);
      expect('tempo' in result.data.magnitude).toBe(false);
      expect(result.data.source).toBe('ai');
      expect(result.data.magnitude).toEqual({ kind: 'load', value: 2.5, unit: 'kg' });
    }
  });
});

describe('TrainingProposalSchema.safeParse — every magnitude variant', () => {
  it.each([
    { magnitude: { kind: 'load', value: 5, unit: 'lb' }, action: 'increaseLoad' },
    { magnitude: { kind: 'loadPercent', percent: -10 }, action: 'decreaseLoad' },
    { magnitude: { kind: 'reps', value: 1 }, action: 'increaseReps' },
    { magnitude: { kind: 'sets', value: -1 }, action: 'decreaseVolume' },
    { magnitude: { kind: 'none' }, action: 'maintain' },
  ])('parses $magnitude.kind for action $action', ({ magnitude, action }) => {
    const result = TrainingProposalSchema.safeParse({ ...validProposal, action, magnitude });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.magnitude).toEqual(magnitude);
      expect(result.data.action).toBe(action);
    }
  });

  it('rejects a load magnitude with an unknown unit', () => {
    const result = TrainingProposalSchema.safeParse({
      ...validProposal,
      magnitude: { kind: 'load', value: 2.5, unit: 'stone' },
    });

    expect(result.success).toBe(false);
  });
});

describe('TrainingProposalSchema.safeParse — provenance support', () => {
  it('parses a proposal with provenance and preserves source, intent, evidenceRefs', () => {
    const result = TrainingProposalSchema.safeParse({
      ...validProposal,
      provenance: {
        source: 'ai',
        intent: 'conservative_progress',
        evidenceRefs: ['decreaseVolume:percent=-20'],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provenance).toEqual({
        source: 'ai',
        intent: 'conservative_progress',
        evidenceRefs: ['decreaseVolume:percent=-20'],
      });
    }
  });

  it('strips unknown keys inside provenance while keeping known fields', () => {
    const result = TrainingProposalSchema.safeParse({
      ...validProposal,
      provenance: {
        source: 'ai',
        intent: 'progress',
        evidenceRefs: ['ref-1'],
        reasoning: 'extra field that should be stripped',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect('reasoning' in result.data.provenance!).toBe(false);
      expect(result.data.provenance!.evidenceRefs).toEqual(['ref-1']);
    }
  });

  it('parses a proposal without provenance successfully', () => {
    const result = TrainingProposalSchema.safeParse(validProposal);

    expect(result.success).toBe(true);
    if (result.success) {
      expect('provenance' in result.data).toBe(false);
    }
  });
});

describe('TrainingProposalMapper.fromSnapshot', () => {
  it('maps a valid payload to a domain TrainingProposal', () => {
    const proposal = new TrainingProposalMapper().fromSnapshot(validProposal);

    expect(proposal).toEqual({
      source: 'ai',
      intent: 'progress',
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
      justification: 'Top set reps hit the range top with RIR 1 across the window.',
      confidence: 'medium',
    });
  });

  it('throws BoundaryValidationError with the failing path on invalid input', () => {
    const error = expectBoundaryError({ ...validProposal, justification: '' });

    expect(error.message).toContain('justification');
  });

  it('aggregates issues instead of failing on the first', () => {
    const error = expectBoundaryError({ source: 'coach', intent: 'bulk' });

    expect(error.message).toContain('source');
    expect(error.message).toContain('intent');
    expect(error.message).toContain('action');
  });
});
