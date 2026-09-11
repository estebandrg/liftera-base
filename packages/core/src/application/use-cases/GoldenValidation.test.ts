import { describe, it, expect } from 'vitest';
import {
  container,
  CoreTokens,
  RecommendNextSessionFactory,
  ExerciseHistoryRepository,
  Exercise,
  ExerciseId,
  Session,
  LoggedSet,
  Load,
  Reps,
  RIR,
  RecommendationSnapshotMapper,
} from '../../index.js';

// ─── Helpers ───────────────────────────────────────────────────────────

/** Build a Session from plain numbers — the story notation. */
const session = (
  day: number,
  sets: { weight: number; unit: 'kg' | 'lb'; reps: number; rir?: number }[],
): Session =>
  new Session(
    sets.map(
      (s) =>
        new LoggedSet(
          new Load(s.weight, s.unit),
          new Reps(s.reps),
          s.rir !== undefined ? new RIR(s.rir) : undefined,
        ),
    ),
    new Date(`2026-08-${day.toString().padStart(2, '0')}`),
  );

class FakeExerciseHistoryRepository implements ExerciseHistoryRepository {
  private readonly exercises = new Map<string, Exercise>();
  private readonly sessionsByExercise = new Map<string, Session[]>();

  seed(exercise: Exercise, sessions: Session[]): void {
    const key = this.key(exercise.id);
    this.exercises.set(key, exercise);
    this.sessionsByExercise.set(key, sessions);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | null> {
    return this.exercises.get(this.key(id)) ?? null;
  }

  async getRecentSessions(id: ExerciseId, limit: number): Promise<Session[]> {
    const all = this.sessionsByExercise.get(this.key(id)) ?? [];
    return all.slice(-limit);
  }

  private key(id: ExerciseId): string {
    return `${id.exerciseType}::${id.variation}`;
  }
}

/** Run the full pipeline for a scenario and return the snapshot. */
const decide = async (sessions: Session[]) => {
  const id = new ExerciseId('Barbell Bench Press', 'Flat');
  const repo = new FakeExerciseHistoryRepository();
  repo.seed(new Exercise(id), sessions);

  const factory = container.resolve<RecommendNextSessionFactory>(CoreTokens.recommendNextSession);
  const useCase = factory(repo);
  const recommendation = await useCase.execute(id);
  return new RecommendationSnapshotMapper().toSnapshot(recommendation);
};

// ─── Golden Validation — Coach Scenarios ───────────────────────────────

describe('Golden Validation — coach scenarios derived from business-rules.md', () => {
  // ── 1. Progresión automática (Business Rule #1) ─────────────────────
  describe('Scenario 1: Linear progression — novice hitting the rep ceiling', () => {
    it('recommends a load increase with HIGH confidence when the athlete repeatedly hits the top of the rep range with adequate RIR', async () => {
      const sessions_ = [
        session(1, [{ weight: 60, unit: 'kg', reps: 10, rir: 3 }]),
        session(2, [{ weight: 60, unit: 'kg', reps: 11, rir: 2 }]),
        session(3, [{ weight: 60, unit: 'kg', reps: 12, rir: 2 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You hit 12 reps with 2 RIR two sessions in a row. Add 2.5 kg."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 2.5,
        unit: 'kg',
        reason:
          'Increase load by 2.5 kg. Volume rose 20% across the window and the last session ended with 2 reps in reserve.',
        confidence: 'high',
      });
    });
  });

  // ── 2. Progresión automática en libras ──────────────────────────────
  describe('Scenario 2: Linear progression in pounds', () => {
    it('uses the 5 lb plate increment when the athlete is ready to go up', async () => {
      const sessions_ = [
        session(1, [{ weight: 135, unit: 'lb', reps: 10, rir: 2 }]),
        session(2, [{ weight: 135, unit: 'lb', reps: 11, rir: 2 }]),
        session(3, [{ weight: 135, unit: 'lb', reps: 12, rir: 1 }]),
      ];

      const snapshot = await decide(sessions_);

      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 5,
        unit: 'lb',
        reason:
          'Increase load by 5 lb. Volume rose 20% across the window and the last session ended with 1 reps in reserve.',
        confidence: 'high',
      });
    });
  });

  // ── 3. Estancamiento en rango medio (Business Rule #2) ──────────────
  describe('Scenario 3: Stagnation in the middle of the rep range', () => {
    it('recommends adding 1 rep when load, reps and volume have been flat for 3 sessions', async () => {
      const sessions_ = [
        session(1, [{ weight: 80, unit: 'kg', reps: 8, rir: 2 }]),
        session(2, [{ weight: 80, unit: 'kg', reps: 8, rir: 3 }]),
        session(3, [{ weight: 80, unit: 'kg', reps: 8, rir: 2 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You are stuck at 8 reps. Try to get 9 next time."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseReps',
        magnitude: 1,
        unit: undefined,
        reason:
          'Add 1 rep per set at your current load. Load, reps, and volume stayed flat across 3 sessions.',
        confidence: 'medium',
      });
    });
  });

  // ── 4. Estancamiento en techo de rango ──────────────────────────────
  describe('Scenario 4: Stagnation at the top of the rep range', () => {
    it('recommends a load increase when the athlete is stuck at 12 reps', async () => {
      const sessions_ = [
        session(1, [{ weight: 70, unit: 'kg', reps: 12, rir: 2 }]),
        session(2, [{ weight: 70, unit: 'kg', reps: 12, rir: 2 }]),
        session(3, [{ weight: 70, unit: 'kg', reps: 12, rir: 1 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You are maxing out the rep range. Time to add weight."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 2.5,
        unit: 'kg',
        reason: 'Increase load by 2.5 kg. Load, reps, and volume stayed flat across 3 sessions.',
        confidence: 'medium',
      });
    });
  });

  // ── 5. Fatiga real con declive (Business Rule #2 & #3) ──────────────
  describe('Scenario 5: Real fatigue — declining volume + rising RIR', () => {
    it('recommends a load reduction when the athlete is losing reps while effort is dropping (high RIR)', async () => {
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10, rir: 2 }]),
        session(2, [{ weight: 100, unit: 'kg', reps: 9, rir: 3 }]),
        session(3, [{ weight: 100, unit: 'kg', reps: 8, rir: 5 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You are failing to complete reps and leaving more in the tank.
      // That is fatigue, not a bad day. Reduce load 10% and recover."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'decreaseLoad',
        magnitude: -10,
        reason: 'Reduce load by 10%. Volume fell 20% while effort stayed high (RIR 5).',
        confidence: 'medium',
      });
    });
  });

  // ── 6. Regresión sin datos de esfuerzo (Business Rule #2) ───────────
  describe('Scenario 6: Regression with no effort data logged', () => {
    it('flags regression (not fatigue) when volume drops but RIR was never recorded', async () => {
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10 }]),
        session(2, [{ weight: 100, unit: 'kg', reps: 9 }]),
        session(3, [{ weight: 100, unit: 'kg', reps: 8 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "Something is wrong — reps are dropping.
      // I cannot tell if it is fatigue because you did not log RIR. Back off 10%."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'decreaseLoad',
        magnitude: -10,
        reason: 'Reduce load by 10%. Volume fell 20% with no effort data logged.',
        confidence: 'medium',
      });
    });
  });

  // ── 7. Progreso sin RIR (Business Rule #1 & #5) ─────────────────────
  describe('Scenario 7: Progress without RIR — objective improvement, subjective data missing', () => {
    it('recommends adding reps with MEDIUM confidence when volume rises but no RIR is available', async () => {
      const sessions_ = [
        session(1, [{ weight: 80, unit: 'kg', reps: 10 }]),
        session(2, [{ weight: 80, unit: 'kg', reps: 11 }]),
        session(3, [{ weight: 80, unit: 'kg', reps: 12 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "Reps climbed to the top of the range even without RIR logged.
      // The objective trend is clear. Add weight, but start logging RIR for better guidance."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 2.5,
        unit: 'kg',
        reason: 'Increase load by 2.5 kg. Volume rose 20% across the window.',
        confidence: 'medium',
      });
    });
  });

  // ── 8. Ausencia de señales — esfuerzo moderado (Business Rule #1) ───
  describe('Scenario 8: No signal — moderate effort stops progression detection', () => {
    it('recommends maintaining the plan when volume rises but RIR stays moderate (3)', async () => {
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10, rir: 3 }]),
        session(2, [{ weight: 100, unit: 'kg', reps: 11, rir: 3 }]),
        session(3, [{ weight: 100, unit: 'kg', reps: 12, rir: 3 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "Reps went up, but you are leaving 3 reps in reserve every time.
      // That is not real progress, you are just getting better at leaving reps.
      // Keep the weight and push closer to failure."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'maintain',
        magnitude: undefined,
        unit: undefined,
        reason: 'Keep the current plan. No clear progression pattern in the recent window.',
        confidence: 'low',
      });
    });
  });

  // ── 9. Múltiples sets — progresión de volumen (Business Rule #4) ────
  describe('Scenario 9: Multi-set volume progression', () => {
    it('detects progress when total volume rises across 3 sessions with multiple sets', async () => {
      const sessions_ = [
        session(1, [
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
        ]),
        session(2, [
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
          { weight: 80, unit: 'kg', reps: 11, rir: 2 },
        ]),
        session(3, [
          { weight: 80, unit: 'kg', reps: 11, rir: 2 },
          { weight: 80, unit: 'kg', reps: 11, rir: 2 },
        ]),
      ];

      const snapshot = await decide(sessions_);

      // Volume: 1600 -> 1680 -> 1760 = +10%
      // Top-set reps: 10 -> 11 -> 11 (< 12)
      // Coach would say: "Good volume progression. Push for another rep."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseReps',
        magnitude: 1,
        unit: undefined,
        reason:
          'Add 1 rep per set at your current load. Volume rose 10% across the window and the last session ended with 2 reps in reserve.',
        confidence: 'high',
      });
    });
  });

