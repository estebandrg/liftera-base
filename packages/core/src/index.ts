// Composition root
export { container, DIContainer, CoreTokens } from './di/container.js';

// Application: the use case and its outbound port
export {
  RecommendNextSession,
  RecommendNextSessionFactory,
} from './application/use-cases/RecommendNextSession.js';
export { ExerciseHistoryRepository } from './application/ports/ExerciseHistoryRepository.js';

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
} from './domain/errors/DomainErrors.js';
