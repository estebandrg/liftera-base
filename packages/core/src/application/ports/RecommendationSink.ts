import { AppliedRecommendation } from '../../domain/boundary/ValidationResult.js';

export interface RecommendationSink {
  record(applied: AppliedRecommendation): Promise<void>;
}
