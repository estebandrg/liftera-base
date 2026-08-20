import { describe, it, expect } from 'vitest';
import { ProgressionPolicy } from './ProgressionPolicy.js';

describe('ProgressionPolicy', () => {
  it('fixes the agreed policy constants', () => {
    expect(ProgressionPolicy.LOAD_INCREMENT_KG).toBe(2.5);
    expect(ProgressionPolicy.LOAD_INCREMENT_LB).toBe(5);
    expect(ProgressionPolicy.REP_INCREMENT).toBe(1);
    expect(ProgressionPolicy.FATIGUE_LOAD_REDUCTION_PCT).toBe(10);
    expect(ProgressionPolicy.VOLUME_REDUCTION_SETS).toBe(1);
    expect(ProgressionPolicy.VOLUME_FLAT_TOLERANCE_PCT).toBe(2.5);
    expect(ProgressionPolicy.REPS_FLAT_TOLERANCE).toBe(1);
    expect(ProgressionPolicy.REP_RANGE_TOP).toBe(12);
    expect(ProgressionPolicy.PROGRESS_RIR_MAX).toBe(2);
    expect(ProgressionPolicy.FATIGUE_RIR_MIN).toBe(4);
  });
});
