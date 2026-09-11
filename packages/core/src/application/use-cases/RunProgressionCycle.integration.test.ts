import { describe, it, expect } from 'vitest';
import { RunProgressionCycle } from './RunProgressionCycle.js';
import { CoreCoachTools } from '../CoreCoachTools.js';
import { EvidenceEngine } from './EvidenceEngine.js';
import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { InMemoryRecommendationSink } from '../ports/InMemoryRecommendationSink.js';
import { AIMock } from '../../test-support/AIMock.js';
import { ProposalGenerator } from '../ports/ProposalGenerator.js';
import { Exercise } from '../../domain/exercise/Exercise.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { Session } from '../../domain/exercise/Session.js';
import { LoggedSet } from '../../domain/exercise/LoggedSet.js';
import { Load } from '../../domain/value-objects/Load.js';
import { Reps } from '../../domain/value-objects/Reps.js';
import { RIR } from '../../domain/value-objects/RIR.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';
import { SessionInterpreter } from '../../domain/services/SessionInterpreter.js';
import { SignalDetector } from '../../domain/services/SignalDetector.js';
import { ProposalValidator } from '../../domain/boundary/ProposalValidator.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';

class FakeExerciseHistoryRepository implements ExerciseHistoryRepository {
  private readonly exercises = new Map<string, Exercise>();
  private readonly sessionsByExercise = new Map<string, Session[]>();

  seed(exercise: Exercise, sessions: Session[]): void {
    const key = this.key(exercise.id);
    this.exercises.set(key, exercise);
    this.sessionsByExercise.set(key, sessions);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | null> {
    return this.exercises.get(this.key(id)) ?? null;
  }

  async getRecentSessions(id: ExerciseId, limit: number): Promise<Session[]> {
    const all = this.sessionsByExercise.get(this.key(id)) ?? [];
    return all.slice(-limit);
  }

  private key(id: ExerciseId): string {
    return `${id.exerciseType}::${id.variation}`;
  }
}

const benchPressId = new ExerciseId('Barbell Bench Press', 'Flat');

const sessionOn = (day: number, kg: number, reps: number, rir?: number): Session =>
  new Session(
    [
      new LoggedSet(
        new Load(kg, 'kg'),
        new Reps(reps),
        rir !== undefined ? new RIR(rir) : undefined,
      ),
    ],
    new Date(`2026-08-${day.toString().padStart(2, '0')}`),
  );

const buildCycle = (history: FakeExerciseHistoryRepository, proposalSource: ProposalGenerator) => {
  const sink = new InMemoryRecommendationSink();
  const engine = new EvidenceEngine(
    history,
    new SessionInterpreter(),
    new TrendAnalyzer(),
    new SignalDetector(),
  );
  const validator = new ProposalValidator();
  const tools = new CoreCoachTools(engine, validator, sink);
  return { cycle: new RunProgressionCycle(history, tools, proposalSource), sink };
};

describe('RunProgressionCycle — evidence flow', () => {
  it('populates evidenceAt and completeness=full when RIR is in all sessions', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 3),
      sessionOn(2, 100, 11, 2),
      sessionOn(3, 100, 12, 2),
    ]);

    let capturedEvidence: CoachEvidence | undefined;
    const capturingSource: ProposalGenerator = {
      propose: (evidence) => {
        capturedEvidence = evidence;
        return {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
          justification: 'Capture.',
          confidence: Confidence.Medium,
        };
      },
    };

    const { cycle } = buildCycle(history, capturingSource);
    await cycle.execute(benchPressId);

    expect(capturedEvidence).toBeDefined();
    expect(capturedEvidence!.evidenceAt).toBeInstanceOf(Date);
    expect(capturedEvidence!.completeness).toBe('full');
  });

  it('populates completeness=partial when RIR is missing in some sessions', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 3),
      sessionOn(2, 100, 11), // no RIR
      sessionOn(3, 100, 12, 2),
    ]);

    let capturedEvidence: CoachEvidence | undefined;
    const capturingSource: ProposalGenerator = {
      propose: (evidence) => {
        capturedEvidence = evidence;
        return {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
          justification: 'Capture.',
          confidence: Confidence.Medium,
        };
      },
    };

    const { cycle } = buildCycle(history, capturingSource);
    await cycle.execute(benchPressId);

    expect(capturedEvidence).toBeDefined();
    expect(capturedEvidence!.completeness).toBe('partial');
  });
});

