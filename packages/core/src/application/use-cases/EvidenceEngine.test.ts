import { describe, it, expect } from 'vitest';
import { EvidenceEngine } from './EvidenceEngine.js';
import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { Exercise } from '../../domain/exercise/Exercise.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { Session } from '../../domain/exercise/Session.js';
import { LoggedSet } from '../../domain/exercise/LoggedSet.js';
import { Load } from '../../domain/value-objects/Load.js';
import { Reps } from '../../domain/value-objects/Reps.js';
import { RIR } from '../../domain/value-objects/RIR.js';
import { Trend } from '../../domain/value-objects/Trend.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';
import { ProgressSignal } from '../../domain/signals/ProgressSignal.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';

/**
 * In-memory fake of the history port (GoldenValidation pattern): async at
 * the boundary, no mocks, no spies.
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

const sessionOn = (day: number, sets: LoggedSet[]): Session =>
  new Session(sets, new Date(`2026-08-${day.toString().padStart(2, '0')}`));

const topSetOnly = (day: number, kg: number, reps: number, rir?: number): Session =>
  sessionOn(day, [
    new LoggedSet(new Load(kg, 'kg'), new Reps(reps), rir !== undefined ? new RIR(rir) : undefined),
  ]);

const buildEngine = (history: ExerciseHistoryRepository): EvidenceEngine =>
  new EvidenceEngine(history, new TrendAnalyzer());

describe('EvidenceEngine — exercise lookup', () => {
  it('throws ExerciseNotFoundError when the repository has no such exercise', async () => {
    const engine = buildEngine(new FakeExerciseHistoryRepository());

    await expect(engine.produceEvidence(benchPressId)).rejects.toThrow(ExerciseNotFoundError);
    await expect(engine.produceEvidence(benchPressId)).rejects.toThrow(
      'Exercise not found: Barbell Bench Press (Flat)',
    );
  });

  it('produces evidence carrying the requested exercise id when the exercise exists', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.exerciseId).toEqual(benchPressId);
  });
});

describe('EvidenceEngine — progression window', () => {
  it('maps a single session to insufficient window confidence', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.windowConfidence).toBe(Confidence.Insufficient);
  });

  it('maps two sessions to low window confidence', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 100, 10, 2),
      topSetOnly(2, 100, 11, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.windowConfidence).toBe(Confidence.Low);
  });

  it('maps three sessions to medium window confidence', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 100, 10, 2),
      topSetOnly(2, 100, 11, 2),
      topSetOnly(3, 100, 12, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.windowConfidence).toBe(Confidence.Medium);
  });

  it('analyzes only the 3 most recent sessions when more history exists', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 50, 5, 0), // stale session — outside the window
      topSetOnly(2, 60, 10, 3),
      topSetOnly(3, 60, 11, 2),
      topSetOnly(4, 60, 12, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    // The window holds exactly the last 3 sessions: confidence medium, and
    // the progress signal measures 60→60 kg at 10→12 reps (+20%), not the
    // stale 50 kg session (4 sessions would blow the window invariant).
    expect(evidence.windowConfidence).toBe(Confidence.Medium);
    expect(evidence.trend).toBe(Trend.Improving);
    const progress = evidence.signals[0] as ProgressSignal;
    expect(progress).toBeInstanceOf(ProgressSignal);
    expect(progress.evidence.windowSize).toBe(3);
    expect(progress.evidence.volumeChangePct).toBeCloseTo(20, 5);
  });

  it('tolerates out-of-order sessions from the port by normalizing chronology', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(3, 60, 12, 2),
      topSetOnly(1, 60, 10, 3),
      topSetOnly(2, 60, 11, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    // Unsorted input would make ExerciseProgression throw; an improving
    // trend proves the window was ordered oldest-first before analysis.
    expect(evidence.trend).toBe(Trend.Improving);
  });
});

describe('EvidenceEngine — trend and signals', () => {
  it('composes TrendAnalyzer: progressing window yields improving trend with a progress signal', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 60, 10, 3),
      topSetOnly(2, 60, 11, 2),
      topSetOnly(3, 60, 12, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.trend).toBe(Trend.Improving);
    expect(evidence.signals).toHaveLength(1);
    const progress = evidence.signals[0] as ProgressSignal;
    expect(progress).toBeInstanceOf(ProgressSignal);
    expect(progress.evidence.rirInAllSessions).toBe(true);
    expect(progress.evidence.topSetReps).toBe(12);
    expect(progress.evidence.loadUnit).toBe('kg');
  });

  it('yields a stable trend with no signals when fewer than 2 sessions exist', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    expect(evidence.trend).toBe(Trend.Stable);
    expect(evidence.signals).toHaveLength(0);
  });
});

describe('EvidenceEngine — policy limits', () => {
  it('embeds policyLimits as the identical ProgressionPolicy reference', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [
      topSetOnly(1, 60, 10, 3),
      topSetOnly(2, 60, 11, 2),
      topSetOnly(3, 60, 12, 2),
    ]);
    const engine = buildEngine(history);

    const evidence = await engine.produceEvidence(benchPressId);

    // Reference identity, not structural equality: the policy stays a single
    // source of truth and drift between a copy and the const is impossible.
    expect(evidence.policyLimits).toBe(ProgressionPolicy);
    expect(evidence.policyLimits.LOAD_INCREMENT_KG).toBe(2.5);
  });

  it('reuses the same reference across calls instead of copying per evidence', async () => {
    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 2)]);
    const engine = buildEngine(history);

    const first = await engine.produceEvidence(benchPressId);
    const second = await engine.produceEvidence(benchPressId);

    expect(first.policyLimits).toBe(second.policyLimits);
  });
});
