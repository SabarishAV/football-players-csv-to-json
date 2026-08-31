/**
 * find-duplicate-codes.ts
 *
 * Diagnostic: reads highlightly/merged-clubs.json (or a path you pass in)
 * and reports every clubSlug/code that appears more than once, so you can
 * see exactly which clubs are colliding before deciding how to fix it.
 *
 * Usage:
 *   npx tsx highlightly/find-duplicate-codes.ts
 *   npx tsx highlightly/find-duplicate-codes.ts path/to/all-football-clubs.json
 */

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ClubRecord {
  id: string;
  clubSlug?: string | null;
  clubName: string;
  countryName?: string | null;
  countryCode?: string | null;
  seasonId?: string;
  highlightlyExternalId?: number;
  source?: string;
}

async function main() {
  const filePath = process.argv[2] || 'highlightly/merged-clubs.json';

  const fs = await import('fs/promises');
  const raw = await fs.readFile(filePath, 'utf-8');
  const clubs: ClubRecord[] = JSON.parse(raw);

  console.log(`Loaded ${clubs.length} records from ${filePath}\n`);

  const groups = new Map<string, ClubRecord[]>();

  for (const club of clubs) {
    const code = club.clubSlug?.trim() || slugify(club.clubName);
    const list = groups.get(code) ?? [];
    list.push(club);
    groups.set(code, list);
  }

  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate codes found.');
    return;
  }

  console.log(`Found ${duplicates.length} colliding codes (${duplicates.reduce((sum, [, l]) => sum + l.length, 0)} records affected):\n`);

  for (const [code, list] of duplicates) {
    console.log(`code="${code}" (${list.length} records)`);
    for (const club of list) {
      console.log(
        `  - id=${club.id || '(none)'} name="${club.clubName}" country=${club.countryName ?? club.countryCode ?? '?'} season=${club.seasonId ?? '?'} highlightlyId=${club.highlightlyExternalId ?? '-'} source=${club.source ?? 'original'}`,
      );
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});