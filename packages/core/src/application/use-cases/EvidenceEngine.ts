import { ExerciseHistoryRepository } from '../ports/ExerciseHistoryRepository.js';
import { ExerciseNotFoundError } from '../../domain/errors/DomainErrors.js';
import { ExerciseId } from '../../domain/exercise/ExerciseId.js';
import { ExerciseProgression } from '../../domain/exercise/ExerciseProgression.js';
import { Session } from '../../domain/exercise/Session.js';
import { CoachEvidence } from '../../domain/boundary/CoachEvidence.js';
import { ProgressionPolicy } from '../../domain/recommendation/ProgressionPolicy.js';
import { TrendAnalyzer } from '../../domain/services/TrendAnalyzer.js';
import { SessionInterpreter } from '../../domain/services/SessionInterpreter.js';
import { SignalDetector } from '../../domain/services/SignalDetector.js';
import { ProgressSignal } from '../../domain/signals/ProgressSignal.js';
import { AthleteProfile } from '../../domain/value-objects/AthleteProfile.js';
import { PROGRESSION_WINDOW_SIZE } from './ProgressionWindow.js';

/** Builds the use case once the consumer supplies a history port and optional profile. */
export type EvidenceEngineFactory = (
  history: ExerciseHistoryRepository,
  profile?: AthleteProfile,
) => EvidenceEngine;

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
    private readonly sessionInterpreter: SessionInterpreter,
    private readonly trendAnalyzer: TrendAnalyzer,
    private readonly signalDetector: SignalDetector,
    private readonly athleteProfile?: AthleteProfile,
  ) {}

  async produceEvidence(exerciseId: ExerciseId): Promise<CoachEvidence> {
    const exercise = await this.history.getExercise(exerciseId);
    if (exercise === null) {
      throw new ExerciseNotFoundError(exerciseId.toString());
    }

    const sessions = await this.history.getRecentSessions(exerciseId, EvidenceEngine.WINDOW_SIZE);
    const progression = new ExerciseProgression(this.chronological(sessions));
    const performances = this.sessionInterpreter.interpret(progression.sessions);
    const trend = this.trendAnalyzer.classifyTrend(performances);
    const signals = this.signalDetector.detect(performances, trend);

    const progress = signals.find((s): s is ProgressSignal => s instanceof ProgressSignal);

    return {
      exerciseId,
      trend,
      signals,
      policyLimits: ProgressionPolicy,
      windowConfidence: progression.windowConfidence(),
      evidenceAt: new Date(),
      completeness: progress?.evidence.rirInAllSessions === true ? 'full' : 'partial',
      ...(this.athleteProfile !== undefined && { athleteProfile: this.athleteProfile }),
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
