import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const API_KEYS = [process.env.HIGHLIGHTLY_API_KEY!, process.env.HIGHLIGHTLY_API_KEY2!];
const BASE_URL = 'https://soccer.highlightly.net'; // or the RapidAPI host below
// const BASE_URL = 'https://football-highlights-api.p.rapidapi.com';
const LIMIT = 1000;
const OUTPUT_FILE = path.join(__dirname, 'data', 'players.json');
const PROGRESS_FILE = path.join(__dirname, 'data', 'players-progress.json');

interface Player {
  id: number;
  logo: string | null;
  name: string;
  fullName: string;
}

interface ApiResponse {
  data: Player[];
  pagination: { totalCount: number; offset: number; limit: number };
}

interface Progress {
  nextOffset: number;
  totalCount: number | null;
  done: boolean;
}

async function loadProgress(): Promise<Progress> {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { nextOffset: 0, totalCount: null, done: false };
  }
}

async function saveProgress(progress: Progress): Promise<void> {
  await fs.mkdir(path.dirname(PROGRESS_FILE), { recursive: true });
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function loadExistingPlayers(): Promise<Player[]> {
  try {
    return JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function savePlayers(players: Player[]): Promise<void> {
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(players, null, 2));
}

async function fetchPage(offset: number, apiKey: string): Promise<ApiResponse> {
  const url = `${BASE_URL}/players?limit=${LIMIT}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'football-highlights-api.p.rapidapi.com', // only needed via RapidAPI
    },
  });

  if (res.status === 429 || res.status === 403) {
    throw new Error('QUOTA_EXHAUSTED');
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${await res.text()}`);
  }

  return res.json() as Promise<ApiResponse>;
}

async function main(): Promise<void> {
  const progress = await loadProgress();
  const players = await loadExistingPlayers();

  if (progress.done) {
    console.log('✅ Already complete. Delete the progress file to restart.');
    return;
  }

  let offset = progress.nextOffset;
  let totalCount = progress.totalCount;
  let keyIndex = 0;

  console.log(`Starting from offset ${offset}${totalCount ? ` / ${totalCount}` : ''}`);

  while (totalCount === null || offset < totalCount) {
    try {
      const response = await fetchPage(offset, API_KEYS[keyIndex]);
      totalCount = response.pagination.totalCount;

      if (response.data.length === 0) {
        console.log(`No more players at offset ${offset}. Done.`);
        break;
      }

      players.push(...response.data);
      offset += response.data.length;

      console.log(`[key ${keyIndex + 1}] offset -> ${offset} of ${totalCount}`);

      await savePlayers(players);
      await saveProgress({ nextOffset: offset, totalCount, done: false });

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      if ((err as Error).message === 'QUOTA_EXHAUSTED' && keyIndex === 0) {
        console.warn(`Key 1 exhausted at offset ${offset}. Switching to key 2.`);
        keyIndex = 1;
        continue;
      }

      console.error('❌ Stopped:', (err as Error).message);
      console.log(`RESUME FROM OFFSET: ${offset} (${players.length} players saved so far)`);
      process.exit(1);
    }
  }

  await saveProgress({ nextOffset: offset, totalCount, done: true });
  console.log(`✅ Done. ${players.length} players saved to ${OUTPUT_FILE}`);
}

main();