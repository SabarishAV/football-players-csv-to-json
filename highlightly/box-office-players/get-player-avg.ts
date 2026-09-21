import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------- Config ----------
const INPUT_FILE = path.join(
  import.meta.dirname,
  "./data/fifa-2026-box-scores.json",
);
const OUTPUT_FILE = path.join(
  import.meta.dirname,
  "./data/fifa-2026-players-seed.json",
);

// ---------- Types ----------
type Obj = Record<string, unknown>;
type Id = string | number;
type Position = "FORWARD" | "MIDFIELDER" | "DEFENDER" | "GOALKEEPER";

interface SeedPlayer {
  externalId: Id;
  name: string;
  fullName: string;
  position: Position | null;
  teamExternalId: Id | null;
  ratingSum: number;
  matchesPlayed: number;
  totalMinutes: number;
  marketValue: null;
}

interface Accumulator {
  externalId: Id;
  name: string;
  fullName: string;
  teamExternalId: Id | null;
  ratingSum: number;
  matchesPlayed: number;
  totalMinutes: number;
  positionVotes: Map<Position, number>;
}

// ---------- Position mapping (strict: anything not listed becomes null) ----------
const POSITION_MAP: Record<string, Position> = {
  // goalkeeper
  goalkeeper: "GOALKEEPER",
  goalie: "GOALKEEPER",
  keeper: "GOALKEEPER",
  gk: "GOALKEEPER",
  g: "GOALKEEPER",
  // defender
  defender: "DEFENDER",
  defence: "DEFENDER",
  defense: "DEFENDER",
  def: "DEFENDER",
  d: "DEFENDER",
  cb: "DEFENDER",
  lb: "DEFENDER",
  rb: "DEFENDER",
  lwb: "DEFENDER",
  rwb: "DEFENDER",
  wb: "DEFENDER",
  sw: "DEFENDER",
  "centre back": "DEFENDER",
  "center back": "DEFENDER",
  "left back": "DEFENDER",
  "right back": "DEFENDER",
  "left wing back": "DEFENDER",
  "right wing back": "DEFENDER",
  // midfielder
  midfielder: "MIDFIELDER",
  midfield: "MIDFIELDER",
  mid: "MIDFIELDER",
  m: "MIDFIELDER",
  cm: "MIDFIELDER",
  dm: "MIDFIELDER",
  cdm: "MIDFIELDER",
  am: "MIDFIELDER",
  cam: "MIDFIELDER",
  lm: "MIDFIELDER",
  rm: "MIDFIELDER",
  "central midfielder": "MIDFIELDER",
  "defensive midfielder": "MIDFIELDER",
  "attacking midfielder": "MIDFIELDER",
  "left midfielder": "MIDFIELDER",
  "right midfielder": "MIDFIELDER",
  // forward
  forward: "FORWARD",
  attacker: "FORWARD",
  attack: "FORWARD",
  striker: "FORWARD",
  fw: "FORWARD",
  f: "FORWARD",
  st: "FORWARD",
  cf: "FORWARD",
  ss: "FORWARD",
  lw: "FORWARD",
  rw: "FORWARD",
  winger: "FORWARD",
  "left winger": "FORWARD",
  "right winger": "FORWARD",
  "centre forward": "FORWARD",
  "center forward": "FORWARD",
};

const loggedUnknownPositions = new Set<string>();

function mapPosition(
  raw: unknown,
  playerLabel: string,
  matchId: string,
): Position | null {
  const text = toText(raw);
  if (!text) return null;

  const key = text
    .toLowerCase()
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const mapped = POSITION_MAP[key];
  if (mapped) return mapped;

  if (!loggedUnknownPositions.has(key)) {
    loggedUnknownPositions.add(key);
    console.log(
      `[position] Unknown value "${text}" (first seen: ${playerLabel}, match ${matchId}) -> ignored`,
    );
  }
  return null;
}

// ---------- Generic helpers ----------
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function toId(v: unknown): Id | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

function toText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (isObj(v))
    return toText(v.name ?? v.abbreviation ?? v.shortName ?? v.label);
  return "";
}

function toNumber(v: unknown): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads a value from a player either directly (player[key]) or from a
 * statistics list / map, e.g. [{ name: "Rating", value: "7.4" }].
 */
function getStat(
  player: Obj,
  directKeys: string[],
  labelPattern: RegExp,
): unknown {
  for (const key of directKeys) {
    if (player[key] !== undefined && player[key] !== null) return player[key];
  }

  for (const container of [player.statistics, player.stats]) {
    if (Array.isArray(container)) {
      for (const item of container) {
        if (!isObj(item)) continue;
        const label = toText(
          item.name ??
            item.displayName ??
            item.type ??
            item.label ??
            item.title ??
            item.key,
        );
        if (labelPattern.test(label))
          return item.value ?? item.stat ?? item.amount;
      }
    } else if (isObj(container)) {
      for (const [key, value] of Object.entries(container)) {
        if (labelPattern.test(key)) return value;
      }
    }
  }
  return undefined;
}

// ---------- Box score shape handling ----------
function getTeamBlocks(raw: unknown): Obj[] {
  if (Array.isArray(raw)) return raw.filter(isObj);
  if (!isObj(raw)) return [];
  if (raw.data !== undefined) return getTeamBlocks(raw.data);

  const sides = [raw.home, raw.away, raw.homeTeam, raw.awayTeam].filter(isObj);
  if (sides.length > 0) return sides;

  if (Array.isArray(raw.teams)) return raw.teams.filter(isObj);
  return [raw];
}

