import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------- Config ----------
const INPUT_FILE = path.join(
  import.meta.dirname,
  "./data/fifa-2026-players-seed.json",
);
const OUTPUT_FILE = path.join(
  import.meta.dirname,
  "./data/football_players_v3.json",
);

const MIN_VALUE = 1;
const MAX_VALUE = 15;
const SHRINK_WEIGHT = 2; // pull towards global average, in full-match equivalents
const CURVE_EXPONENT = 1.5; // >1 makes prices top-heavy (few stars near 15)

// Optional per-position premium added to the percentile before the curve (0 = equal ceilings)
const POSITION_PREMIUM: Record<string, number> = {
  FORWARD: 0,
  MIDFIELDER: 0,
  DEFENDER: 0,
  GOALKEEPER: 0,
};

// ---------- Types ----------
interface SeedPlayer {
  externalId: string | number;
  name: string;
  fullName: string;
  position: string | null;
  teamExternalId: string | number | null;
  ratingSum: number;
  matchesPlayed: number;
  totalMinutes: number;
  marketValue: number | null;
}

// ---------- Helpers ----------
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function effectiveMatches(p: SeedPlayer): number {
  return p.totalMinutes > 0 ? p.totalMinutes / 90 : p.matchesPlayed;
}

/** Percentile (0..1) per player, ties share the average rank. */
function percentiles(
  items: { id: string; score: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.score - b.score);
  const count = sorted.length;

  if (count === 1) {
    result.set(sorted[0].id, 0.5);
    return result;
  }

  let i = 0;
  while (i < count) {
    let j = i;
    while (
      j + 1 < count &&
      Math.abs(sorted[j + 1].score - sorted[i].score) < 1e-9
    )
      j++;
    const avgRank = (i + j) / 2;
    for (let k = i; k <= j; k++)
      result.set(sorted[k].id, avgRank / (count - 1));
    i = j + 1;
  }
  return result;
}

// ---------- Main ----------
async function main(): Promise<void> {
  const players = JSON.parse(
    await readFile(INPUT_FILE, "utf8"),
  ) as SeedPlayer[];

  const played = players.filter((p) => p.matchesPlayed > 0);
  if (played.length === 0)
    throw new Error("No players with matchesPlayed > 0 in the input file");

  const totalRating = played.reduce((sum, p) => sum + p.ratingSum, 0);
  const totalMatches = played.reduce((sum, p) => sum + p.matchesPlayed, 0);
  const globalAvg = totalRating / totalMatches;

  // Shrunk (small-sample corrected) average rating per player
  const adjusted = new Map<string, number>();
  for (const p of played) {
    const avg = p.ratingSum / p.matchesPlayed;
    const n = effectiveMatches(p);
    adjusted.set(
      String(p.externalId),
      (avg * n + globalAvg * SHRINK_WEIGHT) / (n + SHRINK_WEIGHT),
    );
  }

  // Group by position and compute percentile within each group
  const groups = new Map<string, { id: string; score: number }[]>();
  for (const p of played) {
    const key = p.position ?? "UNKNOWN";
    const id = String(p.externalId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ id, score: adjusted.get(id)! });
  }

  if (groups.has("UNKNOWN")) {
    console.warn(
      `[position] ${groups.get("UNKNOWN")!.length} rated players still have a null position; ` +
        "they are ranked together as one group",
    );
  }

  const percentileById = new Map<string, number>();
  const positionById = new Map<string, string>();
  for (const [position, items] of groups) {
    for (const [id, pct] of percentiles(items)) {
      percentileById.set(id, pct);
      positionById.set(id, position);
    }
  }

  // Build output
  const distribution = new Map<number, number>();
  const output = players.map((p) => {
    const id = String(p.externalId);
    let marketValue = MIN_VALUE;

    if (p.matchesPlayed > 0) {
      const premium = POSITION_PREMIUM[positionById.get(id) ?? ""] ?? 0;
      const pct = clamp(percentileById.get(id)! + premium, 0, 1);
      marketValue = clamp(
        MIN_VALUE +
          Math.round((MAX_VALUE - MIN_VALUE) * Math.pow(pct, CURVE_EXPONENT)),
        MIN_VALUE,
        MAX_VALUE,
      );
    }

    distribution.set(marketValue, (distribution.get(marketValue) ?? 0) + 1);
    return { ...p, marketValue };
  });

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(
    `Players: ${output.length} | Rated: ${played.length} | Global avg rating: ${globalAvg.toFixed(2)}`,
  );
  console.log("Market value distribution:");
  for (let v = MIN_VALUE; v <= MAX_VALUE; v++) {
    console.log(`  ${String(v).padStart(2)}: ${distribution.get(v) ?? 0}`);
  }
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
