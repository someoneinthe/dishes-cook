// Checks the coverage of the lines this branch adds or changes, as SonarQube Cloud's quality gate
// does on a PR: at least 80 % of them run by the tests. Sonar's formula: (covered lines + covered
// branches) / (lines to cover + branches), from Jest's report (`coverage/lcov.info`, written by
// `npm run test:ci`) and `git diff` against where the branch left main (uncommitted changes
// included). Files Jest doesn't measure (tests, src/test, routes in src/app) don't count, as in
// sonar-project.properties.
//
//   npm run coverage:new                    fails if the new code's coverage is under 80 %
//   npm run coverage:new -- --base <commit>  the new code since another commit
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const LCOV_PATH = path.join(ROOT, 'coverage/lcov.info');
// SonarQube Cloud's quality gate: coverage on new code.
const MIN_COVERAGE = 80;
const BASE_BRANCH_LIST = ['origin/main', 'main'];

const coverageMap = parseLcov(await readFile(LCOV_PATH, 'utf8'));
const baseOption = process.argv.indexOf('--base');
const changedLineMap = readChangedLines(
  baseOption === -1 ? readBase() : process.argv[baseOption + 1],
);

const total = { covered: 0, toCover: 0 };
const uncoveredList = [];
for (const [file, lineSet] of changedLineMap) {
  const coverage = coverageMap.get(file);
  if (coverage === undefined) {
    continue;
  }
  const missedLineList = [];
  for (const line of lineSet) {
    const hits = coverage.lineHitMap.get(line);
    const branchHitList = coverage.branchHitMap.get(line) ?? [];
    const isLineMissed = hits === 0;
    const missedBranchCount = branchHitList.filter((branchHits) => branchHits === 0).length;
    total.toCover += (hits === undefined ? 0 : 1) + branchHitList.length;
    total.covered += (hits > 0 ? 1 : 0) + branchHitList.length - missedBranchCount;
    if (isLineMissed || missedBranchCount > 0) {
      missedLineList.push(line);
    }
  }
  if (missedLineList.length > 0) {
    uncoveredList.push(`  ${file}: ${toRanges(missedLineList)}`);
  }
}

if (total.toCover === 0) {
  console.warn('New code coverage: no new line to cover.');
} else {
  const percent = (total.covered / total.toCover) * 100;
  const summary = `New code coverage: ${percent.toFixed(1)} % (${total.covered}/${total.toCover} lines and branches, at least ${MIN_COVERAGE} % needed)`;
  if (percent < MIN_COVERAGE) {
    console.error(
      `${summary}. Not run by the tests, wholly or in part:\n${uncoveredList.join('\n')}`,
    );
    process.exitCode = 1;
  } else {
    console.warn(`${summary}.`);
  }
}

function git(...argumentList) {
  // The developer's own git, as for the git hooks that run this script.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync('git', argumentList, { cwd: ROOT, encoding: 'utf8' });
}

// Jest's lcov report: by file (relative path), the hits of each line (DA) and of each branch of a
// line (BRDA, "-" when its line never ran).
function parseLcov(text) {
  const fileMap = new Map();
  const state = { coverage: undefined };
  for (const line of text.split('\n')) {
    readLcovLine(line, fileMap, state);
  }
  return fileMap;
}

// Where this branch left main: the lines changed since are the new code.
function readBase() {
  for (const branch of BASE_BRANCH_LIST) {
    try {
      return git('merge-base', branch, 'HEAD').trim();
    } catch {
      // No such branch here: try the next one.
    }
  }
  throw new Error('No main branch to compare with: `git fetch origin main` first.');
}

// The lines added or changed since `base`, by file (relative path): the "+" side of each hunk.
function readChangedLines(base) {
  const lineMap = new Map();
  let file;
  const diffLineList = git('diff', '--unified=0', '--no-color', base, '--', 'src').split('\n');
  for (const line of diffLineList) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? undefined : line.slice('+++ b/'.length);
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || file === undefined) {
      continue;
    }
    const [start, count = '1'] = [hunk[1], hunk[2]];
    const lineSet = lineMap.get(file) ?? new Set();
    for (let offset = 0; offset < Number(count); offset += 1) {
      lineSet.add(Number(start) + offset);
    }
    lineMap.set(file, lineSet);
  }
  return lineMap;
}

// One line of the lcov report: a file (SF) starts the next lines' coverage.
function readLcovLine(line, fileMap, state) {
  const [tag, value = ''] = line.split(/:(.*)/s, 2);
  if (tag === 'SF') {
    state.coverage = { branchHitMap: new Map(), lineHitMap: new Map() };
    fileMap.set(path.relative(ROOT, path.resolve(ROOT, value)), state.coverage);
    return;
  }
  const { coverage } = state;
  if (tag === 'DA') {
    const [lineNumber, hits] = value.split(',', 2).map(Number);
    coverage.lineHitMap.set(lineNumber, hits);
    return;
  }
  if (tag !== 'BRDA') {
    return;
  }
  // Line, block, branch, hits.
  const [lineNumber, hits] = value.split(',', 4).filter((_, index) => index === 0 || index === 3);
  const hitList = coverage.branchHitMap.get(Number(lineNumber)) ?? [];
  coverage.branchHitMap.set(Number(lineNumber), [...hitList, hits === '-' ? 0 : Number(hits)]);
}

// "3-5, 9" for lines 3, 4, 5 and 9.
function toRanges(lineList) {
  const rangeList = [];
  const sortedLineList = lineList.toSorted((first, second) => first - second);
  for (const line of sortedLineList) {
    const last = rangeList.at(-1);
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      rangeList.push([line, line]);
    }
  }
  return rangeList
    .map(([first, last]) => (first === last ? String(first) : `${first}-${last}`))
    .join(', ');
}
