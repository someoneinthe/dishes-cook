// Generates docs/features.md, the list of what the app does, from the Gherkin behaviour specs
// (src/**/*.feature): each feature with its description, shared steps and scenarios. The specs are
// run as tests, so the page describes behaviour that is checked, and stays in sync with it.
//
//   npm run docs:features             rewrites docs/features.md
//   npm run docs:features -- --check  fails if docs/features.md is out of date (CI)
import { glob, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC_PATH = path.join(ROOT, 'docs/features.md');
const STEP_KEYWORD_SET = new Set(['*', 'And', 'But', 'Given', 'Then', 'When']);
const SCENARIO_KEYWORD_SET = new Set([
  'Example',
  'Scenario',
  'Scenario Outline',
  'Scenario Template',
]);
// The table of values a scenario outline runs with.
const EXAMPLES_KEYWORD_SET = new Set(['Examples', 'Scenarios']);

// GitHub's heading anchors: lower case, punctuation removed, spaces as dashes.
function anchorOf(title) {
  return title
    .toLowerCase()
    .replaceAll(/[^\d a-z-]/g, '')
    .replaceAll(' ', '-');
}

// The parts of a .feature file the page shows: feature, description, background and scenarios
// with their steps and data tables. Comments and tags are left out.
function parseFeature(text) {
  const feature = { backgroundStepList: [], descriptionList: [], scenarioList: [], title: '' };
  const state = { exampleRowList: undefined, stepList: undefined };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const isSignificant = line !== '' && !line.startsWith('#') && !line.startsWith('@');
    if (isSignificant) {
      readLine(feature, state, line);
    }
  }
  return feature;
}

function parseRow(line) {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

// "When I open the list" -> { keyword: 'When', text: 'I open the list' }, or undefined.
function parseStep(line) {
  const spaceIndex = line.indexOf(' ');
  const keyword = line.slice(0, spaceIndex);
  return spaceIndex > 0 && STEP_KEYWORD_SET.has(keyword)
    ? { keyword, rowList: [], text: line.slice(spaceIndex + 1).trim() }
    : undefined;
}

async function readCurrent() {
  try {
    return await readFile(DOC_PATH, 'utf8');
  } catch {
    return '';
  }
}

// Reads one significant line into the feature; `state.stepList` is where steps go (background or
// current scenario), undefined while still in the description; `state.exampleRowList`, where an
// outline's examples go once its Examples line is read.
function readLine(feature, state, line) {
  const { keyword, rest } = splitKeyword(line);
  if (keyword === 'Feature') {
    feature.title = rest;
    return;
  }
  if (keyword === 'Background') {
    state.stepList = feature.backgroundStepList;
    return;
  }
  if (SCENARIO_KEYWORD_SET.has(keyword)) {
    state.stepList = [];
    state.exampleRowList = undefined;
    feature.scenarioList.push({ exampleRowList: [], stepList: state.stepList, title: rest });
    return;
  }
  if (EXAMPLES_KEYWORD_SET.has(keyword)) {
    state.exampleRowList = feature.scenarioList.at(-1)?.exampleRowList;
    return;
  }
  if (state.stepList === undefined) {
    feature.descriptionList.push(line);
    return;
  }
  if (line.startsWith('|')) {
    (state.exampleRowList ?? state.stepList.at(-1)?.rowList)?.push(parseRow(line));
    return;
  }
  const step = parseStep(line);
  if (step) {
    state.stepList.push(step);
  }
}

function renderFeature(feature) {
  return [
    `## ${feature.title}`,
    '',
    feature.descriptionList.join(' '),
    '',
    ...(feature.backgroundStepList.length > 0
      ? ['**For every scenario:**', '', ...renderSteps(feature.backgroundStepList), '']
      : []),
    ...feature.scenarioList.flatMap((scenario) => [
      `### ${scenario.title}`,
      '',
      ...renderSteps(scenario.stepList),
      '',
      ...(scenario.exampleRowList.length > 0
        ? ['**With each of:**', ...renderTable(scenario.exampleRowList)]
        : []),
    ]),
  ].join('\n');
}

function renderSteps(stepList) {
  return stepList.flatMap((step) => [
    `- **${step.keyword}** ${step.text}`,
    ...(step.rowList.length > 0 ? renderTable(step.rowList) : []),
  ]);
}

function renderTable([header, ...rowList]) {
  return [
    '',
    `  | ${header.join(' | ')} |`,
    `  | ${header.map(() => '---').join(' | ')} |`,
    ...rowList.map((row) => `  | ${row.join(' | ')} |`),
    '',
  ];
}

// "Scenario: Title" -> { keyword: 'Scenario', rest: 'Title' }; a line without a colon has none.
function splitKeyword(line) {
  const colonIndex = line.indexOf(':');
  return colonIndex === -1
    ? { keyword: '', rest: line }
    : { keyword: line.slice(0, colonIndex), rest: line.slice(colonIndex + 1).trim() };
}

const fileList = await Array.fromAsync(glob('src/**/*.feature', { cwd: ROOT }));
const parsedList = await Promise.all(
  fileList.map(async (file) => parseFeature(await readFile(path.join(ROOT, file), 'utf8'))),
);
// By feature name, whatever the folders.
const featureList = parsedList.toSorted((a, b) => a.title.localeCompare(b.title));

const content = [
  '# Features',
  '',
  "<!-- Generated from the behaviour specs (src/**/*.feature) by `npm run docs:features`: don't edit by hand. -->",
  '',
  'What the app does, scenario by scenario. Every scenario runs as a test (jest-cucumber), so this page only describes behaviour that is checked.',
  '',
  ...featureList.map(
    (feature) =>
      `- [${feature.title}](#${anchorOf(feature.title)}): ${feature.scenarioList.length} scenarios`,
  ),
  '',
  ...featureList.map((feature) => renderFeature(feature)),
].join('\n');

const next = await format(content, { ...(await resolveConfig(DOC_PATH)), filepath: DOC_PATH });
const current = await readCurrent();

if (process.argv.includes('--check')) {
  if (next === current) {
    console.warn('docs/features.md is up to date.');
  } else {
    console.error('docs/features.md is out of date: run `npm run docs:features` and commit it.');
    process.exitCode = 1;
  }
} else if (next === current) {
  console.warn('docs/features.md is already up to date.');
} else {
  await writeFile(DOC_PATH, next);
  console.warn('docs/features.md updated.');
}
