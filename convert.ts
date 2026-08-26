import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { parse } from "csv-parse/sync";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

interface FootballClubJson {
  id: string;
  clubSlug?: string | null;
  clubName: string;
  logoUrl?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  clubDivision?: string | null;
  lastModifiedAt: string;
}

interface FootballPlayerCsv {
  playerId: string;
  playerSlug?: string | null;
  playerName: string;
  playerImageUrl?: string | null;
  nameInHomeCountry?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  countryOfBirth?: string | null;
  height?: string | null;
  citizenship?: string | null;
  isEu?: string | null;
  position?: string | null;
  mainPosition?: string | null;
  foot?: string | null;
  currentClubId?: string | null;
  currentClubName?: string | null;
  joined?: string | null;
  contractExpires?: string | null;
  outfitter?: string | null;
  socialMediaUrl?: string | null;
  playerAgentId?: string | null;
  playerAgentName?: string | null;
  contractOption?: string | null;
  dateOfLastContractExtension?: string | null;
  onLoanFromClubId?: string | null;
  onLoanFromClubName?: string | null;
  contractThereExpires?: string | null;
  secondClubUrl?: string | null;
  secondClubName?: string | null;
  thirdClubUrl?: string | null;
  thirdClubName?: string | null;
  fourthClubUrl?: string | null;
  fourthClubName?: string | null;
  dateOfDeath?: string | null;
}

countries.registerLocale(en);

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+(.)?/g, (_, char: string | undefined) => {
      return char?.toUpperCase() ?? "";
    })
    .replace(/^./, (char) => char.toLowerCase());
}

function normalizeClubName(name: string): string {
  return name
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim()
    .toLowerCase();
}

const csv = fs.readFileSync(
  "./player_profiles.csv",
  "utf-8",
);

const clubsFilePath = path.join(
  __dirname,
  "clubs.json",
);

const clubs: FootballClubJson[] = JSON.parse(
  fs.readFileSync(clubsFilePath, "utf-8"),
);

/*
 * Create a club lookup map.
 *
 * Example:
 *
 * "barcelona" -> "d84a7191-c4f3-470d-ab24-f57239c2b12d"
 * "real madrid" -> "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */
const clubMap = new Map<string, string>();

for (const club of clubs) {
  clubMap.set(
    normalizeClubName(club.clubName),
    club.id,
  );
}

console.log(`Loaded ${clubMap.size} clubs`);

const records = parse(csv, {
  columns: (headers: string[]) =>
    headers.map((header) => toCamelCase(header)),
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
});

const unmatchedClubs = new Set<string>();

const cleanedRecords = records.map(
  (player: FootballPlayerCsv) => {
    // -----------------------------
    // Country code
    // -----------------------------

    const citizenship = player.citizenship?.trim();

    const countryCode = citizenship
      ? countries.getAlpha2Code(
          citizenship,
          "en",
        )
      : undefined;

    // -----------------------------
    // Club ID
    // -----------------------------

    const currentClubName =
      player.currentClubName?.trim();

    let clubId: string | null = null;

    if (currentClubName) {
      clubId =
        clubMap.get(
          normalizeClubName(currentClubName),
        ) ?? null;

      if (!clubId) {
        unmatchedClubs.add(currentClubName);
      }
    }

    // -----------------------------
    // Return player
    // -----------------------------

    return {
      ...player,

      // Generate a new UUID for every player
      id: randomUUID(),

      // Remove "(123)" from the end of player names
      playerName: player.playerName
        ?.replace(/\s*\(\d+\)\s*$/, "")
        .trim(),

      // Add country code
      countryCode: countryCode ?? null,

      // Add club UUID
      clubId,
    };
  },
);

// -----------------------------
// Write players JSON
// -----------------------------

fs.writeFileSync(
  "./players2.json",
  JSON.stringify(
    cleanedRecords,
    null,
    2,
  ),
  "utf-8",
);

// -----------------------------
// Write unmatched clubs
// -----------------------------

fs.writeFileSync(
  "./unmatched-clubs.json",
  JSON.stringify(
    [...unmatchedClubs].sort(),
    null,
    2,
  ),
  "utf-8",
);

// -----------------------------
// Final output
// -----------------------------

console.log(
  `\nConverted ${cleanedRecords.length} players`,
);

console.log(
  "Created: players2.json",
);

console.log(
  `Unmatched clubs: ${unmatchedClubs.size}`,
);

console.log(
  "Created: unmatched-clubs.json",
);