import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Migrations that already run on phones or on a sync server, with their SHA-256. Both the app
// (Drizzle) and PocketBase only apply migrations newer than the last one they recorded, so an edit
// to one of these never reaches an existing database: change the schema with a new migration.
// Add each new migration here once its PR is ready (the failing test prints its checksum).
const SHIPPED_MIGRATIONS = new Map<string, string>([
  [
    'server/migrations/1792000000-dishes-cook-sync.js',
    'e50490d596f48cf905f70299e672d4b6ed03315904aca4d4949fe6acf3948ebe',
  ],
  [
    'server/migrations/1792080000-recipe-quantities.js',
    '4cb4b741ca945ba1bd6d7e2c1c2ccdd0bb5c22f46486736c9c4a9dd959782e21',
  ],
  [
    'server/migrations/1792250000-sign-in-rate-limit.js',
    'e4acb8b4bdec74f5df6d4d55aa77f0526570752db8601571e3498089f5bddef1',
  ],
  [
    'src/db/migrations/0000_init.sql',
    '76cc3f90b737b4d4fc587e49f95b56a56dbffc1d15747624574ea1ef73c7a018',
  ],
  [
    'src/db/migrations/0001_ingredient-quantities.sql',
    '1151edd560a8d01bb5dc1f7e104dfe2ba8b7579563071c5c4e96975ae4fb437e',
  ],
  [
    'src/db/migrations/0002_ingredient-names-lowercase.sql',
    'c5e2c226e827746802ff31cebb88b9bc230c06e858d6a54d7a25a5885b2de26f',
  ],
  [
    'src/db/migrations/0003_recipe-titles-lowercase.sql',
    'faba07af0ba7330f7f8119d8f59d8b13a1f9e4a91a1209bc9b40181139267ab8',
  ],
]);

const ROOT = path.join(__dirname, '../..');
const MIGRATION_FOLDERS = [
  { extension: '.sql', folder: 'src/db/migrations' },
  { extension: '.js', folder: 'server/migrations' },
];

function checksum(file: string) {
  return createHash('sha256')
    .update(readFileSync(path.join(ROOT, file)))
    .digest('hex');
}

function migrationFiles() {
  return MIGRATION_FOLDERS.flatMap(({ extension, folder }) =>
    readdirSync(path.join(ROOT, folder))
      .filter((name) => name.endsWith(extension) && name !== 'migrations.js')
      .map((name) => `${folder}/${name}`),
  );
}

describe('migrations', () => {
  it.each([...SHIPPED_MIGRATIONS.keys()])('never edits the shipped %s', (file) => {
    expect(checksum(file)).toBe(SHIPPED_MIGRATIONS.get(file));
  });

  it('records the checksum of every migration', () => {
    const unrecordedList = migrationFiles()
      .filter((file) => !SHIPPED_MIGRATIONS.has(file))
      .map((file) => `['${file}', '${checksum(file)}']`);

    expect(unrecordedList).toStrictEqual([]);
  });

  it('applies every app migration listed in the journal', () => {
    const journal = JSON.parse(
      readFileSync(path.join(ROOT, 'src/db/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    // The journal's order is the order they run in; the folder's isn't guaranteed.
    const sqlFileList = migrationFiles()
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
    // The app bundles the migrations listed in migrations.js (what `npm run db:generate` writes).
    const bundled = readFileSync(path.join(ROOT, 'src/db/migrations/migrations.js'), 'utf8');

    expect(sqlFileList).toStrictEqual(
      journal.entries.map(({ tag }) => `src/db/migrations/${tag}.sql`),
    );
    expect(journal.entries.filter(({ tag }) => !bundled.includes(`'./${tag}.sql'`))).toStrictEqual(
      [],
    );
  });
});
