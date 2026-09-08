import { describe, it, expect } from 'vitest';
import { InMemoryRecommendationSink } from './InMemoryRecommendationSink.js';
import { AppliedRecommendation } from '../../domain/boundary/ValidationResult.js';
import { TrainingProposal } from '../../domain/boundary/TrainingProposal.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';

const benchPressId = new ExerciseId('Barbell Bench Press', 'Flat');

const proposal: TrainingProposal = {
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Test.',
  confidence: Confidence.Medium,
};

describe('InMemoryRecommendationSink', () => {
  it('starts empty', () => {
    const sink = new InMemoryRecommendationSink();

    expect(sink.records).toHaveLength(0);
  });

  it('records a valid applied recommendation', async () => {
    const sink = new InMemoryRecommendationSink();
    const applied: AppliedRecommendation = {
      exerciseId: benchPressId,
      proposal,
      validation: { status: 'valid' },
      appliedAt: new Date('2026-09-08T10:00:00.000Z'),
    };

    await sink.record(applied);

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toEqual(applied);
  });

  it('records an adjusted applied recommendation preserving the full trace', async () => {
    const sink = new InMemoryRecommendationSink();
    const applied: AppliedRecommendation = {
      exerciseId: benchPressId,
      proposal,
      validation: {
        status: 'adjusted',
        adjustedMagnitude: { kind: 'load', value: 2.5, unit: 'kg' },
        violations: [
          {
            code: 'magnitude_exceeds_limit',
            message: 'Clamped.',
            field: 'magnitude',
            expected: 2.5,
            actual: 50,
          },
        ],
      },
      appliedAt: new Date('2026-09-08T10:00:00.000Z'),
    };

    await sink.record(applied);

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].validation.status).toBe('adjusted');
    expect(sink.records[0].proposal).toEqual(proposal);
    if (sink.records[0].validation.status === 'adjusted') {
      expect(sink.records[0].validation.adjustedMagnitude).toEqual({
        kind: 'load',
        value: 2.5,
        unit: 'kg',
      });
      expect(sink.records[0].validation.violations[0].code).toBe('magnitude_exceeds_limit');
    }
  });

  it('exposes records as readonly (mutating the returned reference does not affect sink state)', async () => {
    const sink = new InMemoryRecommendationSink();
    const applied: AppliedRecommendation = {
      exerciseId: benchPressId,
      proposal,
      validation: { status: 'valid' },
      appliedAt: new Date(),
    };
    await sink.record(applied);

    const records = sink.records as AppliedRecommendation[];

    // Object.freeze ensures runtime immutability; the push throws.
    expect(() =>
      records.push({
        exerciseId: benchPressId,
        proposal,
        validation: { status: 'valid' },
        appliedAt: new Date(),
      }),
    ).toThrow();

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toEqual(applied);
  });

  it('clears all records', async () => {
    const sink = new InMemoryRecommendationSink();
    await sink.record({
      exerciseId: benchPressId,
      proposal,
      validation: { status: 'valid' },
      appliedAt: new Date(),
    });

    sink.clear();

    expect(sink.records).toHaveLength(0);
  });
});
