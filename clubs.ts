import fs from 'fs';
import { parse } from 'csv-parse/sync';

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+(.)?/g, (_, char) => char?.toUpperCase() ?? '')
    .replace(/^./, char => char.toLowerCase());
}

const csv = fs.readFileSync('./clubs.csv', 'utf-8');

const records = parse(csv, {
  columns: (headers: string[]) =>
    headers.map(header => toCamelCase(header)),
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
});

// Remove duplicate clubs based on clubId
const uniqueClubs = Array.from(
  new Map(
    records.map((club: any) => [
      club.clubId,
      club,
    ]),
  ).values(),
);

fs.writeFileSync(
  './clubs.json',
  JSON.stringify(uniqueClubs, null, 2),
  'utf-8',
);

console.log(`CSV records: ${records.length}`);
console.log(`Unique clubs: ${uniqueClubs.length}`);
console.log('Created: clubs.json');