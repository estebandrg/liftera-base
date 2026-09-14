import { describe, it, expect, vi } from 'vitest';
import { CoreCoachTools } from './CoreCoachTools.js';
import { EvidenceEngine } from './use-cases/EvidenceEngine.js';
import { ExerciseHistoryRepository } from './ports/ExerciseHistoryRepository.js';
import { InMemoryRecommendationSink } from './ports/InMemoryRecommendationSink.js';
import { DomainInvariantError, ExerciseNotFoundError } from '../domain/errors/DomainErrors.js';
import { CoachEvidence } from '../domain/boundary/CoachEvidence.js';
import { ProposalValidator } from '../domain/boundary/ProposalValidator.js';
import { TrainingProposal } from '../domain/boundary/TrainingProposal.js';
import { ValidationResult, ViolationCode } from '../domain/boundary/ValidationResult.js';
import { Exercise } from '../domain/exercise/Exercise.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';
import { LoggedSet } from '../domain/exercise/LoggedSet.js';
import { Session } from '../domain/exercise/Session.js';
import { ProgressionPolicy } from '../domain/recommendation/ProgressionPolicy.js';
import { TrendAnalyzer } from '../domain/services/TrendAnalyzer.js';
import { SessionInterpreter } from '../domain/services/SessionInterpreter.js';
import { SignalDetector } from '../domain/services/SignalDetector.js';
import { Confidence } from '../domain/value-objects/Confidence.js';
import { Load } from '../domain/value-objects/Load.js';
import { Reps } from '../domain/value-objects/Reps.js';
import { RIR } from '../domain/value-objects/RIR.js';
import { Trend } from '../domain/value-objects/Trend.js';
import { AthleteProfile } from '../domain/value-objects/AthleteProfile.js';

/**
 * In-memory fake of the history port (RecommendNextSession.test.ts pattern).
 * No mocks: the engine and validator under the tools are the real ones.
 */
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

const sessionOn = (day: number): Session =>
  new Session(
    [new LoggedSet(new Load(100, 'kg'), new Reps(10), new RIR(2))],
    new Date(`2026-08-${day.toString().padStart(2, '0')}`),
  );

// Neutral evidence: no signals (no coherence restriction), stable trend,
// high window confidence so a medium proposal confidence stays below the
// floor. Tests override what they need (ProposalValidator.test.ts pattern).
const evidence = (overrides: Partial<CoachEvidence> = {}): CoachEvidence => ({
  exerciseId: benchPressId,
  trend: Trend.Stable,
  signals: [],
  policyLimits: ProgressionPolicy,
  windowConfidence: Confidence.High,
  ...overrides,
});

const proposal = (overrides: Partial<TrainingProposal> = {}): TrainingProposal => ({
  source: 'ai',
  intent: 'progress',
  action: 'increaseLoad',
  magnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  justification: 'Evidence-backed proposal.',
  confidence: Confidence.Medium,
  ...overrides,
});

const VIOLATION_FIELD: Record<ViolationCode, 'action' | 'magnitude' | 'confidence'> = {
  policy_violation: 'magnitude',
  action_invalid_for_signal: 'action',
  magnitude_exceeds_limit: 'magnitude',
  magnitude_below_minimum: 'magnitude',
  confidence_mismatch: 'confidence',
  limitation_violation: 'action',
};

const rejected = (code: ViolationCode): ValidationResult => ({
  status: 'rejected',
  violations: [{ code, message: `Rejected by ${code}.`, field: VIOLATION_FIELD[code] }],
});

const valid: ValidationResult = { status: 'valid' };

const adjusted: ValidationResult = {
  status: 'adjusted',
  adjustedMagnitude: { kind: 'load', value: 2.5, unit: 'kg' },
  violations: [
    {
      code: 'magnitude_exceeds_limit',
      message: 'Magnitude 5 exceeds the policy limit 2.5; clamped to the limit.',
      field: 'magnitude',
      expected: 2.5,
      actual: 5,
    },
  ],
};

const buildTools = (history: ExerciseHistoryRepository, sink?: InMemoryRecommendationSink) => {
  const engine = new EvidenceEngine(
    history,
    new SessionInterpreter(),
    new TrendAnalyzer(),
    new SignalDetector(),
  );
  const validator = new ProposalValidator();
  return { tools: new CoreCoachTools(engine, validator, sink), engine, validator };
};

describe('CoreCoachTools — applyRecommendation guard', () => {
  it('throws DomainInvariantError when the validation is rejected', async () => {
    const { tools } = buildTools(new FakeExerciseHistoryRepository());

    await expect(
      tools.applyRecommendation(benchPressId, proposal(), rejected('policy_violation')),
    ).rejects.toThrow(DomainInvariantError);
  });

  it('guards any rejecting violation code and names the exercise', async () => {
    const { tools } = buildTools(new FakeExerciseHistoryRepository());

    const apply = tools.applyRecommendation(
      benchPressId,
      proposal(),
      rejected('confidence_mismatch'),
    );

    await expect(apply).rejects.toThrow(DomainInvariantError);
    await expect(apply).rejects.toThrow('Barbell Bench Press (Flat)');
  });
});

