import { describe, it, expect, vi, afterEach } from 'vitest';
import { EvidenceEngine } from './EvidenceEngine.js';
import { RecommendNextSession } from './RecommendNextSession.js';
import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
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
import { DecisionEngine } from '../../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../../domain/services/RecommendationEngine.js';

/**
 * Pipeline orchestration order proofs (verify follow-up). Every other test
 * in this package uses fakes with no spies; this file is the deliberate
 * exception: prototype spies keep real collaborator behavior while letting
 * us assert the interpret → classifyTrend → detect call order and the
 * referential hand-off between stages.
 */

class FakeExerciseHistoryRepository implements ExerciseHistoryRepository {
  private readonly exercises = new Map<string, Exercise>();
  private readonly sessionsByExercise = new Map<string, Session[]>();

  seed(exercise: Exercise, sessions: Session[]): void {
    const key = `${exercise.id.exerciseType}::${exercise.id.variation}`;
    this.exercises.set(key, exercise);
    this.sessionsByExercise.set(key, sessions);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | null> {
    return this.exercises.get(`${id.exerciseType}::${id.variation}`) ?? null;
  }

  async getRecentSessions(id: ExerciseId, limit: number): Promise<Session[]> {
    const all = this.sessionsByExercise.get(`${id.exerciseType}::${id.variation}`) ?? [];
    return all.slice(-limit);
  }
}

const benchPressId = new ExerciseId('Barbell Bench Press', 'Flat');

const topSetOnly = (day: number, kg: number, reps: number, rir?: number): Session =>
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

const progressingHistory = (): FakeExerciseHistoryRepository => {
  const history = new FakeExerciseHistoryRepository();
  history.seed(new Exercise(benchPressId), [
    topSetOnly(1, 100, 10, 3),
    topSetOnly(2, 100, 11, 3),
    topSetOnly(3, 100, 12, 2),
  ]);
  return history;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EvidenceEngine — pipeline orchestration', () => {
  it('runs interpret → classifyTrend → detect once each, in order, handing results by reference', async () => {
    const interpret = vi.spyOn(SessionInterpreter.prototype, 'interpret');
    const classifyTrend = vi.spyOn(TrendAnalyzer.prototype, 'classifyTrend');
    const detect = vi.spyOn(SignalDetector.prototype, 'detect');

    const engine = new EvidenceEngine(
      progressingHistory(),
      new SessionInterpreter(),
      new TrendAnalyzer(),
      new SignalDetector(),
    );

    const evidence = await engine.produceEvidence(benchPressId);

    expect(interpret).toHaveBeenCalledTimes(1);
    expect(classifyTrend).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledTimes(1);

    const performances = interpret.mock.results[0].value;
    const trend = classifyTrend.mock.results[0].value;
    expect(classifyTrend).toHaveBeenCalledWith(performances);
    expect(detect).toHaveBeenCalledWith(performances, trend);

    expect(interpret.mock.invocationCallOrder[0]).toBeLessThan(
      classifyTrend.mock.invocationCallOrder[0],
    );
    expect(classifyTrend.mock.invocationCallOrder[0]).toBeLessThan(
      detect.mock.invocationCallOrder[0],
    );

    expect(evidence.trend).toBe(trend);
    expect(evidence.signals).toBe(detect.mock.results[0].value);
  });
});

describe('RecommendNextSession — pipeline orchestration', () => {
  it('runs interpret → classifyTrend → detect → recommend → translate in order', async () => {
    const interpret = vi.spyOn(SessionInterpreter.prototype, 'interpret');
    const classifyTrend = vi.spyOn(TrendAnalyzer.prototype, 'classifyTrend');
    const detect = vi.spyOn(SignalDetector.prototype, 'detect');
    const recommend = vi.spyOn(DecisionEngine.prototype, 'recommend');
    const translate = vi.spyOn(RecommendationEngine.prototype, 'translate');

    const useCase = new RecommendNextSession(
      progressingHistory(),
      new SessionInterpreter(),
      new TrendAnalyzer(),
      new SignalDetector(),
      new DecisionEngine(),
      new RecommendationEngine(),
    );

    await useCase.execute(benchPressId);

    const performances = interpret.mock.results[0].value;
    const trend = classifyTrend.mock.results[0].value;
    const signals = detect.mock.results[0].value;
    const decision = recommend.mock.results[0].value;

    expect(classifyTrend).toHaveBeenCalledWith(performances);
    expect(detect).toHaveBeenCalledWith(performances, trend);
    expect(recommend).toHaveBeenCalledWith(signals, trend);
    expect(translate).toHaveBeenCalledWith(decision);

    const order = [
      interpret.mock.invocationCallOrder[0],
      classifyTrend.mock.invocationCallOrder[0],
      detect.mock.invocationCallOrder[0],
      recommend.mock.invocationCallOrder[0],
      translate.mock.invocationCallOrder[0],
    ];
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });

  it('never starts the pipeline when the window has fewer than 2 sessions', async () => {
    const interpret = vi.spyOn(SessionInterpreter.prototype, 'interpret');
    const classifyTrend = vi.spyOn(TrendAnalyzer.prototype, 'classifyTrend');
    const detect = vi.spyOn(SignalDetector.prototype, 'detect');

    const history = new FakeExerciseHistoryRepository();
    history.seed(new Exercise(benchPressId), [topSetOnly(1, 100, 10, 3)]);

    const useCase = new RecommendNextSession(
      history,
      new SessionInterpreter(),
      new TrendAnalyzer(),
      new SignalDetector(),
      new DecisionEngine(),
      new RecommendationEngine(),
    );

    const recommendation = await useCase.execute(benchPressId);

    expect(recommendation.status).toBe('insufficient_data');
    expect(interpret).not.toHaveBeenCalled();
    expect(classifyTrend).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
  });
});
