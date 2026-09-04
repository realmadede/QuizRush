export interface ScoreParams {
  isCorrect: boolean;
  basePoints: number;
  responseMs: number;
  timeLimitMs: number;
}

/**
 * Calculate score based on correctness and response time
 * Incentivizes both speed and accuracy
 */
export function calculateScore(params: ScoreParams): number {
  if (!params.isCorrect) {
    return 0;
  }

  // Time-based scoring: The maximum possible score is exactly the basePoints set by the host.
  // The faster the answer, the closer the score is to the maximum.
  // The lowest possible score for a correct answer is 50% of basePoints.
  const timeRatio = Math.min(1, Math.max(0, params.responseMs / params.timeLimitMs));
  const points = Math.round(params.basePoints * (1 - timeRatio / 2));

  return points;
}

/**
 * Calculate leaderboard rankings
 */
export function calculateRankings(
  players: Array<{ id: string; nickname: string; score: number }>
): Array<{
  rank: number;
  id: string;
  nickname: string;
  score: number;
}> {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return sorted.map((p, index) => ({
    rank: index + 1,
    ...p,
  }));
}
