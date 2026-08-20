import { describe, it, expect } from 'vitest';
import { container, DIContainer, CoreTokens } from './container.js';
import { SessionInterpreter } from '../domain/services/SessionInterpreter.js';
import { TrendAnalyzer } from '../domain/services/TrendAnalyzer.js';
import { DecisionEngine } from '../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../domain/services/RecommendationEngine.js';
import {
  RecommendNextSession,
  RecommendNextSessionFactory,
} from '../application/use-cases/RecommendNextSession.js';
import { ExerciseHistoryRepository } from '../application/ports/ExerciseHistoryRepository.js';
import { Exercise } from '../domain/exercise/Exercise.js';
import { ExerciseId } from '../domain/exercise/ExerciseId.js';
import { Session } from '../domain/exercise/Session.js';
import { LoggedSet } from '../domain/exercise/LoggedSet.js';
import { Load } from '../domain/value-objects/Load.js';
import { Reps } from '../domain/value-objects/Reps.js';
import { RIR } from '../domain/value-objects/RIR.js';

describe('DIContainer', () => {
  it('should register and resolve a dependency', () => {
    const dep = { value: 42 };
    container.register('answer', dep);
    expect(container.resolve('answer')).toBe(dep);
  });

  it('should throw when resolving unregistered token', () => {
    const fresh = new DIContainer();
    expect(() => fresh.resolve('missing')).toThrow('No registration found for token: missing');
  });
});

describe('core registrations', () => {
  it('resolves the stateless pipeline services by token', () => {
    expect(container.resolve(CoreTokens.sessionInterpreter)).toBeInstanceOf(SessionInterpreter);
    expect(container.resolve(CoreTokens.trendAnalyzer)).toBeInstanceOf(TrendAnalyzer);
    expect(container.resolve(CoreTokens.decisionEngine)).toBeInstanceOf(DecisionEngine);
    expect(container.resolve(CoreTokens.recommendationEngine)).toBeInstanceOf(RecommendationEngine);
  });

  it('resolves the same service instance on repeated resolves', () => {
    expect(container.resolve(CoreTokens.trendAnalyzer)).toBe(
      container.resolve(CoreTokens.trendAnalyzer),
    );
  });

  it('resolves a use case factory that wires the pipeline around a consumer-supplied port', async () => {
    const squatId = new ExerciseId('Back Squat', 'Low Bar');
    const sessionOn = (day: number, reps: number, rir: number): Session =>
      new Session(
        [new LoggedSet(new Load(140, 'kg'), new Reps(reps), new RIR(rir))],
        new Date(`2026-08-${day.toString().padStart(2, '0')}`),
      );
    const fakeHistory: ExerciseHistoryRepository = {
      async getExercise() {
        return new Exercise(squatId);
      },
      async getRecentSessions() {
        return [sessionOn(1, 10, 3), sessionOn(2, 11, 2), sessionOn(3, 12, 2)];
      },
    };

    const factory = container.resolve<RecommendNextSessionFactory>(CoreTokens.recommendNextSession);
    const useCase = factory(fakeHistory);

    expect(useCase).toBeInstanceOf(RecommendNextSession);
    const recommendation = await useCase.execute(squatId);
    expect(recommendation.status).toBe('ok');
  });
});
