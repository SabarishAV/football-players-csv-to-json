import fs from "node:fs";
import { parse } from "csv-parse/sync";
import path from "node:path";

interface PlayerMarketValue {
  playerId: number;
  date: string;
  value: number;
}

const csvPath = path.join(import.meta.dirname, "player_market_value.csv");

const csvContent = fs.readFileSync(csvPath, "utf-8");

const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

const marketValues: PlayerMarketValue[] = records.map(
  (row: { player_id: string; date_unix: string; value: string }) => ({
    playerId: Number(row.player_id),
    date: row.date_unix,
    value: Number(row.value),
  }),
);

const csvSavePath = path.join(import.meta.dirname, "player-market-values.json");
fs.writeFileSync(csvSavePath, JSON.stringify(marketValues, null, 2));

console.log(`Converted ${marketValues.length} records`);
