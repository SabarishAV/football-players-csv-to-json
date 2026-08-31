/**
 * merge-clubs.ts
 *
 * Merges highlightly/teams.json against clubs.json (the existing
 * transfermarkt-style records file, located one level up from this
 * script — i.e. at the project root) and writes the result to
 * highlightly/merged-clubs.json.
 *
 * For every CLUB in highlightly/teams.json:
 *   - If a club with the same name exists in clubs.json, that record
 *     is kept (all its original fields), and two fields are added to it:
 *       - highlightlyExternalId: the id from highlightly/teams.json
 *       - source: "highlightly"
 *     (If clubs.json has multiple records for the same club — e.g. one
 *     per season — every one of them gets these fields added.)
 *   - If no matching club exists in clubs.json, a new record is created
 *     using clubs.json's schema (unknown fields left as ""), with
 *     highlightlyExternalId and source set. These new records are appended
 *     at the BOTTOM of the output, after all the original (possibly
 *     augmented) records from clubs.json.
 *
 * Non-matching records that were already in clubs.json are kept as-is.
 *
 * Usage (run from the project root, no args needed):
 *   npx tsx highlightly/merge-clubs.ts
 */

import { randomUUID } from "node:crypto";

interface Team {
  id: number;
  logo: string;
  name: string;
  type: string;
}

interface ClubRecord {
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
  highlightlyExternalId?: number;
  source?: string;
}

const TEAMS_FILE = "highlightly/teams.json";
const INPUT_FILE = "clubs.json"; // outside the highlightly folder, at project root
const OUT_FILE = "highlightly/merged-clubs.json";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(name: string): string {
  return normalizeName(name).replace(/\s+/g, "-");
}

async function readJson<T>(path: string): Promise<T> {
  const fs = await import("fs/promises");
  const raw = await fs.readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

async function main() {
  const teams = await readJson<Team[]>(TEAMS_FILE);
  const oldClubs = await readJson<ClubRecord[]>(INPUT_FILE);

  const clubs = teams.filter((t) => t.type === "club");
  console.log(`Loaded ${teams.length} teams (${clubs.length} of type "club")`);
  console.log(`Loaded ${oldClubs.length} existing club records from ${INPUT_FILE}`);

  // Map normalized club name -> indices of all matching records in oldClubs
  // (a club can legitimately appear more than once, e.g. one row per season)
  const nameIndex = new Map<string, number[]>();
  oldClubs.forEach((club, idx) => {
    const key = normalizeName(club.clubName);
    const list = nameIndex.get(key) ?? [];
    list.push(idx);
    nameIndex.set(key, list);
  });

  // Track every clubSlug already in use — both from clubs.json and from new
  // records we're about to create — so no two output records ever end up
  // with the same slug. Multiple clubs can share a plain name (e.g. many
  // countries have a "Police FC"), so on collision we disambiguate using
  // the highlightly team id, which is always unique.
  const usedSlugs = new Set<string>();
  for (const club of oldClubs) {
    if (club.clubSlug) usedSlugs.add(club.clubSlug);
  }

  function uniqueSlugFor(name: string, highlightlyId: number): string {
    const base = slugify(name);
    if (!usedSlugs.has(base)) {
      usedSlugs.add(base);
      return base;
    }
    let candidate = `${base}-${highlightlyId}`;
    let n = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${highlightlyId}-${n++}`;
    }
    usedSlugs.add(candidate);
    return candidate;
  }

  const newRecords: ClubRecord[] = [];
  let matchedCount = 0;
  let newCount = 0;

  for (const team of clubs) {
    const key = normalizeName(team.name);
    const matchIndices = nameIndex.get(key);

    if (matchIndices && matchIndices.length > 0) {
      for (const idx of matchIndices) {
        oldClubs[idx] = {
          ...oldClubs[idx],
          highlightlyExternalId: team.id,
          source: "highlightly",
        };
      }
      matchedCount++;
    } else {
      newRecords.push({
        id: randomUUID(),
        clubId: "",
        clubSlug: uniqueSlugFor(team.name, team.id),
        clubName: team.name,
        logoUrl: team.logo,
        countryName: "",
        seasonId: "",
        competitionId: "",
        competitionSlug: "",
        competitionName: "",
        clubDivision: "",
        sourceUrl: "",
        lastModifiedAt: new Date().toISOString(),
        countryCode: "",
        highlightlyExternalId: team.id,
        source: "highlightly",
      });
      newCount++;
    }
  }

  const merged = [...oldClubs, ...newRecords];

  const fs = await import("fs/promises");
  const path = await import("path");
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");

  console.log(`\nMatched: ${matchedCount} clubs (existing records augmented)`);
  console.log(`New: ${newCount} clubs (appended at the bottom)`);
  console.log(`Total records in output: ${merged.length}`);
  console.log(`Unique slugs: ${usedSlugs.size}`);
  console.log(`Saved to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});