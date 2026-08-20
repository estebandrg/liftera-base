import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { ExerciseProgression } from '../../domain/exercise/ExerciseProgression.js';
import { Session } from '../../domain/exercise/Session.js';
import { Recommendation } from '../../domain/recommendation/Recommendation.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';
import { DecisionEngine } from '../../domain/services/DecisionEngine.js';
import { RecommendationEngine } from '../../domain/services/RecommendationEngine.js';

/** Builds a use case once the consumer supplies a history port. */
export type RecommendNextSessionFactory = (
  history: ExerciseHistoryRepository,
) => RecommendNextSession;

/**
 * Orchestrates the decision cycle for one exercise: fetch history, build
 * the progression window, run the stateless pipeline, return a
 * Recommendation. The only exception it throws is `ExerciseNotFoundError`;
 * expected outcomes (including `insufficient_data`) are result variants.
 */
export class RecommendNextSession {
  /** Sessions analyzed per recommendation — the progression window size. */
  static readonly WINDOW_SIZE = 3;

  constructor(
    private readonly history: ExerciseHistoryRepository,
    private readonly trendAnalyzer: TrendAnalyzer,
    private readonly decisionEngine: DecisionEngine,
    private readonly recommendationEngine: RecommendationEngine,
  ) {}

  async execute(exerciseId: ExerciseId): Promise<Recommendation> {
    const exercise = await this.history.getExercise(exerciseId);
    if (exercise === null) {
      throw new ExerciseNotFoundError(exerciseId.toString());
    }

    const sessions = await this.history.getRecentSessions(
      exerciseId,
      RecommendNextSession.WINDOW_SIZE,
    );
    const progression = new ExerciseProgression(this.chronological(sessions));

    // A window under 2 sessions cannot support a recommendation — the
    // pipeline never runs. This is an expected outcome, not an error.
    if (progression.sessions.length < 2) {
      return {
        status: 'insufficient_data',
        confidence: progression.windowConfidence(),
        reason: `Need at least 2 logged sessions to recommend; got ${progression.sessions.length}.`,
      };
    }

    const { trend, signals } = this.trendAnalyzer.analyze(progression.sessions);
    const decision = this.decisionEngine.recommend(signals, trend);
    return this.recommendationEngine.translate(decision);
  }

  /**
   * The port defines "recent", not order; the window invariant requires
   * oldest-first. Normalizing here keeps the boundary honest.
   */
  private chronological(sessions: Session[]): Session[] {
    return [...sessions].sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }
}
