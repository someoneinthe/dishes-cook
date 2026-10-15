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
    '438b4643f06a3dce2818d1345c232ce1fa22ad14991ba27fd259a3155c8f3201',
  ],
  [
    'src/db/migrations/0000_init.sql',
    '76cc3f90b737b4d4fc587e49f95b56a56dbffc1d15747624574ea1ef73c7a018',
  ],
  [
    'src/db/migrations/0001_ingredient-quantities.sql',
    '1151edd560a8d01bb5dc1f7e104dfe2ba8b7579563071c5c4e96975ae4fb437e',
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
