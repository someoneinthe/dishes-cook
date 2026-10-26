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
    'server/migrations/1792270000-meal-history.js',
    'c6b8fd7dded7c9945b4cd51d995ed360062fb068c052d3d807ca610728bca415',
  ],
  [
    'server/migrations/1792420000-recipe-photo-and-times.js',
    '26705f6032b3ac6d7f7d9bfcf5f1af93629d214905f4a9de8276c497a27798f9',
  ],
  [
    'server/migrations/1792500000-drinks.js',
    '82d674a1d6381c835f07769ed67351884600cb68a5c2bbf24c2f18577dbd0e63',
  ],
  [
    'server/migrations/1792600000-drink-maturation.js',
    '27985b1a91f51989208660ba92e0285da2a89b135634733c5852bbe3132be3c8',
  ],
  [
    'server/migrations/1792700000-recipe-author.js',
    '725b78ea61a07c5a5bf15b4553fbfcdc988260f231a31dbb20daae9dc4773c29',
  ],
  [
    'server/migrations/1792800000-account-names.js',
    '0554a8f3f2d19e4930fd153d113e67fd83b7d65591885ecbe7ca3b0983e90d9f',
  ],
  [
    'server/migrations/1792900000-same-version-unchanged.js',
    '75ea8531a32bfe106eed3d9a81f96c5ff0d6e9c37d156859aa9d929e47348419',
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
  [
    'src/db/migrations/0004_meal-history.sql',
    '8810d97c5df76685858860cfd665b0cecf2f14ae39f5da75738dd9f4d1521091',
  ],
  [
    'src/db/migrations/0005_recipe-photo-and-times.sql',
    '3cd5f32e14931f57b95758e8b548954f05c2cac837c38ce3d544dac21a882246',
  ],
  [
    'src/db/migrations/0006_drinks.sql',
    '7a8c754f7a99222b998b9501bf87369b3feb6c683f7425f63832eff5365bf309',
  ],
  [
    'src/db/migrations/0007_sort-keys-ligatures.sql',
    '6418f1637541e967d7614581b81c7ecbd934b3a79ea4e0388e9559bc9bcdf148',
  ],
  [
    'src/db/migrations/0008_drink-maturation.sql',
    '52b9b1c1731e3380200335f634277afc44e106345f7bcaf87d72055f554dcce7',
  ],
  [
    'src/db/migrations/0009_recipe-author.sql',
    '58f2d32dad7dba63c6404bf22661617fe4364ee068edbe66bffc518e667b883a',
  ],
  [
    'src/db/migrations/0010_account-names.sql',
    '2f2fe0558b055854add5757c40a27be6cd3f28d339ebb207882833b6e23b806e',
  ],
  [
    'src/db/migrations/0011_sync-server-versions.sql',
    '3e0a8829735bc86fdc787bdfda4f0ab353a200318ae307df1faf15c2fc623683',
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
