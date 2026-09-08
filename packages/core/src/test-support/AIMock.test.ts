import { describe, it, expect } from 'vitest';
import { AIMock, AIMockRule } from './AIMock.js';
import { CoachEvidence } from '../domain/boundary/CoachEvidence.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';
import { Trend } from '../domain/value-objects/Trend.js';
import { Confidence } from '../domain/value-objects/Confidence.js';
import { ProgressionPolicy } from '../domain/recommendation/ProgressionPolicy.js';
import { ProgressSignal } from '../domain/signals/ProgressSignal.js';
import { FatigueSignal } from '../domain/signals/FatigueSignal.js';

const benchPressId = new ExerciseId('Barbell Bench Press', 'Flat');

const baseEvidence = (overrides: Partial<CoachEvidence> = {}): CoachEvidence => ({
  exerciseId: benchPressId,
  trend: Trend.Stable,
  signals: [],
  policyLimits: ProgressionPolicy,
  windowConfidence: Confidence.Medium,
  ...overrides,
});

const baseProposal = (overrides: Partial<TrainingProposal> = {}): TrainingProposal => ({
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Test proposal.',
  confidence: Confidence.Medium,
  ...overrides,
});

describe('AIMock — rule-table proposals', () => {
  it('returns the proposal of the first matching rule (valid proposal)', () => {
    const validProposal = baseProposal({
      action: 'decreaseLoad',
      magnitude: { kind: 'loadPercent', percent: -10 },
      intent: 'deload',
    });
    const rule: AIMockRule = {
      match: (evidence) => evidence.signals.some((s) => s instanceof FatigueSignal),
      proposal: validProposal,
    };
    const mock = new AIMock([rule]);

    const evidence = baseEvidence({
      trend: Trend.Declining,
      signals: [
        new FatigueSignal({
          loadUnit: 'kg',
          volumeChangePct: -10,
          topSetReps: 8,
          rirInAllSessions: false,
        }),
      ],
    });

    const result = mock.propose(evidence);

    expect(result).toEqual(validProposal);
  });

  it('returns a proposal with excessive magnitude when the rule says so', () => {
    const excessiveProposal = baseProposal({
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 50, unit: 'kg' },
    });
    const rule: AIMockRule = {
      match: (evidence) =>
        evidence.signals.some((s) => s instanceof ProgressSignal) &&
        evidence.trend === Trend.Improving,
      proposal: excessiveProposal,
    };
    const mock = new AIMock([rule]);

    const evidence = baseEvidence({
      trend: Trend.Improving,
      signals: [
        new ProgressSignal({
          loadUnit: 'kg',
          volumeChangePct: 20,
          topSetReps: 12,
          rirInAllSessions: true,
        }),
      ],
    });

    const result = mock.propose(evidence);

    expect(result.magnitude).toEqual({ kind: 'load', value: 50, unit: 'kg' });
  });

  it('returns a proposal with opposite-direction action when the rule says so', () => {
    const oppositeProposal = baseProposal({
      action: 'increaseLoad',
      magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
    });
    const rule: AIMockRule = {
      match: (evidence) => evidence.signals.some((s) => s instanceof FatigueSignal),
      proposal: oppositeProposal,
    };
    const mock = new AIMock([rule]);

    const evidence = baseEvidence({
      trend: Trend.Declining,
      signals: [
        new FatigueSignal({
          loadUnit: 'kg',
          volumeChangePct: -10,
          topSetReps: 8,
          rirInAllSessions: false,
        }),
      ],
    });

    const result = mock.propose(evidence);

    expect(result.action).toBe('increaseLoad');
  });

  it('returns a proposal with overclaimed confidence when the rule says so', () => {
    const overconfidentProposal = baseProposal({ confidence: Confidence.High });
    const rule: AIMockRule = {
      match: () => true,
      proposal: overconfidentProposal,
    };
    const mock = new AIMock([rule]);

    const evidence = baseEvidence({ windowConfidence: Confidence.Medium });

    const result = mock.propose(evidence);

    expect(result.confidence).toBe('high');
  });

  it('throws when no rule matches the evidence', () => {
    const mock = new AIMock([]);

    expect(() => mock.propose(baseEvidence())).toThrow('No AIMock rule matched');
  });
});
