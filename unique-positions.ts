/**
 * download-players.ts
 *
 * Downloads players2.json from the SabarishAV/football-players-csv-to-json
 * repo (the file is stored via Git LFS, so we hit the media.githubusercontent.com
 * endpoint, which serves the resolved LFS content directly instead of the
 * pointer text you'd get from raw.githubusercontent.com).
 *
 * Outputs:
 *   - football_players.json   (the full downloaded dataset)
 *   - unique_positions.json   (all unique "position" and "mainPosition" values)
 *
 * Run with: npx ts-node download-players.ts
 * (or compile with tsc and run with node)
 *
 * Requires Node 18+ (for global fetch) or install node-fetch and import it.
 */

import { writeFile } from "fs/promises";

// LFS-resolved raw content URL (NOT raw.githubusercontent.com, which only
// returns the LFS pointer stub for files tracked by Git LFS).
const SOURCE_URL =
  "https://media.githubusercontent.com/media/SabarishAV/football-players-csv-to-json/master/players2.json";

const OUTPUT_FILE = "football_players.json";
const POSITIONS_FILE = "unique_positions.json";

interface Player {
  position?: string;
  mainPosition?: string;
  [key: string]: unknown;
}

async function main(): Promise<void> {
  const res = await fetch(SOURCE_URL);

  if (!res.ok) {
    throw new Error(
      `Failed to download file: ${res.status} ${res.statusText}`
    );
  }

  const raw = await res.text();

  // Basic guard in case GitHub still serves an LFS pointer stub
  // (happens if the branch/path is wrong) instead of real JSON.
  if (raw.startsWith("version https://git-lfs.github.com/spec")) {
    throw new Error(
      "Received a Git LFS pointer file instead of the actual JSON content. " +
        "Check that the branch/path in SOURCE_URL is correct."
    );
  }

  const players: Player[] = JSON.parse(raw);

  // Save the full dataset
  await writeFile(OUTPUT_FILE, JSON.stringify(players, null, 2), "utf-8");

  // Collect unique positions from both "position" and "mainPosition" fields
  const positions = new Set<string>();
  const mainPositions = new Set<string>();

  for (const player of players) {
    if (player.position) positions.add(player.position);
    if (player.mainPosition) mainPositions.add(player.mainPosition);
  }

  const result = {
    uniquePositions: Array.from(positions).sort(),
    uniqueMainPositions: Array.from(mainPositions).sort(),
  };

  await writeFile(POSITIONS_FILE, JSON.stringify(result, null, 2), "utf-8");
}

main().catch((err) => {
  // Write the error to a file too, since we're avoiding console.log
  writeFile("download-players-error.log", String(err?.stack ?? err), "utf-8");
  process.exitCode = 1;
});