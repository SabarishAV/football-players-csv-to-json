import fs from 'fs';
import { parse } from 'csv-parse/sync';

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+(.)?/g, (_, char) => char?.toUpperCase() ?? '')
    .replace(/^./, char => char.toLowerCase());
}

const csv = fs.readFileSync('./player_profiles.csv', 'utf-8');

const records = parse(csv, {
  columns: (headers: string[]) =>
    headers.map(header => toCamelCase(header)),
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
});

fs.writeFileSync(
  './players.json',
  JSON.stringify(records, null, 2),
  'utf-8',
);

console.log(`Converted ${records.length} players`);
console.log('Created: players.json');