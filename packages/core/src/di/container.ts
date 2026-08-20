import { SessionInterpreter } from '../domain/services/SessionInterpreter.js';
import { TrendAnalyzer } from '../domain/services/TrendAnalyzer.js';
import { DecisionEngine } from '../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../domain/services/RecommendationEngine.js';
import {
  RecommendNextSession,
  RecommendNextSessionFactory,
} from '../application/use-cases/RecommendNextSession.js';

export class DIContainer {
  private registry = new Map<string, unknown>();

  register<T>(token: string, implementation: T): void {
    this.registry.set(token, implementation);
  }

  resolve<T>(token: string): T {
    const instance = this.registry.get(token);
    if (!instance) {
      throw new Error(`No registration found for token: ${token}`);
    }
    return instance as T;
  }
}

/**
 * String tokens for the core decision-cycle registrations. The history
 * port is consumer-supplied, so the use case is registered as a factory
 * that closes over the container's pipeline services.
 */
export const CoreTokens = {
  sessionInterpreter: 'core.sessionInterpreter',
  trendAnalyzer: 'core.trendAnalyzer',
  decisionEngine: 'core.decisionEngine',
  recommendationEngine: 'core.recommendationEngine',
  recommendNextSession: 'core.recommendNextSession',
} as const;

export const container = new DIContainer();

container.register(CoreTokens.sessionInterpreter, new SessionInterpreter());
container.register(CoreTokens.trendAnalyzer, new TrendAnalyzer());
container.register(CoreTokens.decisionEngine, new DecisionEngine());
container.register(CoreTokens.recommendationEngine, new RecommendationEngine());

const recommendNextSessionFactory: RecommendNextSessionFactory = (history) =>
  new RecommendNextSession(
    history,
    container.resolve<TrendAnalyzer>(CoreTokens.trendAnalyzer),
    container.resolve<DecisionEngine>(CoreTokens.decisionEngine),
    container.resolve<RecommendationEngine>(CoreTokens.recommendationEngine),
  );
container.register(CoreTokens.recommendNextSession, recommendNextSessionFactory);
