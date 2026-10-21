// Lists the Maestro flow files that failed in a JUnit report, for scripts/test-e2e.sh --retry to run
// them again: the flow files given, or those at the top of the folders given (as Maestro runs
// them), that match a failed test case by its `file` (its absolute path, in Maestro 2.11's reports)
// or else by its name (the flow's `name:`, or its file name without the extension). When the report
// can't tell (missing, unreadable, or a failed test case that matches no file), it lists every flow
// file given: running too many again beats skipping one.
//
//   node scripts/e2e-failed-flows.mjs <report.xml> <flow file or folder>...
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FLOW_FILE_PATTERN = /\.ya?ml$/;
// Maestro reads a folder's config.yaml as its settings, not as a flow.
const CONFIG_FILE_NAME_SET = new Set(['config.yaml', 'config.yml']);
const XML_ENTITY_MAP = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };

const [reportPath, ...flowPathList] = process.argv.slice(2);
const flowList = flowPathList
  .flatMap((flowPath) => listFlowFiles(flowPath))
  .map((file) => ({ file, name: readFlowName(file) }));
const failedList = readFailedTestCases(reportPath);
const isMatched =
  failedList !== undefined &&
  failedList.length > 0 &&
  failedList.every((testCase) => flowList.some((flow) => isFlowOf(testCase, flow)));
const rerunList = isMatched
  ? flowList.filter((flow) => failedList.some((testCase) => isFlowOf(testCase, flow)))
  : flowList;
process.stdout.write(rerunList.map((flow) => `${flow.file}\n`).join(''));

function decodeXml(text) {
  return text.replaceAll(/&(amp|apos|gt|lt|quot);/g, (_, entity) => XML_ENTITY_MAP[entity]);
}

function isFlowOf(testCase, flow) {
  return testCase.file === undefined
    ? testCase.name === flow.name
    : testCase.file === path.resolve(flow.file);
}

function listFlowFiles(flowPath) {
  return statSync(flowPath).isDirectory()
    ? readdirSync(flowPath)
        .filter((name) => FLOW_FILE_PATTERN.test(name) && !CONFIG_FILE_NAME_SET.has(name))
        .map((name) => path.join(flowPath, name))
        .filter((file) => statSync(file).isFile())
    : [flowPath];
}

// The value of an attribute in a tag (`<testcase id="…" name="…" file="…"`), if it has it.
function readAttribute(tag, attribute) {
  const value = new RegExp(String.raw`\s${attribute}="([^"]*)"`).exec(tag)?.[1];
  return value === undefined ? undefined : decodeXml(value);
}

// The report's failed test cases ({ file, name }); undefined when there's no readable report.
function readFailedTestCases(file) {
  let report;
  try {
    report = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  // Each test case runs up to the next one: its failure, if any, is in it.
  return report
    .split('<testcase')
    .slice(1)
    .filter((testCase) => testCase.includes('<failure') || testCase.includes('<error'))
    .map((testCase) => {
      const tag = testCase.slice(0, testCase.indexOf('>'));
      return { file: readAttribute(tag, 'file'), name: readAttribute(tag, 'name') };
    });
}

// The flow's `name:` in its header (before `---`), else its file name without the extension.
function readFlowName(file) {
  const [header] = readFileSync(file, 'utf8').split(/^---\s*$/m, 1);
  const name = /^name:(.*)$/m.exec(header)?.[1].trim();
  return name
    ? name.replace(/^(["'])(.*)\1$/, '$2')
    : path.basename(file).replace(FLOW_FILE_PATTERN, '');
}
