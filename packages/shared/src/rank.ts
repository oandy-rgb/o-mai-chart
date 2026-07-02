export const RANK_THRESHOLDS = [
  { rank: "SSS+", min: 100.5 },
  { rank: "SSS", min: 100.0 },
  { rank: "SS+", min: 99.5 },
  { rank: "SS", min: 99.0 },
  { rank: "S+", min: 98.0 },
  { rank: "S", min: 97.0 },
  { rank: "AAA", min: 94.0 },
  { rank: "AA", min: 90.0 },
  { rank: "A", min: 80.0 },
  { rank: "B", min: 0 },
] as const;

export type Rank = (typeof RANK_THRESHOLDS)[number]["rank"];

export function getRank(achievement: number): Rank {
  return RANK_THRESHOLDS.find((r) => achievement >= r.min)?.rank ?? "B";
}

/** 下一個能達到的 rank 門檻;已在 SSS+ 時回傳 null。 */
export function getNextRankThreshold(achievement: number): number | null {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (achievement < RANK_THRESHOLDS[i].min) {
      return RANK_THRESHOLDS[i].min;
    }
  }
  return null;
}