describe('CoreCoachTools — applyRecommendation sink recording', () => {
  it('records a valid validation through the injected sink', async () => {
    const sink = new InMemoryRecommendationSink();
    const { tools } = buildTools(new FakeExerciseHistoryRepository(), sink);
    const p = proposal();

    await tools.applyRecommendation(benchPressId, p, valid);

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].exerciseId).toBe(benchPressId);
    expect(sink.records[0].proposal).toEqual(p);
    expect(sink.records[0].validation).toEqual(valid);
    expect(sink.records[0].appliedAt).toBeInstanceOf(Date);
  });

  it('records an adjusted validation preserving the full trace', async () => {
    const sink = new InMemoryRecommendationSink();
    const { tools } = buildTools(new FakeExerciseHistoryRepository(), sink);
    const p = proposal();

    await tools.applyRecommendation(benchPressId, p, adjusted);

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0].proposal).toEqual(p);
    expect(sink.records[0].validation).toEqual(adjusted);
    if (sink.records[0].validation.status === 'adjusted') {
      expect(sink.records[0].validation.adjustedMagnitude).toEqual({
        kind: 'load',
        value: 2.5,
        unit: 'kg',
      });
      expect(sink.records[0].validation.violations[0].code).toBe('magnitude_exceeds_limit');
    }
  });

  it('does NOT record when the validation is rejected', async () => {
    const sink = new InMemoryRecommendationSink();
    const { tools } = buildTools(new FakeExerciseHistoryRepository(), sink);

    await expect(
      tools.applyRecommendation(benchPressId, proposal(), rejected('policy_violation')),
    ).rejects.toThrow(DomainInvariantError);

    expect(sink.records).toHaveLength(0);
  });

  it('resolves silently when no sink is injected (backward compatibility)', async () => {
    const { tools } = buildTools(new FakeExerciseHistoryRepository());

    await expect(
      tools.applyRecommendation(benchPressId, proposal(), valid),
    ).resolves.toBeUndefined();
  });
});

describe('CoreCoachTools — getCoachEvidence delegation', () => {
  it('returns the evidence the engine produces for the requested exercise', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [sessionOn(1)]);
    const { tools, engine } = buildTools(history);
    const produceSpy = vi.spyOn(engine, 'produceEvidence');

    const result = await tools.getCoachEvidence(benchPressId);

    expect(produceSpy).toHaveBeenCalledOnce();
    expect(produceSpy).toHaveBeenCalledWith(benchPressId);
    expect(result.exerciseId).toBe(benchPressId);
    expect(result.policyLimits).toBe(ProgressionPolicy);
    // One seeded session ⇒ insufficient window confidence: proves the real
    // engine derivation flowed out, not a stubbed evidence literal.
    expect(result.windowConfidence).toBe(Confidence.Insufficient);
  });

  it('surfaces ExerciseNotFoundError from the engine untouched', async () => {
    const { tools } = buildTools(new FakeExerciseHistoryRepository());

    await expect(tools.getCoachEvidence(benchPressId)).rejects.toThrow(ExerciseNotFoundError);
  });
});

describe('CoreCoachTools — validateProposal delegation', () => {
  it('returns the validator verdict for the given proposal and evidence', async () => {
    const { tools, validator } = buildTools(new FakeExerciseHistoryRepository());
    const validateSpy = vi.spyOn(validator, 'validate');
    const overCeiling = proposal({ magnitude: { kind: 'load', value: 5, unit: 'kg' } });
    const neutralEvidence = evidence();

    const result = await tools.validateProposal(overCeiling, neutralEvidence);

    expect(validateSpy).toHaveBeenCalledOnce();
    expect(validateSpy).toHaveBeenCalledWith(overCeiling, neutralEvidence);
    // Passthrough: the port returns exactly what the validator computes.
    expect(result).toEqual(new ProposalValidator().validate(overCeiling, neutralEvidence));
    expect(result.status).toBe('adjusted');
  });

  it('is pure and stateless: frozen inputs, repeatable result, no engine access', async () => {
    const { tools, engine } = buildTools(new FakeExerciseHistoryRepository());
    const produceSpy = vi.spyOn(engine, 'produceEvidence');
    const frozenProposal = Object.freeze(proposal());
    const frozenEvidence = Object.freeze(evidence());

    const first = await tools.validateProposal(frozenProposal, frozenEvidence);
    const second = await tools.validateProposal(frozenProposal, frozenEvidence);

    // Frozen inputs throw on any mutation attempt (strict mode): reaching
    // this line proves no side effect on the inputs.
    expect(first).toEqual(second);
    expect(first.status).toBe('valid');
    expect(produceSpy).not.toHaveBeenCalled();
  });
});

describe('CoreCoachTools — profile propagation', () => {
  it('forwards profile through the factory so evidence carries it', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [sessionOn(1)]);
    const profile = new AthleteProfile({ limitations: ['bench press'] });

    const engine = new EvidenceEngine(
      history,
      new SessionInterpreter(),
      new TrendAnalyzer(),
      new SignalDetector(),
      profile,
    );
    const tools = new CoreCoachTools(engine, new ProposalValidator());

    const result = await tools.getCoachEvidence(benchPressId);

    expect(result.athleteProfile).toBe(profile);
  });
});
