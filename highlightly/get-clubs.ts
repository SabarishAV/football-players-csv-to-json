/**
 * fetch-teams.ts
 *
 * Fetches ALL football teams from https://soccer.highlightly.net/teams,
 * paginating with limit=500 (the API max), and writes the full list to
 * highlightly/teams.json.
 *
 * Requires HIGHLIGHTLY_API_KEY in a .env file (needs the `dotenv` package
 * installed), or already exported in the environment.
 *
 * Usage:
 *   npx tsx fetch-teams.ts
 */

import "dotenv/config";

interface Team {
  id: number;
  logo: string;
  name: string;
  type: string;
}

interface TeamsResponse {
  data: Team[];
  plan: { tier: string; message: string };
  pagination: { totalCount: number; offset: number; limit: number };
}

const BASE_URL = "https://soccer.highlightly.net";
const LIMIT = 500; // API max for /teams
const RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const OUT_FILE = "highlightly/teams.json";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(apiKey: string, offset: number): Promise<TeamsResponse> {
  const url = new URL(`${BASE_URL}/teams`);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("offset", String(offset));

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { "x-rapidapi-key": apiKey },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} at offset=${offset}: ${body}`);
      }
      return (await res.json()) as TeamsResponse;
    } catch (err) {
      console.warn(`  attempt ${attempt}/${RETRIES} failed: ${(err as Error).message}`);
      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * attempt);
      else throw err;
    }
  }
  throw new Error("unreachable");
}

async function fetchAllTeams(apiKey: string): Promise<Team[]> {
  const all: Team[] = [];
  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    console.log(`Fetching offset=${offset}${totalCount !== Infinity ? ` of ${totalCount}` : ""}`);
    const page = await fetchPage(apiKey, offset);

    all.push(...page.data);
    totalCount = page.pagination.totalCount;
    offset += page.pagination.limit || LIMIT;

    if (page.data.length === 0) break; // safety valve
    await sleep(200); // be polite to the API
  }

  return all;
}

async function main() {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) {
    console.error("Missing HIGHLIGHTLY_API_KEY in .env");
    process.exit(1);
  }

  const started = Date.now();
  const teams = await fetchAllTeams(apiKey);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const fs = await import("fs/promises");
  const path = await import("path");

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(teams, null, 2), "utf-8");

  console.log(`\nDone. Fetched ${teams.length} teams in ${elapsed}s -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});