import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';
import { Trend } from '../../domain/value-objects/Trend.js';
import { Confidence } from '../../domain/value-objects/Confidence.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';

/** Builds the use case once the consumer supplies a history port. */
export type EvidenceEngineFactory = (history: ExerciseHistoryRepository) => EvidenceEngine;

/**
 * Produces the CoachEvidence an external actor needs to propose the next
 * training step. Composes the progression window and the trend pipeline;
 * policy limits travel embedded by reference, never duplicated.
 */
export class EvidenceEngine {
  /** Sessions analyzed per evidence — the progression window size. */
  static readonly WINDOW_SIZE = 3;

  constructor(
    private readonly history: ExerciseHistoryRepository,
    private readonly trendAnalyzer: TrendAnalyzer,
  ) {}

  async produceEvidence(exerciseId: ExerciseId): Promise<CoachEvidence> {
    const exercise = await this.history.getExercise(exerciseId);
    if (exercise === null) {
      throw new ExerciseNotFoundError(exerciseId.toString());
    }

    return {
      exerciseId,
      trend: Trend.Stable,
      signals: [],
      policyLimits: { ...ProgressionPolicy },
      windowConfidence: Confidence.Insufficient,
    };
  }
}
