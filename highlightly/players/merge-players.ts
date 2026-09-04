import fs from "fs/promises";
import path from "path";

const WC_PLAYERS_FILE = path.join(
  __dirname,
  "data",
  "players-fifa-wc-2026.json",
);
const HIGHLIGHTLY_PLAYERS_FILE = path.join(__dirname, "data", "players.json");
const OUTPUT_FILE = path.join(
  __dirname,
  "data",
  "fifa-wc-2026-players_v1.json",
);

interface WcPlayer {
  id: number;
  name: string;
  team: string;
  team_short: string;
  role: string;
  credits: number;
  selected_pct: number;
  captain_pct: number;
  vc_pct: number;
  points: number;
  is_playing: boolean;
  is_overseas: boolean;
  image_url: string | null;
  providerPlayerId: string;
  nationality: string;
}

interface HighlightlyPlayer {
  id: number;
  logo: string | null;
  name: string;
  fullName: string;
}

interface WcPlayerWithHighlightlyId extends WcPlayer {
  highlightlyId: string | null;
}

/** Lowercase + strip accents/diacritics so "González" matches "Gonzalez" and case differences don't matter. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main(): Promise<void> {
  const unMatchedPlayers = [];
  const ambiguousPlayers = [];

  const wcPlayers: WcPlayer[] = JSON.parse(
    await fs.readFile(WC_PLAYERS_FILE, "utf-8"),
  );
  const highlightlyPlayers: HighlightlyPlayer[] = JSON.parse(
    await fs.readFile(HIGHLIGHTLY_PLAYERS_FILE, "utf-8"),
  );

  // Build a lookup by normalized name -> list of matching highlightly ids (names aren't guaranteed unique)
  const nameToIds = new Map<string, number[]>();
  for (const p of highlightlyPlayers) {
    const key = normalizeName(p.name);
    const existing = nameToIds.get(key);
    if (existing) {
      existing.push(p.id);
    } else {
      nameToIds.set(key, [p.id]);
    }
  }

  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;

  const result: WcPlayerWithHighlightlyId[] = wcPlayers.map((wcPlayer) => {
    const key = normalizeName(wcPlayer.name);
    const ids = nameToIds.get(key);

    if (!ids) {
      unmatched++;
      unMatchedPlayers.push(wcPlayer);
      return { ...wcPlayer, highlightlyId: null };
    }

    if (ids.length > 1) {
      ambiguous++;
      const msg = `⚠️  Ambiguous match for "${wcPlayer.name}" (${wcPlayer.team}): ${ids.length} candidates [${ids.join(", ")}] — using first.`;
      console.warn(msg);
      ambiguousPlayers.push(msg);
    }

    matched++;
    return { ...wcPlayer, highlightlyId: String(ids[0]) };
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));

  console.log(`✅ Done. ${wcPlayers.length} WC players processed.`);
  console.log(`   Matched:   ${matched}`);
  console.log(
    `   Ambiguous: ${ambiguous} (matched but multiple candidates existed)`,
  );
  console.log(`   Unmatched: ${unmatched}`);
  console.log(`Saved to ${OUTPUT_FILE}`);

  if (unmatched > 0) {
    const unmatchedNames = result
      .filter((p) => p.highlightlyId === null)
      .map((p) => `${p.name} (${p.team})`);
    console.log("\nUnmatched players:");
    unmatchedNames.forEach((n) => console.log(`  - ${n}`));
  }

  const dataToSave = {
    ambiguousPlayers,
    unMatchedPlayers,
  };
  const filePath = path.join(__dirname, 'merge-players-out.json');
  const jsonString = JSON.stringify(dataToSave, null, 4);
  await fs.writeFile(filePath, jsonString, 'utf8');
}

main();
