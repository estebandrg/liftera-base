import { SessionInterpreter } from '../domain/services/SessionInterpreter.js';
import { TrendAnalyzer } from '../domain/services/TrendAnalyzer.js';
import { SignalDetector } from '../domain/services/SignalDetector.js';
import { DecisionEngine } from '../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../domain/services/RecommendationEngine.js';
import { ProgressionEngine } from '../domain/services/ProgressionEngine.js';
import {
  RecommendNextSession,
  RecommendNextSessionFactory,
} from '../application/use-cases/RecommendNextSession.js';
import { EvidenceEngine, EvidenceEngineFactory } from '../application/use-cases/EvidenceEngine.js';
import { CoreCoachTools, CoachToolsFactory } from '../application/CoreCoachTools.js';
import { InMemoryRecommendationSink } from '../application/ports/InMemoryRecommendationSink.js';
import { ProposalValidator } from '../domain/boundary/ProposalValidator.js';

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
 * String tokens for the core decision-cycle and coach-boundary
 * registrations. The history port is consumer-supplied, so use cases and
 * coach tools are registered as factories that close over the container's
 * pipeline services.
 */
export const CoreTokens = {
  sessionInterpreter: 'core.sessionInterpreter',
  trendAnalyzer: 'core.trendAnalyzer',
  signalDetector: 'core.signalDetector',
  decisionEngine: 'core.decisionEngine',
  recommendationEngine: 'core.recommendationEngine',
  progressionEngine: 'core.progressionEngine',
  recommendNextSession: 'core.recommendNextSession',
  proposalValidator: 'core.proposalValidator',
  evidenceEngine: 'core.evidenceEngine',
  coachTools: 'core.coachTools',
  recommendationSink: 'core.recommendationSink',
} as const;

export const container = new DIContainer();

container.register(CoreTokens.sessionInterpreter, new SessionInterpreter());
container.register(CoreTokens.trendAnalyzer, new TrendAnalyzer());
container.register(CoreTokens.signalDetector, new SignalDetector());
container.register(CoreTokens.decisionEngine, new DecisionEngine());
container.register(CoreTokens.recommendationEngine, new RecommendationEngine());
container.register(CoreTokens.progressionEngine, new ProgressionEngine());

const recommendNextSessionFactory: RecommendNextSessionFactory = (history) =>
  new RecommendNextSession(
    history,
    container.resolve<SessionInterpreter>(CoreTokens.sessionInterpreter),
    container.resolve<TrendAnalyzer>(CoreTokens.trendAnalyzer),
    container.resolve<SignalDetector>(CoreTokens.signalDetector),
    container.resolve<DecisionEngine>(CoreTokens.decisionEngine),
    container.resolve<RecommendationEngine>(CoreTokens.recommendationEngine),
  );
container.register(CoreTokens.recommendNextSession, recommendNextSessionFactory);

container.register(CoreTokens.proposalValidator, new ProposalValidator());
container.register(CoreTokens.recommendationSink, new InMemoryRecommendationSink());

const evidenceEngineFactory: EvidenceEngineFactory = (history) =>
  new EvidenceEngine(
    history,
    container.resolve<SessionInterpreter>(CoreTokens.sessionInterpreter),
    container.resolve<TrendAnalyzer>(CoreTokens.trendAnalyzer),
    container.resolve<SignalDetector>(CoreTokens.signalDetector),
  );
container.register(CoreTokens.evidenceEngine, evidenceEngineFactory);

const coachToolsFactory: CoachToolsFactory = (history) =>
  new CoreCoachTools(
    container.resolve<EvidenceEngineFactory>(CoreTokens.evidenceEngine)(history),
    container.resolve<ProposalValidator>(CoreTokens.proposalValidator),
    container.resolve<InMemoryRecommendationSink>(CoreTokens.recommendationSink),
  );
container.register(CoreTokens.coachTools, coachToolsFactory);
