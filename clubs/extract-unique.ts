/**
 * extract-unique.ts
 *
 * Reads clubs.json and writes a single output file containing the unique
 * values for:
 *   - clubDivision
 *   - competitionName
 *   - competitionSlug
 *
 * Each set is kept separate (its own array/section) in the output file.
 *
 * Usage:
 *   npx ts-node extract-unique.ts
 *
 * Edit INPUT_FILE / OUTPUT_FILE below to change file names/paths.
 */

import * as fs from "fs";
import * as path from "path";

const INPUT_FILE = "./clubs/clubs.json";
const OUTPUT_FILE = "./clubs/unique-values.json";

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

interface UniqueValuesOutput {
  clubDivisions: string[];
  competitionNames: string[];
  competitionSlugs: string[];
}

function extractUniqueValues(clubs: Club[]): UniqueValuesOutput {
  const clubDivisions = new Set<string>();
  const competitionNames = new Set<string>();
  const competitionSlugs = new Set<string>();

  for (const club of clubs) {
    if (club.clubDivision) clubDivisions.add(club.clubDivision);
    if (club.competitionName) competitionNames.add(club.competitionName);
    if (club.competitionSlug) competitionSlugs.add(club.competitionSlug);
  }

  return {
    clubDivisions: [...clubDivisions].sort(),
    competitionNames: [...competitionNames].sort(),
    competitionSlugs: [...competitionSlugs].sort(),
  };
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

  const result = extractUniqueValues(clubs);

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`Read ${clubs.length} club records from ${inputPath}`);
  console.log(`Unique clubDivisions: ${result.clubDivisions.length}`);
  console.log(`Unique competitionNames: ${result.competitionNames.length}`);
  console.log(`Unique competitionSlugs: ${result.competitionSlugs.length}`);
  console.log(`Wrote output to ${outputPath}`);
}

main();