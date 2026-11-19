// Written with the help of Claude
// Compares the JUnit reports of several runs of the same test suite on the same commit and lists the tests whose
// result differed between the runs (flaky) and the tests that failed in every run (always failing).
// Used by .github/workflows/flaky-tests.yml. Plain Node, no dependencies.
//
// The folder holds repeat-<n>.xml (Node's junit reporter) and repeat-<n>.exit (the exit code of that run).
// A test is identified by its file and its full name: the names of its suites and its own, joined by " > ".
// The report goes to stdout and, when GITHUB_STEP_SUMMARY is set, to the job summary.
// Exit code 0 only when every test passed (or was skipped) in every repeat; 1 otherwise; 2 on wrong usage.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const USAGE = `Usage: node scripts/flaky-tests/compare.mjs --dir DIR [--repeats N]
  --dir      folder with repeat-<n>.xml and repeat-<n>.exit
  --repeats  number of repeats that should be there; a missing one counts as failed`;

const ENTITIES = new Map([
  ['lt', '<'],
  ['gt', '>'],
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
]);
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;
// Every file the script reads stays inside the working directory: run it from the repository root.
const ROOT = process.cwd();

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, name) => {
    if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES.get(name) ?? match;
  });
}

function attributes(source) {
  return new Map([...source.matchAll(ATTRIBUTE)].map(([, name, value]) => [name, decode(value)]));
}

/** Yields { closing, name, attrs, selfClosing } for every element tag; skips comments, declarations and text. */
function* tags(xml) {
  let at = xml.indexOf('<');
  while (at !== -1) {
    if (xml.startsWith('<!--', at)) {
      const close = xml.indexOf('-->', at);
      at = close === -1 ? -1 : xml.indexOf('<', close + 3);
      continue;
    }
    // Node escapes "<" and quotes inside attribute values but not ">", so the tag ends at the first ">" outside quotes.
    let end = at + 1;
    let quoted = false;
    while (end < xml.length && (quoted || xml.charAt(end) !== '>')) {
      if (xml.charAt(end) === '"') quoted = !quoted;
      end++;
    }
    const inner = xml.slice(at + 1, end);
    at = xml.indexOf('<', end);
    if (inner.startsWith('?') || inner.startsWith('!')) continue;
    const closing = inner.startsWith('/');
    const selfClosing = inner.endsWith('/');
    const body = inner.slice(closing ? 1 : 0, selfClosing ? -1 : undefined).trim();
    const space = body.search(/\s/);
    const name = space === -1 ? body : body.slice(0, space);
    yield { closing, name, attrs: attributes(space === -1 ? '' : body.slice(space)), selfClosing };
  }
}

/** Returns [{ file, name, result: 'pass' | 'fail' | 'skip' }] of one JUnit report. */
function parseJunit(xml) {
  const suites = [];
  const tests = [];
  let current = null;
  for (const { closing, name, attrs, selfClosing } of tags(xml)) {
    if (name === 'testsuite') {
      if (closing) suites.pop();
      else if (!selfClosing) suites.push(attrs.get('name') ?? '');
    } else if (name === 'testcase') {
      if (closing) {
        current = null;
        continue;
      }
      const file = attrs.get('file');
      const test = {
        file: file ? relative(ROOT, file) || file : '(unknown file)',
        name: [...suites, attrs.get('name') ?? ''].join(' > '),
        result: attrs.has('failure') ? 'fail' : 'pass',
      };
      tests.push(test);
      current = selfClosing ? null : test;
    } else if (current && !closing && (name === 'failure' || name === 'error')) {
      current.result = 'fail';
    } else if (current && !closing && name === 'skipped' && current.result !== 'fail') {
      current.result = 'skip';
    }
  }
  return tests;
}

// The file helpers take paths built from --dir on purpose; each checks its path right before the file system call.
function insideRoot(path) {
  const full = resolve(ROOT, path);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) {
    throw new Error(`${path} is outside the working directory`);
  }
  return full;
}

function exists(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- checked to be inside ROOT
  return existsSync(insideRoot(path));
}

function readText(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- checked to be inside ROOT
  return readFileSync(insideRoot(path), 'utf8');
}

function listFolder(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- checked to be inside ROOT
  return readdirSync(insideRoot(path));
}

/** Reads the repeats of a folder: [{ number, exitCode, tests, problem }]. */
function readRepeats(dir, expected) {
  const numbers = new Set();
  for (const entry of listFolder(dir)) {
    const match = /^repeat-(\d+)\.(xml|exit)$/.exec(entry);
    if (match) numbers.add(Number(match[1]));
  }
  for (let number = 1; number <= expected; number++) numbers.add(number);
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const xmlPath = join(dir, `repeat-${number}.xml`);
      const exitPath = join(dir, `repeat-${number}.exit`);
      const exitCode = exists(exitPath) ? Number(readText(exitPath).trim()) : null;
      if (!exists(xmlPath)) {
        return { number, exitCode, tests: [], problem: 'no JUnit report' };
      }
      const tests = parseJunit(readText(xmlPath));
      if (tests.length === 0) {
        return { number, exitCode, tests, problem: 'the JUnit report lists no tests' };
      }
      if (exitCode === null) {
        return { number, exitCode, tests, problem: 'no exit code: the run did not finish' };
      }
      return { number, exitCode, tests, problem: null };
    });
}

/** Groups the results by test; a test whose file and name repeat within one run gets " (#2)", " (#3)"... */
function compare(repeats) {
  const byTest = new Map();
  repeats.forEach((repeat, index) => {
    const seen = new Map();
    for (const test of repeat.tests) {
      const baseKey = `${test.file}\u0000${test.name}`;
      const occurrence = (seen.get(baseKey) ?? 0) + 1;
      seen.set(baseKey, occurrence);
      const key = `${baseKey}\u0000${occurrence}`;
      if (!byTest.has(key)) {
        const name = occurrence > 1 ? `${test.name} (#${occurrence})` : test.name;
        byTest.set(key, { file: test.file, name, results: new Map() });
      }
      byTest.get(key).results.set(index, test.result);
    }
  });

  const flaky = [];
  const alwaysFailing = [];
  for (const test of byTest.values()) {
    const results = repeats.map((repeat, index) => test.results.get(index) ?? 'missing');
    const count = (result) => results.filter((r) => r === result).length;
    const summary = {
      file: test.file,
      name: test.name,
      pass: count('pass'),
      fail: count('fail'),
      skip: count('skip'),
      missing: count('missing'),
    };
    if (summary.fail === repeats.length) alwaysFailing.push(summary);
    else if (new Set(results).size > 1) flaky.push(summary);
  }
  const order = (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name);
  return { total: byTest.size, flaky: flaky.sort(order), alwaysFailing: alwaysFailing.sort(order) };
}

