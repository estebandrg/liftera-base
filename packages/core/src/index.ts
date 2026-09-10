// Composition root
export { container, DIContainer, CoreTokens } from './di/container.js';

// Application: the use cases, tool port, and their outbound port
export {
  RecommendNextSession,
  RecommendNextSessionFactory,
} from './application/use-cases/RecommendNextSession.js';
export { EvidenceEngine, EvidenceEngineFactory } from './application/use-cases/EvidenceEngine.js';
export {
  RunProgressionCycle,
  RunProgressionCycleResult,
} from './application/use-cases/RunProgressionCycle.js';
export { ExerciseHistoryRepository } from './application/ports/ExerciseHistoryRepository.js';
export { CoachTools } from './application/ports/CoachTools.js';
export { RecommendationSink } from './application/ports/RecommendationSink.js';
export { InMemoryRecommendationSink } from './application/ports/InMemoryRecommendationSink.js';
export { ProposalGenerator } from './application/ports/ProposalGenerator.js';
export { CoreCoachTools, CoachToolsFactory } from './application/CoreCoachTools.js';

// Boundary: snapshot schema, mappers, and wire types (sole Zod site)
export {
  WorkoutSnapshotSchema,
  WorkoutSnapshot,
  ExerciseSnapshot,
  LoggedSetSnapshot,
} from './infrastructure/mappers/WorkoutSnapshot.js';
export { WorkoutSnapshotMapper } from './infrastructure/mappers/WorkoutSnapshotMapper.js';
export {
  RecommendationSnapshotMapper,
  RecommendationSnapshot,
} from './infrastructure/mappers/RecommendationSnapshotMapper.js';
export {
  DecisionMagnitudeSchema,
  DecisionMagnitudeSnapshot,
  TrainingProposalSchema,
  TrainingProposalSnapshot,
  TrainingProposalMapper,
} from './infrastructure/mappers/TrainingProposalSchema.js';
export {
  LastEffectiveRirSnapshotSchema,
  ProgressSignalSnapshotSchema,
  FatigueSignalSnapshotSchema,
  RegressionSignalSnapshotSchema,
  StagnationSignalSnapshotSchema,
  SignalSnapshotSchema,
  SignalSnapshot,
  PolicyLimitsSnapshotSchema,
  PolicyLimitsSnapshot,
  CoachEvidenceSnapshotSchema,
  CoachEvidenceSnapshot,
  CoachEvidenceSnapshotMapper,
} from './infrastructure/mappers/CoachEvidenceSnapshot.js';
export {
  ViolationSnapshotSchema,
  ViolationSnapshot,
  ValidationResultSnapshotSchema,
  ValidationResultSnapshot,
  ValidationResultSnapshotMapper,
} from './infrastructure/mappers/ValidationResultSnapshot.js';

// Boundary domain: the contracts every external actor flows through
export { CoachEvidence } from './domain/boundary/CoachEvidence.js';
export {
  TrainingProposal,
  ProposalSource,
  ProposalIntent,
} from './domain/boundary/TrainingProposal.js';
export {
  ValidationResult,
  Violation,
  ViolationCode,
  AppliedRecommendation,
} from './domain/boundary/ValidationResult.js';
export { ProposalValidator } from './domain/boundary/ProposalValidator.js';
export { ProgressionEngine } from './domain/services/ProgressionEngine.js';

// Domain surface a consumer needs to implement the port and read results
export { Exercise } from './domain/exercise/Exercise.js';
export { ExerciseId } from './domain/exercise/ExerciseId.js';
export { ExerciseProgression } from './domain/exercise/ExerciseProgression.js';
export { Session } from './domain/exercise/Session.js';
export { LoggedSet } from './domain/exercise/LoggedSet.js';
export { Load, LoadUnit } from './domain/value-objects/Load.js';
export { Reps } from './domain/value-objects/Reps.js';
export { RIR } from './domain/value-objects/RIR.js';
export { Volume } from './domain/value-objects/Volume.js';
export { Confidence } from './domain/value-objects/Confidence.js';
export {
  Recommendation,
  ActionableRecommendation,
  InsufficientData,
} from './domain/recommendation/Recommendation.js';
export { DecisionAction, DecisionMagnitude } from './domain/recommendation/Decision.js';
export {
  DomainInvariantError,
  BoundaryValidationError,
  ExerciseNotFoundError,
  PersistenceNotWiredError,
} from './domain/errors/DomainErrors.js';
