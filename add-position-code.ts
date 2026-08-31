import { readFile, writeFile } from "fs/promises";

const INPUT_FILE = "football_players.json";
const OUTPUT_FILE = "football_players.json"; // overwrite in place
const UNMAPPED_LOG_FILE = "unmapped-positions.log";

type MainPositionCode = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";

interface Player {
  mainPosition?: string;
  mainPositionCode?: MainPositionCode;
  [key: string]: unknown;
}

// Ordered list of (matcher, code) pairs. We check "startsWith" on the
// lowercased/trimmed mainPosition so small variants (Goalkeeper/Goalkeepers,
// Midfield/Midfielder, Attack/Attacker) all resolve correctly.
const MAPPINGS: Array<{ matches: (val: string) => boolean; code: MainPositionCode }> = [
  { matches: (v) => v.startsWith("goalkeeper") || v.startsWith("goal keeper"), code: "GOALKEEPER" },
  { matches: (v) => v.startsWith("defen"), code: "DEFENDER" },
  { matches: (v) => v.startsWith("midfield"), code: "MIDFIELDER" },
  { matches: (v) => v.startsWith("attack") || v.startsWith("forward"), code: "FORWARD" },
];

function resolvePositionCode(mainPosition: string | undefined): MainPositionCode | null {
  if (!mainPosition) return null;
  const normalized = mainPosition.trim().toLowerCase();

  for (const { matches, code } of MAPPINGS) {
    if (matches(normalized)) return code;
  }
  return null;
}

async function main(): Promise<void> {
  const raw = await readFile(INPUT_FILE, "utf-8");
  const players: Player[] = JSON.parse(raw);

  const unmapped: Array<{ index: number; mainPosition: string | undefined }> = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const code = resolvePositionCode(player.mainPosition);

    if (code) {
      player.mainPositionCode = code;
    } else {
      unmapped.push({ index: i, mainPosition: player.mainPosition });
    }
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(players, null, 2), "utf-8");

  if (unmapped.length > 0) {
    const log = unmapped
      .map((u) => `index=${u.index} mainPosition=${JSON.stringify(u.mainPosition)}`)
      .join("\n");
    await writeFile(
      UNMAPPED_LOG_FILE,
      `${unmapped.length} player(s) had a mainPosition that could not be mapped:\n${log}\n`,
      "utf-8"
    );
  } else {
    await writeFile(UNMAPPED_LOG_FILE, "All players mapped successfully. No issues.\n", "utf-8");
  }
}

main().catch((err) => {
  writeFile("add-position-code-error.log", String(err?.stack ?? err), "utf-8");
  process.exitCode = 1;
});