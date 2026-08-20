/**
 * Progression policy constants for the decision cycle.
 * Centralized so the pipeline never carries magic numbers.
 */
export const ProgressionPolicy = {
  LOAD_INCREMENT_KG: 2.5,
  LOAD_INCREMENT_LB: 5,
  REP_INCREMENT: 1,
  FATIGUE_LOAD_REDUCTION_PCT: 10,
  VOLUME_REDUCTION_SETS: 1,
  VOLUME_FLAT_TOLERANCE_PCT: 2.5,
  REPS_FLAT_TOLERANCE: 1,
  REP_RANGE_TOP: 12,
  PROGRESS_RIR_MAX: 2,
  FATIGUE_RIR_MIN: 4,
} as const;
