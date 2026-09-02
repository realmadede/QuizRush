/**
 * Modular scoring engine.
 * Swap `defaultScoring` for another strategy to change how points are awarded.
 */
export interface ScoreInput {
  isCorrect: boolean;
  /** Base points configured on the question */
  basePoints: number;
  /** Milliseconds between question start and the answer being received */
  responseMs: number;
  /** Question time limit in milliseconds */
  timeLimitMs: number;
}

export type ScoringStrategy = (input: ScoreInput) => number;

/**
 * Correct answers earn between 50% and 100% of the question points,
 * scaled linearly by how quickly the player answered. Wrong answers earn 0.
 */
export const defaultScoring: ScoringStrategy = ({
  isCorrect,
  basePoints,
  responseMs,
  timeLimitMs,
}) => {
  if (!isCorrect) return 0;
  const limit = Math.max(1, timeLimitMs);
  const used = Math.min(Math.max(responseMs, 0), limit);
  const speedFactor = 1 - used / limit;
  return Math.max(0, Math.round(basePoints * (0.5 + 0.5 * speedFactor)));
};

export const calculateScore: ScoringStrategy = (input) => defaultScoring(input);
