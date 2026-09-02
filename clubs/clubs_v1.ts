/**
 * filter-clubs.ts
 *
 * Reads clubs.json and writes out only the clubs whose clubDivision
 * matches one of the WANTED_DIVISIONS below (exact match, case-sensitive).
 *
 * Usage:
 *   npx ts-node filter-clubs.ts
 *
 * Edit INPUT_FILE / OUTPUT_FILE / WANTED_DIVISIONS below as needed.
 */

import * as fs from "fs";
import * as path from "path";

const INPUT_FILE = "./clubs/clubs.json";
const OUTPUT_FILE = "./clubs/clubs_v1.json";

// Exact clubDivision values to keep.
// NOTE: "Premier League 2" (U23 reserve league) and "LaLiga2" (2nd division)
// are intentionally NOT included here since they're different divisions.
const WANTED_DIVISIONS = new Set<string>([
  "Premier League",
  "LaLiga",
]);

interface Club {
  id: string;
  clubId: string;
  clubSlug: string;
  clubName: string;
  logoUrl: string;
  countryName: string;
  seasonId: string;
  competitionId: string;
  competitionSlug: string;
  competitionName: string;
  clubDivision: string;
  sourceUrl: string;
  lastModifiedAt: string;
  countryCode: string;
}

function main() {
  const inputPath = path.resolve(INPUT_FILE);
  const outputPath = path.resolve(OUTPUT_FILE);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const clubs: Club[] = JSON.parse(raw);

  if (!Array.isArray(clubs)) {
    console.error("Expected clubs.json to contain a top-level array.");
    process.exit(1);
  }

  const filtered = clubs.filter((club) => WANTED_DIVISIONS.has(club.clubDivision));

  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), "utf-8");

  // Quick breakdown per division for sanity-checking.
  const counts: Record<string, number> = {};
  for (const club of filtered) {
    counts[club.clubDivision] = (counts[club.clubDivision] || 0) + 1;
  }

  console.log(`Read ${clubs.length} total clubs from ${inputPath}`);
  console.log(`Matched ${filtered.length} clubs across ${WANTED_DIVISIONS.size} divisions:`);
  for (const [division, count] of Object.entries(counts)) {
    console.log(`  - ${division}: ${count}`);
  }
  console.log(`Wrote output to ${outputPath}`);
}

main();