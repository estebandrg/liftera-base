import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { ExerciseProgression } from '../../domain/exercise/ExerciseProgression.js';
import { Session } from '../../domain/exercise/Session.js';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';
import { PROGRESSION_WINDOW_SIZE } from './ProgressionWindow.js';

/** Builds the use case once the consumer supplies a history port. */
export type EvidenceEngineFactory = (history: ExerciseHistoryRepository) => EvidenceEngine;

/**
 * Produces the CoachEvidence an external actor needs to propose the next
 * training step. Composes the progression window and the trend pipeline;
 * policy limits travel embedded by reference, never duplicated.
 */
export class EvidenceEngine {
  /** Sessions analyzed per evidence — the progression window size. */
  static readonly WINDOW_SIZE = PROGRESSION_WINDOW_SIZE;

  constructor(
    private readonly history: ExerciseHistoryRepository,
    private readonly trendAnalyzer: TrendAnalyzer,
  ) {}

  async produceEvidence(exerciseId: ExerciseId): Promise<CoachEvidence> {
    const exercise = await this.history.getExercise(exerciseId);
    if (exercise === null) {
      throw new ExerciseNotFoundError(exerciseId.toString());
    }

    const sessions = await this.history.getRecentSessions(exerciseId, EvidenceEngine.WINDOW_SIZE);
    const progression = new ExerciseProgression(this.chronological(sessions));
    const { trend, signals } = this.trendAnalyzer.analyze(progression.sessions);

    return {
      exerciseId,
      trend,
      signals,
      policyLimits: ProgressionPolicy,
      windowConfidence: progression.windowConfidence(),
    };
  }

  /**
   * The port defines "recent", not order; the window invariant requires
   * oldest-first. Normalizing here keeps the boundary honest.
   */
  private chronological(sessions: Session[]): Session[] {
    return [...sessions].sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }
}
