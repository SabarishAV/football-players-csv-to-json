import fs from "node:fs";
import path from "node:path";

interface PlayerMarketValue {
  playerId: number;
  date: string;
  value: number;
}

interface LatestPlayerMarketValue {
  playerId: number;
  marketValue: number;
}

const inputPath = path.join(import.meta.dirname, "player-market-values.json");

const outputPath = path.join(
  import.meta.dirname,
  "player-latest-market-values.json",
);

const marketValues: PlayerMarketValue[] = JSON.parse(
  fs.readFileSync(inputPath, "utf-8"),
);

const latestValues = new Map<number, PlayerMarketValue>();

for (const record of marketValues) {
  const existing = latestValues.get(record.playerId);

  if (!existing || new Date(record.date) > new Date(existing.date)) {
    latestValues.set(record.playerId, record);
  }
}

const uniqueMarketValues: LatestPlayerMarketValue[] = Array.from(
  latestValues.values(),
).map((record) => ({
  playerId: record.playerId,
  // min value is 1M and max value is 15M
  marketValue: Math.min(Math.max(record.value / 1_000_000, 1), 15),
}));

fs.writeFileSync(outputPath, JSON.stringify(uniqueMarketValues, null, 2));

console.log(`Saved ${uniqueMarketValues.length} unique player market values`);
