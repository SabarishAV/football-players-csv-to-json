import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import matchIds from './fifa-match-ids.json';

// ---------- Config ----------
const BASE_URL =
  process.env.HIGHLIGHTLY_BASE_URL ?? "https://soccer.highlightly.net";
const API_KEY_HEADER = "x-rapidapi-key"; // change if your Highlightly plan uses a different header

const API_KEYS: string[] = [
  process.env.HIGHLIGHTLY_API_KEY,
  process.env.HIGHLIGHTLY_API_KEY2,
].filter((key): key is string => Boolean(key));

// const IDS_FILE = path.resolve("data/fifa-2026-match-ids.json"); // e.g. [1234567, 1234568, ...]
const OUTPUT_FILE = path.resolve("fifa-2026-box-scores.json");

const MAX_RETRIES_PER_KEY = 2; // retries for network / 5xx errors before switching key
const DELAY_BETWEEN_CALLS_MS = 300;
const KEY_SWITCH_STATUSES = new Set([401, 403, 429]); // auth / quota / rate-limit errors

// ---------- Types ----------
type MatchId = string | number;
type BoxScores = Record<string, unknown>;

class AllKeysExhaustedError extends Error {
  constructor() {
    super("All API keys exhausted");
    this.name = "AllKeysExhaustedError";
  }
}

// ---------- Helpers ----------
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let keyIndex = 0;

function switchKey(reason: string): void {
  console.warn(`Key #${keyIndex + 1} failed (${reason}).`);
  keyIndex++;
  if (keyIndex < API_KEYS.length) {
    console.warn(`Switching to key #${keyIndex + 1}.`);
  }
}

/**
 * Returns the box score, or null if the match has no box score (404).
 * Throws AllKeysExhaustedError when every key has failed.
 */
async function fetchBoxScore(matchId: MatchId): Promise<unknown | null> {
  let attempt = 0;

  while (keyIndex < API_KEYS.length) {
    try {
      const res = await fetch(`${BASE_URL}/box-score/${matchId}`, {
        headers: {
          [API_KEY_HEADER]: API_KEYS[keyIndex],
          Accept: "application/json",
        },
      });

      if (res.ok) return await res.json();

      if (res.status === 404) return null;

      if (KEY_SWITCH_STATUSES.has(res.status)) {
        switchKey(`HTTP ${res.status}`);
        attempt = 0;
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      attempt++;
      const message = err instanceof Error ? err.message : String(err);

      if (attempt > MAX_RETRIES_PER_KEY) {
        switchKey(message);
        attempt = 0;
      } else {
        console.warn(
          `Match ${matchId}: ${message} (retry ${attempt}/${MAX_RETRIES_PER_KEY})`,
        );
        await sleep(1000 * attempt);
      }
    }
  }

  throw new AllKeysExhaustedError();
}

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function saveResults(results: BoxScores): Promise<void> {
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
}

// ---------- Main ----------
async function main(): Promise<void> {
  if (API_KEYS.length === 0) {
    throw new Error(
      "Set HIGHLIGHTLY_API_KEY_1 (and HIGHLIGHTLY_API_KEY_2) in your env",
    );
  }

//   const matchIds = await loadJson<MatchId[]>(IDS_FILE, []);
//   if (matchIds.length === 0) {
//     throw new Error(`No match ids found in ${IDS_FILE}`);
//   }

  // Resume support: skip matches already saved in a previous run
  const results = await loadJson<BoxScores>(OUTPUT_FILE, {});
  const notFound: MatchId[] = [];
  let fetched = 0;

  for (const matchId of matchIds) {
    if (results[String(matchId)] !== undefined) continue;

    try {
      const data = await fetchBoxScore(matchId);

      if (data === null) {
        notFound.push(matchId);
        console.warn(`Match ${matchId}: no box score (404)`);
      } else {
        results[String(matchId)] = data;
        fetched++;
        await saveResults(results); // save after every success so no progress is lost
        console.log(
          `Match ${matchId}: saved (${Object.keys(results).length}/${matchIds.length})`,
        );
      }
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        console.error(
          "Both API keys exhausted. Progress saved; re-run later to resume.",
        );
        break;
      }
      throw err;
    }

    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  await saveResults(results);

  console.log(
    `\nDone. Fetched this run: ${fetched} | Total saved: ${Object.keys(results).length}/${matchIds.length}`,
  );
  if (notFound.length > 0) {
    console.log(`No box score for: ${notFound.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
