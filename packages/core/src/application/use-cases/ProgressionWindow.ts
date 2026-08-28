/**
 * Sessions fetched and analyzed per decision-cycle run — the progression
 * window. Shared by every use case that builds an `ExerciseProgression` so
 * the window can never drift between recommendation and evidence.
 */
export const PROGRESSION_WINDOW_SIZE = 3;