function getTeamId(block: Obj): Id | null {
  if (isObj(block.team)) return toId(block.team.id);
  return toId(block.teamId ?? block.id);
}

function collectPlayers(value: unknown): Obj[] {
  if (Array.isArray(value)) return value.flatMap(collectPlayers);
  if (!isObj(value)) return [];
  if (
    toId(value.id ?? value.playerId) !== null &&
    (value.name || value.fullName)
  )
    return [value];
  return Object.values(value).flatMap(collectPlayers);
}

function getPlayersOfBlock(block: Obj): Obj[] {
  const source =
    block.players ?? block.playerStats ?? block.lineup ?? block.lineups;
  return collectPlayers(source);
}

// ---------- Main ----------
async function main(): Promise<void> {
  const boxScores = JSON.parse(await readFile(INPUT_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  const matchEntries = Object.entries(boxScores);

  const players = new Map<string, Accumulator>();
  let emptyMatches = 0;
  let ratedAppearances = 0;
  let unratedListings = 0;

  for (const [matchId, raw] of matchEntries) {
    let playersInMatch = 0;

    for (const block of getTeamBlocks(raw)) {
      const teamId = getTeamId(block);

      for (const player of getPlayersOfBlock(block)) {
        const externalId = toId(player.id ?? player.playerId);
        if (externalId === null) continue;
        playersInMatch++;

        const key = String(externalId);
        const name = toText(player.name) || toText(player.fullName);
        const fullName = toText(player.fullName) || toText(player.name);

        let acc = players.get(key);
        if (!acc) {
          acc = {
            externalId,
            name,
            fullName,
            teamExternalId: teamId,
            ratingSum: 0,
            matchesPlayed: 0,
            totalMinutes: 0,
            positionVotes: new Map(),
          };
          players.set(key, acc);
        }

        if (!acc.name && name) acc.name = name;
        if (fullName.length > acc.fullName.length) acc.fullName = fullName;
        if (acc.teamExternalId === null && teamId !== null)
          acc.teamExternalId = teamId;

        // Position vote (only valid enum values count)
        const position = mapPosition(
          getStat(player, ["position", "positionName", "pos"], /^position$/i),
          `${acc.name} (${key})`,
          matchId,
        );
        if (position)
          acc.positionVotes.set(
            position,
            (acc.positionVotes.get(position) ?? 0) + 1,
          );

        // Appearance = valid rating in this match
        const rating = toNumber(
          getStat(player, ["rating", "matchRating"], /rating/i),
        );
        if (rating === null || rating <= 0) {
          unratedListings++;
          continue;
        }

        acc.ratingSum += rating;
        acc.matchesPlayed++;
        ratedAppearances++;

        const minutes = toNumber(
          getStat(
            player,
            ["minutesPlayed", "minutes"],
            /^minutes(\s*played)?$/i,
          ),
        );
        if (minutes !== null && minutes > 0) acc.totalMinutes += minutes;
      }
    }

    if (playersInMatch === 0) {
      emptyMatches++;
      const shape = isObj(raw)
        ? Object.keys(raw).join(", ")
        : Array.isArray(raw)
          ? "array"
          : typeof raw;
      console.warn(
        `[shape] Match ${matchId}: no players found (top-level: ${shape})`,
      );
    }
  }

  if (players.size === 0) {
    throw new Error(
      "No players extracted. The box score shape differs from what this script expects; " +
        "adjust getTeamBlocks / getPlayersOfBlock / getStat field names at the top of the helpers.",
    );
  }

  // Resolve final positions and build seed
  const seed: SeedPlayer[] = [];
  let nullPositions = 0;

  for (const acc of players.values()) {
    const votes = [...acc.positionVotes.entries()].sort((a, b) => b[1] - a[1]);
    let position: Position | null = null;

    if (votes.length === 0) {
      console.log(
        `[position] ${acc.name} (${acc.externalId}): no valid position found -> null`,
      );
    } else if (votes.length > 1 && votes[0][1] === votes[1][1]) {
      const tied = votes
        .filter(([, count]) => count === votes[0][1])
        .map(([p]) => p);
      console.log(
        `[position] ${acc.name} (${acc.externalId}): tie between ${tied.join(" / ")} -> null`,
      );
    } else {
      position = votes[0][0];
    }
    if (position === null) nullPositions++;

    seed.push({
      externalId: acc.externalId,
      name: acc.name,
      fullName: acc.fullName,
      position,
      teamExternalId: acc.teamExternalId,
      ratingSum: Math.round(acc.ratingSum * 100) / 100,
      matchesPlayed: acc.matchesPlayed,
      totalMinutes: acc.totalMinutes,
      marketValue: null,
    });
  }

  seed.sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(seed, null, 2), "utf8");

  console.log(
    `\nDone. Matches: ${matchEntries.length} (no players found in ${emptyMatches}) | ` +
      `Players: ${seed.length} | Rated appearances: ${ratedAppearances} | ` +
      `Listings without rating: ${unratedListings} | Null positions: ${nullPositions}`,
  );
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
