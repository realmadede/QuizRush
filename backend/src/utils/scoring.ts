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

  // Time bonus: faster responses = more points
  const timeRatio = Math.max(0, 1 - params.responseMs / params.timeLimitMs);
  const timeBonus = Math.round(params.basePoints * timeRatio * 0.5); // Up to 50% bonus

  return params.basePoints + timeBonus;
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
