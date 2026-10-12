// Checks that installed Expo SDK packages match the versions the *installed* `expo` package expects
// (its bundledNativeModules.json), like expo-doctor's dependency check but offline.
//
// expo-doctor compares against Expo's latest patch releases online. Our 7-day minimum release age
// (.npmrc) refuses patches younger than that, so expo-doctor would fail CI for a week after every
// Expo patch release. This keeps the useful part: wrong SDK / wrong minor versions still fail.
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const expected = require('expo/bundledNativeModules.json');
const project = require('./package.json');

const parse = (version) => version.split('-', 1)[0].split('.').map(Number);

// -1, 0 or 1, comparing [major, minor, patch] tuples.
const compare = (a, b) => Math.sign(a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

// Supports the range forms Expo uses: exact `x.y.z`, `~x.y.z` (same minor) and `^x.y.z` (same major).
function satisfies(version, range) {
  const installed = parse(version);
  const operator = /^[~^]/.test(range) ? range[0] : '=';
  const wanted = parse(range.replace(/^[~^]/, ''));
  const isSameMajor = installed[0] === wanted[0];
  const isSameMinor = isSameMajor && installed[1] === wanted[1];
  const isAtLeast = compare(installed, wanted) >= 0;
  const rules = {
    '=': compare(installed, wanted) === 0,
    '^': isSameMajor && isAtLeast,
    '~': isSameMinor && isAtLeast,
  };
  return rules[operator];
}

const expectedVersions = new Map(Object.entries(expected));
const declared = Object.keys({ ...project.dependencies, ...project.devDependencies });
const mismatches = [];
for (const name of declared) {
  const range = expectedVersions.get(name);
  if (range === undefined) {
    continue;
  }
  const { version } = require(`${name}/package.json`);
  if (!satisfies(version, range)) {
    mismatches.push(`  ${name}: installed ${version}, expo expects ${range}`);
  }
}

if (mismatches.length > 0) {
  console.error(
    `Packages incompatible with the installed Expo SDK (fix with \`npx expo install --fix\`):\n${mismatches.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.warn('Expo SDK dependencies match the installed expo package.');
}