  // ── 10. Datos insuficientes (Business Rule #9) ──────────────────────
  describe('Scenario 10: Insufficient data — single session', () => {
    it('returns insufficient_data when only one session exists', async () => {
      const sessions_ = [session(1, [{ weight: 100, unit: 'kg', reps: 10, rir: 2 }])];

      const snapshot = await decide(sessions_);

      // Coach would say: "I need at least two sessions to see a trend. Log another workout."
      expect(snapshot).toEqual({
        status: 'insufficient_data',
        reason: 'Need at least 2 logged sessions to recommend; got 1.',
        confidence: 'insufficient',
      });
    });
  });

  // ── 11. Dos sesiones — confianza baja (Business Rule #9) ────────────
  describe('Scenario 11: Two sessions — detectable but low-confidence progress', () => {
    it('recommends load increase with LOW confidence when the window is only 2 sessions', async () => {
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10, rir: 2 }]),
        session(2, [{ weight: 100, unit: 'kg', reps: 12, rir: 2 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You jumped from 10 to 12 reps in one session.
      // That is promising, but two sessions is not enough to be sure.
      // Try the new weight — low confidence means we will reassess quickly."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 2.5,
        unit: 'kg',
        reason:
          'Increase load by 2.5 kg. Volume rose 20% across the window and the last session ended with 2 reps in reserve.',
        confidence: 'low',
      });
    });
  });

  // ── 12. PR de volumen con RIR perfecto (Business Rule #5) ───────────
  describe('Scenario 12: Volume PR with controlled effort — high-confidence load bump', () => {
    it('recommends load increase with HIGH confidence when the athlete hits a volume PR with RIR <= 2 in every session', async () => {
      const sessions_ = [
        session(1, [{ weight: 90, unit: 'kg', reps: 8, rir: 2 }]),
        session(2, [{ weight: 90, unit: 'kg', reps: 10, rir: 2 }]),
        session(3, [{ weight: 90, unit: 'kg', reps: 12, rir: 1 }]),
      ];

      const snapshot = await decide(sessions_);

      // Volume: 720 -> 900 -> 1080 = +50%
      // RIR in all sessions, last = 1
      // Coach would say: "You crushed it — new volume PR with 1 RIR.
      // You are ready for more weight."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseLoad',
        magnitude: 2.5,
        unit: 'kg',
        reason:
          'Increase load by 2.5 kg. Volume rose 50% across the window and the last session ended with 1 reps in reserve.',
        confidence: 'high',
      });
    });
  });

  // ── 13. Fatiga con deload en multi-set (Business Rule #3) ───────────
  describe('Scenario 13: Multi-set fatigue — failing to complete sets with rising RIR', () => {
    it('recommends a deload when the athlete drops sets and reps while RIR climbs', async () => {
      const sessions_ = [
        session(1, [
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
          { weight: 80, unit: 'kg', reps: 10, rir: 2 },
        ]),
        session(2, [
          { weight: 80, unit: 'kg', reps: 10, rir: 3 },
          { weight: 80, unit: 'kg', reps: 9, rir: 3 },
          { weight: 80, unit: 'kg', reps: 8, rir: 4 },
        ]),
        session(3, [
          { weight: 80, unit: 'kg', reps: 9, rir: 4 },
          { weight: 80, unit: 'kg', reps: 8, rir: 5 },
          { weight: 80, unit: 'kg', reps: 6, rir: 6 },
        ]),
      ];

      const snapshot = await decide(sessions_);

      // Volume: 2400 -> 2160 -> 1840 = -23.3%
      // last effective RIR = 5 (mean of 4,5,6)
      // Coach would say: "You are falling apart across sets. Classic overreaching.
      // Drop load 10% this week."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'decreaseLoad',
        magnitude: -10,
        reason: 'Reduce load by 10%. Volume fell 23.3% while effort stayed high (RIR 4).',
        confidence: 'medium',
      });
    });
  });

  // ── 14. Regresión con RIR bajo — no es fatiga (Business Rule #2) ────
  describe('Scenario 14: Regression with low RIR — the athlete is trying hard but still losing', () => {
    it('classifies as regression (not fatigue) when RIR is low despite dropping volume', async () => {
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10, rir: 1 }]),
        session(2, [{ weight: 100, unit: 'kg', reps: 9, rir: 1 }]),
        session(3, [{ weight: 100, unit: 'kg', reps: 8, rir: 2 }]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "You are grinding hard but still losing reps.
      // This is not fatigue — you are not leaving reps in reserve.
      // Something else is wrong: sleep, nutrition, stress. Back off 10%."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'decreaseLoad',
        magnitude: -10,
        reason: 'Reduce load by 10%. Volume fell 20% with RIR 2.',
        confidence: 'medium',
      });
    });
  });

  // ── 15. Tendencia estable sin señales — volumen dentro de tolerancia ─
  describe('Scenario 15: Stable trend with no clear signal — maintain plan', () => {
    it('recommends maintaining when volume stays within the flat tolerance band', async () => {
      // Volume drift of exactly 2.5% should still be classified as stable.
      const sessions_ = [
        session(1, [{ weight: 100, unit: 'kg', reps: 10 }]),
        session(2, [
          { weight: 100, unit: 'kg', reps: 10 },
          { weight: 12.5, unit: 'kg', reps: 1 },
        ]),
        session(3, [
          { weight: 100, unit: 'kg', reps: 10 },
          { weight: 25, unit: 'kg', reps: 1 },
        ]),
      ];

      const snapshot = await decide(sessions_);

      // Coach would say: "Volume is flat within the noise band and load has not moved.
      // That is stagnation. Push for one more rep next time."
      expect(snapshot).toEqual({
        status: 'ok',
        action: 'increaseReps',
        magnitude: 1,
        unit: undefined,
        reason:
          'Add 1 rep per set at your current load. Load, reps, and volume stayed flat across 3 sessions.',
        confidence: 'medium',
      });
    });
  });
});
