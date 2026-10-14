// Generates the database diagram (Mermaid erDiagram, rendered by GitHub) and the index list from
// src/db/schema.ts into docs/database.md, between the db-diagram markers.
//
//   npm run db:diagram             rewrites docs/database.md
//   npm run db:diagram -- --check  fails if docs/database.md is out of date (CI)
//
// Node runs schema.ts directly (type stripping); Drizzle describes each table.
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC_PATH = path.join(ROOT, 'docs/database.md');
const START = '<!-- db-diagram:start -->';
const END = '<!-- db-diagram:end -->';

const schema = await import(path.join(ROOT, 'src/db/schema.ts'));
const tableList = Object.values(schema)
  .filter((value) => is(value, SQLiteTable))
  .map((table) => getTableConfig(table))
  .toSorted((a, b) => a.name.localeCompare(b.name));

function describeColumn(table, column) {
  const keyList = keysOf(table, column);
  const noteList = [];
  if (column.enumValues) {
    noteList.push(column.enumValues.join(' / '));
  }
  if (!column.notNull) {
    noteList.push('nullable');
  }
  return [
    column.getSQLType().toLowerCase(),
    column.name,
    keyList.join(', '),
    noteList.length > 0 ? `"${noteList.join(', ')}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function diagram() {
  const lineList = ['erDiagram'];
  for (const table of tableList) {
    lineList.push(`  ${table.name} {`);
    for (const column of sortedColumns(table)) {
      lineList.push(`    ${describeColumn(table, column)}`);
    }
    lineList.push('  }');
  }
  for (const table of tableList) {
    for (const foreignKey of table.foreignKeys) {
      const reference = foreignKey.reference();
      const parent = getTableConfig(reference.foreignTable).name;
      // Each row has exactly one parent (zero or one if the key is nullable); a parent has any number.
      const isRequired = reference.columns.every((column) => column.notNull);
      const columnNames = reference.columns.map((column) => column.name).join(', ');
      const onDelete = foreignKey.onDelete ? `, on delete ${foreignKey.onDelete}` : '';
      lineList.push(
        `  ${parent} ${isRequired ? '||' : '|o'}--o{ ${table.name} : "${columnNames}${onDelete}"`,
      );
    }
  }
  return lineList.join('\n');
}

function indexTable() {
  const rowList = [];
  for (const table of tableList) {
    for (const key of table.primaryKeys) {
      rowList.push([table.name, undefined, key.columns.map((column) => column.name), true]);
    }
    for (const { config } of table.indexes) {
      rowList.push([
        table.name,
        config.name,
        config.columns.map((column) => column.name),
        config.unique,
      ]);
    }
  }
  return [
    '| Table | Index | Columns | Unique |',
    '| --- | --- | --- | --- |',
    ...rowList.map(([table, name, columnList, isUnique]) => {
      const indexName = name ? code(name) : 'primary key';
      const columns = columnList.map((column) => code(column)).join(', ');
      return `| ${code(table)} | ${indexName} | ${columns} | ${isUnique ? 'yes' : ''} |`;
    }),
  ].join('\n');
}

const code = (text) => `\`${text}\``;

// PK, FK and UK (single-column unique) markers of a column.
function keysOf(table, column) {
  const keyList = [];
  if (column.primary || table.primaryKeys.some((key) => key.columns.includes(column))) {
    keyList.push('PK');
  }
  if (table.foreignKeys.some((key) => key.reference().columns.includes(column))) {
    keyList.push('FK');
  }
  const isUniqueIndex = table.indexes.some(
    ({ config }) => config.columns.length === 1 && config.unique && config.columns[0] === column,
  );
  if (isUniqueIndex || column.isUnique) {
    keyList.push('UK');
  }
  return keyList;
}

// Keys first, then the other columns in schema order.
function sortedColumns(table) {
  const isKey = (column) => keysOf(table, column).some((key) => key === 'PK' || key === 'FK');
  return [
    ...table.columns.filter((column) => isKey(column)),
    ...table.columns.filter((column) => !isKey(column)),
  ];
}

const generated = [
  START,
  "<!-- Generated from src/db/schema.ts by `npm run db:diagram`: don't edit by hand. -->",
  '',
  '```mermaid',
  diagram(),
  '```',
  '',
  'Integer primary keys are SQLite rowids.',
  '',
  indexTable(),
  END,
].join('\n');

const current = await readFile(DOC_PATH, 'utf8');
const startIndex = current.indexOf(START);
const endIndex = current.indexOf(END);
if (startIndex === -1 || endIndex === -1) {
  throw new Error(`${DOC_PATH} must contain the ${START} and ${END} markers.`);
}
const next = await format(
  current.slice(0, startIndex) + generated + current.slice(endIndex + END.length),
  { ...(await resolveConfig(DOC_PATH)), filepath: DOC_PATH },
);

if (process.argv.includes('--check')) {
  if (next === current) {
    console.warn('docs/database.md is up to date.');
  } else {
    console.error('docs/database.md is out of date: run `npm run db:diagram` and commit it.');
    process.exitCode = 1;
  }
} else if (next === current) {
  console.warn('docs/database.md is already up to date.');
} else {
  await writeFile(DOC_PATH, next);
  console.warn('docs/database.md updated.');
}