describe('RunProgressionCycle — happy path', () => {
  it('applies a valid proposal and records it in the sink', async () => {
    const history = new FakeExerciseHistoryRepository();
    // Three progressing sessions → improving trend + progress signal
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 3),
      sessionOn(2, 100, 11, 2),
      sessionOn(3, 100, 12, 2),
    ]);

    const proposalSource: ProposalGenerator = new AIMock([
      {
        match: (evidence) =>
          evidence.trend === 'improving' && evidence.signals.some((s) => s.kind === 'progress'),
        proposal: {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
          justification: 'Happy path proposal.',
          confidence: Confidence.Medium,
        },
      },
    ]);

    const { cycle, sink } = buildCycle(history, proposalSource);

    const result = await cycle.execute(benchPressId);

    expect(result.status).toBe('applied');
    if (result.status !== 'rejected') {
      expect(result.exerciseId).toEqual(benchPressId);
      expect(result.proposal.action).toBe('increaseLoad');
      expect(result.validation.status).toBe('valid');
      expect(result.appliedAt).toBeInstanceOf(Date);
    }

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].exerciseId).toEqual(benchPressId);
    expect(sink.records[0].proposal.action).toBe('increaseLoad');
    expect(sink.records[0].validation.status).toBe('valid');
  });
});

describe('RunProgressionCycle — barbarity cases', () => {
  it('clamps an excessive magnitude and records the adjusted outcome', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 3),
      sessionOn(2, 100, 11, 2),
      sessionOn(3, 100, 12, 2),
    ]);

    const proposalSource: ProposalGenerator = new AIMock([
      {
        match: (evidence) =>
          evidence.trend === 'improving' && evidence.signals.some((s) => s.kind === 'progress'),
        proposal: {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 50, unit: 'kg' },
          justification: 'Excessive magnitude.',
          confidence: Confidence.Medium,
        },
      },
    ]);

    const { cycle, sink } = buildCycle(history, proposalSource);

    const result = await cycle.execute(benchPressId);

    expect(result.status).toBe('adjusted');
    if (result.status !== 'rejected') {
      expect(result.validation.status).toBe('adjusted');
      if (result.validation.status === 'adjusted') {
        expect(result.validation.adjustedMagnitude).toEqual({
          kind: 'load',
          value: 2.5,
          unit: 'kg',
        });
        expect(result.validation.violations[0].code).toBe('magnitude_exceeds_limit');
      }
    }

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].validation.status).toBe('adjusted');
    if (sink.records[0].validation.status === 'adjusted') {
      expect(sink.records[0].validation.adjustedMagnitude).toEqual({
        kind: 'load',
        value: 2.5,
        unit: 'kg',
      });
      expect(sink.records[0].proposal.magnitude).toEqual({ kind: 'load', value: 50, unit: 'kg' });
    }
  });

  it('rejects an opposite-direction proposal and creates NO sink record', async () => {
    const history = new FakeExerciseHistoryRepository();
    // Declining volume with high RIR → fatigue signal + declining trend
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 5),
      sessionOn(2, 100, 9, 5),
      sessionOn(3, 100, 8, 5),
    ]);

    const proposalSource: ProposalGenerator = new AIMock([
      {
        match: (evidence) => evidence.signals.some((s) => s.kind === 'fatigue'),
        proposal: {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
          justification: 'Opposite direction.',
          confidence: Confidence.Medium,
        },
      },
    ]);

    const { cycle, sink } = buildCycle(history, proposalSource);

    const result = await cycle.execute(benchPressId);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected' && result.validation.status === 'rejected') {
      expect(result.validation.violations.some((v) => v.code === 'action_invalid_for_signal')).toBe(
        true,
      );
    }
    expect(sink.records).toHaveLength(0);
  });

  it('rejects an overclaimed-confidence proposal and creates NO sink record', async () => {
    const history = new FakeExerciseHistoryRepository();
    // Progressing window but missing RIR in one session → progress signal with rirInAllSessions=false
    history.seed(new Exercise(benchPressId), [
      sessionOn(1, 100, 10, 3),
      sessionOn(2, 100, 11), // no RIR
      sessionOn(3, 100, 12, 2),
    ]);

    const proposalSource: ProposalGenerator = new AIMock([
      {
        match: (evidence) =>
          evidence.trend === 'improving' && evidence.signals.some((s) => s.kind === 'progress'),
        proposal: {
          source: 'ai',
          intent: 'progress',
          action: 'increaseLoad',
          magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
          justification: 'Overclaimed confidence.',
          confidence: Confidence.High,
        },
      },
    ]);

    const { cycle, sink } = buildCycle(history, proposalSource);

    const result = await cycle.execute(benchPressId);

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected' && result.validation.status === 'rejected') {
      expect(result.validation.violations.some((v) => v.code === 'confidence_mismatch')).toBe(true);
    }
    expect(sink.records).toHaveLength(0);
  });
});
