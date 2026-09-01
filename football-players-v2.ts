import fs from 'node:fs';
import path from 'node:path';

interface FootballPlayer {
  playerId: string;
  [key: string]: unknown;
}

interface PlayerMarketValue {
  playerId: number;
  marketValue: number;
}

const playersPath = path.join(
  import.meta.dirname,
  'football_players_v1.json',
);

const marketValuesPath = path.join(
  import.meta.dirname,
  'market-value/player-latest-market-values.json',
);

const outputPath = path.join(
  import.meta.dirname,
  'football_players_v2.json',
);

const players: FootballPlayer[] = JSON.parse(
  fs.readFileSync(playersPath, 'utf-8'),
);

const marketValues: PlayerMarketValue[] = JSON.parse(
  fs.readFileSync(marketValuesPath, 'utf-8'),
);

const marketValueMap = new Map<number, number>(
  marketValues.map((item) => [
    item.playerId,
    item.marketValue,
  ]),
);

let matchedCount = 0;
let unmatchedCount = 0;

const updatedPlayers = players.map((player) => {
  const marketValue = marketValueMap.get(
    Number(player.playerId),
  );

  if (marketValue !== undefined) {
    matchedCount++;
  } else {
    unmatchedCount++;
  }

  return {
    ...player,
    marketValue: marketValue ?? 1,
  };
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(updatedPlayers, null, 2),
);

console.log(`Total players: ${updatedPlayers.length}`);
console.log(`Matched market values: ${matchedCount}`);
console.log(`Players without market values: ${unmatchedCount}`);
console.log(`Saved: ${outputPath}`);