function cell(text) {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function report(repeats, { total, flaky, alwaysFailing }, compared) {
  const failedRepeats = repeats.filter(
    (r) => r.problem || r.exitCode !== 0 || r.tests.some((test) => test.result === 'fail'),
  );
  const lines = ['## Flaky tests', ''];
  lines.push(
    `Repeats: ${repeats.length}, compared: ${compared}. Failed repeats: ${failedRepeats.length} of ${repeats.length}.`,
  );
  lines.push(`Distinct tests: ${total}. Flaky: ${flaky.length}. Always failing: ${alwaysFailing.length}.`, '');

  if (failedRepeats.length > 0) {
    lines.push('| Repeat | Exit code | Failed tests | Problem |', '|---|---|---|---|');
    for (const r of failedRepeats) {
      const failed = r.tests.filter((test) => test.result === 'fail').length;
      lines.push(`| ${r.number} | ${r.exitCode ?? '—'} | ${failed} | ${r.problem ?? ''} |`);
    }
    lines.push('');
  }

  const table = (title, tests) => {
    lines.push(`### ${title}`, '');
    if (tests.length === 0) {
      lines.push('None.', '');
      return;
    }
    lines.push('| File | Test | Passed | Failed | Skipped | Missing |', '|---|---|---|---|---|---|');
    for (const t of tests) {
      lines.push(`| ${cell(t.file)} | ${cell(t.name)} | ${t.pass} | ${t.fail} | ${t.skip} | ${t.missing} |`);
    }
    lines.push('');
  };
  table('Flaky: the result differed between repeats', flaky);
  table('Always failing: failed in every repeat (not flaky)', alwaysFailing);

  const green = failedRepeats.length === 0 && flaky.length === 0 && alwaysFailing.length === 0;
  lines.push(green ? 'Every test passed in every repeat.' : 'Not green: see above.');
  return { text: lines.join('\n') + '\n', green, failedRepeats: failedRepeats.length };
}

function main() {
  let options;
  try {
    ({ values: options } = parseArgs({ options: { dir: { type: 'string' }, repeats: { type: 'string' } } }));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  const expected = options.repeats === undefined ? 0 : Number(options.repeats);
  if (!options.dir || !Number.isInteger(expected) || expected < 0) {
    console.error(USAGE);
    return 2;
  }
  if (!exists(options.dir)) {
    console.error(`${options.dir} does not exist`);
    return 1;
  }
  const repeats = readRepeats(options.dir, expected);
  if (repeats.length === 0) {
    console.error(`No repeat-<n>.xml in ${options.dir}`);
    return 1;
  }
  // A repeat without results only counts as failed; compared, it would make every test look flaky.
  const withResults = repeats.filter((repeat) => repeat.tests.length > 0);
  const { text, green, failedRepeats } = report(repeats, compare(withResults), withResults.length);
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- the summary file the Actions runner provides
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  }
  console.log(`Failed repeats in total: ${failedRepeats} of ${repeats.length}`);
  return green ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
