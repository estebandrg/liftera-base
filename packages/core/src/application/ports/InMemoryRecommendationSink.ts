import { RecommendationSink } from './RecommendationSink.js';
import { AppliedRecommendation } from '../../domain/boundary/ValidationResult.js';

export class InMemoryRecommendationSink implements RecommendationSink {
  private _records: AppliedRecommendation[] = [];

  get records(): readonly AppliedRecommendation[] {
    return Object.freeze([...this._records]);
  }

  async record(applied: AppliedRecommendation): Promise<void> {
    this._records.push(applied);
  }

  clear(): void {
    this._records = [];
  }
}
