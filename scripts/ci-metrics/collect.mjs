// Written with the help of Claude
// Collects every attempt of the CI workflow (.github/workflows/ci.yml) on main from the GitHub REST API and writes
// runs.json (raw runs, jobs and PR commits) and a Markdown table in the format of docs/ci-cd/metrics-raw.md.
// With --metrics it reads runs.json back and computes the four DORA metrics into dora-metrics.json.
// Read-only: it creates no workflow and starts nothing in Actions. See README.md next to this file.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const WORKFLOW_FILE = 'ci.yml';
const BRANCH = 'main';
const SKIPPED_ACTORS = new Set(['dependabot[bot]']);
const PARALLEL_REQUESTS = 6;
const RED = new Set(['failure', 'timed_out', 'startup_failure']);
const API_ORIGIN = 'https://api.github.com';
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CAUSE_PATTERN = /^[a-z0-9-]+$/;
const STATUS_PATTERN = /^[a-z_]+$/;
// Every file the script reads or writes stays inside the working directory: run it from the repository root.
const ROOT = process.cwd();

const USAGE = `Usage: node scripts/ci-metrics/collect.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out DIR]
                                            [--table FILE] [--notes FILE] [--repo OWNER/NAME]
       node scripts/ci-metrics/collect.mjs --metrics [--from ...] [--to ...] [--out DIR] [--notes FILE]
                                            [--exclude-runs 1-60,89] [--ignore-failure-causes billing,...]
  --from, --to  UTC dates of run creation, inclusive; the whole history by default
  --out         folder for runs.json and, unless --table is given, metrics-raw.md (default: ci-metrics-out)
  --table       path of the generated Markdown table
  --notes       JSON file with the Note column, status overrides and failure causes (see README.md)
  --repo        repository; read from the origin remote by default
  --metrics     read <out>/runs.json instead of the API and write <out>/dora-metrics.json
  --exclude-runs            row numbers (№) to leave out of the metrics, e.g. 1-60,89
  --ignore-failure-causes   causes from --notes whose red runs count as neither a deployment nor a failure
Auth: GITHUB_TOKEN, otherwise the token of \`gh auth login\` (not needed with --metrics).`;

function fail(message) {
  console.error(`collect: ${message}`);
  process.exit(1);
}

// The guards below throw instead of calling fail(): a throw visibly ends the function, so nothing after a guard can
// run with a value it refused. main() reports the error through fail().

// Resolves a path against ROOT and throws when it leaves ROOT.
function assertInsideRoot(path, message = `${path} must stay inside ${ROOT}`) {
  const resolved = resolve(ROOT, path);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${sep}`)) {
    throw new Error(message);
  }
  return resolved;
}

// Resolves a path from the command line and refuses one that leaves ROOT.
function repoPath(input, option) {
  return assertInsideRoot(input, `--${option} must point inside ${ROOT}, got "${input}"`);
}

// A string read from runs.json or notes.json is only printed after it matched a strict pattern.
function assertMatches(value, pattern, message) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(message);
  }
  return value;
}

function parseOptions() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        from: { type: 'string' },
        to: { type: 'string' },
        out: { type: 'string', default: 'ci-metrics-out' },
        table: { type: 'string' },
        notes: { type: 'string' },
        repo: { type: 'string' },
        metrics: { type: 'boolean', default: false },
        'exclude-runs': { type: 'string' },
        'ignore-failure-causes': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (error) {
    fail(`${error.message}\n${USAGE}`);
  }
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  for (const [name, value] of [
    ['from', values.from],
    ['to', values.to],
  ]) {
    if (value !== undefined && !DATE_PATTERN.test(value)) {
      throw new Error(`--${name} must be a date like 2026-10-20, got "${value}"`);
    }
  }
  if (values.from && values.to && values.from > values.to) {
    fail('--from is after --to');
  }
  if (!values.metrics && (values['exclude-runs'] || values['ignore-failure-causes'])) {
    fail('--exclude-runs and --ignore-failure-causes only apply with --metrics');
  }
  if (values.repo !== undefined && !REPO_PATTERN.test(values.repo)) {
    fail(`--repo must be OWNER/NAME, got "${values.repo}"`);
  }
  values.out = repoPath(values.out, 'out');
  values.table = values.table === undefined ? undefined : repoPath(values.table, 'table');
  values.notes = values.notes === undefined ? undefined : repoPath(values.notes, 'notes');
  return values;
}

// The two file helpers take paths from the command line on purpose. Each checks the path itself, right before the
// file system call, so a path joined after parseOptions is checked as well.
function readJson(path, hint) {
  const safePath = assertInsideRoot(path);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI path, checked to be inside ROOT above
    return JSON.parse(readFileSync(safePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail(`${safePath} not found${hint ? `; ${hint}` : ''}`);
    }
    throw error;
  }
}

function writeText(path, text) {
  const safePath = assertInsideRoot(path);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI path, checked to be inside ROOT above
  mkdirSync(dirname(safePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI path, checked to be inside ROOT above
  writeFileSync(safePath, text);
}

function readToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (token.trim()) {
      return token.trim();
    }
  } catch {
    // Falls through to the error below.
  }
  fail('no GitHub token. Set GITHUB_TOKEN or sign in with `gh auth login`.');
}

function readRepo(option) {
  if (option) {
    return option;
  }
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    const host = url.indexOf('github.com');
    if (host >= 0) {
      const path = url.slice(host + 'github.com'.length + 1);
      const repo = path.endsWith('.git') ? path.slice(0, -'.git'.length) : path;
      if (REPO_PATTERN.test(repo)) {
        return repo;
      }
    }
  } catch {
    // Falls through to the error below.
  }
  fail('cannot read the repository from the origin remote; pass --repo OWNER/NAME');
}

// Builds an API URL from path segments and query parameters, each encoded; nothing from the input is pasted raw.
function apiUrl(segments, params = {}) {
  const url = new URL(`/${segments.map((segment) => encodeURIComponent(String(segment))).join('/')}`, API_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

const repoApi = (repo, segments, params) => apiUrl(['repos', ...repo.split('/'), ...segments], params);

// The target of the `rel="next"` entry of a Link header, or null.
function nextLink(link) {
  for (const part of (link ?? '').split(',')) {
    const [target, ...params] = part.split(';').map((piece) => piece.trim());
    if (params.includes('rel="next"') && target.startsWith('<') && target.endsWith('>')) {
      return target.slice(1, -1);
    }
  }
  return null;
}

function createClient(token) {
  // `target` is a URL from apiUrl or from a Link header; only the API's own origin is called, with the token in a header.
  async function request(target) {
    const url = new URL(target);
    if (url.origin !== API_ORIGIN) {
      fail(`refusing to call ${url.origin}: only ${API_ORIGIN} is expected`);
    }
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'ci-metrics-collector',
        },
      });
      if (res.ok) {
        return { body: await res.json(), link: res.headers.get('link') };
      }
      const retryable = res.status >= 500 || res.status === 429 || res.headers.get('x-ratelimit-remaining') === '0';
      if (retryable && attempt < 4) {
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000 - Date.now();
        await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(reset, attempt * 2000), 60_000)));
        continue;
      }
      if (res.status === 401) {
        fail('GitHub rejected the token (401). Check GITHUB_TOKEN or run `gh auth login`.');
      }
      throw new Error(`GET ${url.pathname}${url.search} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }

  // Follows the Link header; `pick` takes the array out of a page body.
  async function paginate(first, pick) {
    const items = [];
    let next = new URL(first);
    next.searchParams.set('per_page', '100');
    while (next) {
      const { body, link } = await request(next);
      items.push(...pick(body));
      const following = nextLink(link);
      next = following ? new URL(following) : null;
    }
    return items;
  }

  return { request, paginate };
}

// Runs `fn` over `items` with at most `limit` calls in flight; the results keep the order of `items`.
async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      // eslint-disable-next-line security/detect-object-injection -- the index is the worker's own counter
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

const pickRun = (run) => ({
  id: run.id,
  run_number: run.run_number,
  event: run.event,
  head_branch: run.head_branch,
  head_sha: run.head_sha,
  head_commit: run.head_commit && {
    message: run.head_commit.message.split('\n')[0],
    author_date: run.head_commit.timestamp,
  },
  actor: run.actor?.login,
  triggering_actor: run.triggering_actor?.login,
  status: run.status,
  conclusion: run.conclusion,
  run_attempt: run.run_attempt,
  created_at: run.created_at,
  run_started_at: run.run_started_at,
  updated_at: run.updated_at,
  html_url: run.html_url,
});

const pickAttempt = (attempt) => ({
  run_attempt: attempt.run_attempt,
  status: attempt.status,
  conclusion: attempt.conclusion,
  triggering_actor: attempt.triggering_actor?.login,
  created_at: attempt.created_at,
  run_started_at: attempt.run_started_at,
  updated_at: attempt.updated_at,
});

// Steps are kept only for jobs that did not pass: they show where a red run broke.
const pickJob = (job) => ({
  id: job.id,
  name: job.name,
  run_attempt: job.run_attempt,
  status: job.status,
  conclusion: job.conclusion,
  created_at: job.created_at,
  started_at: job.started_at,
  completed_at: job.completed_at,
  runner_name: job.runner_name || null,
  html_url: job.html_url,
  ...(job.conclusion !== 'success' && job.conclusion !== 'skipped'
    ? {
        steps: (job.steps ?? []).map((step) => ({
          number: step.number,
          name: step.name,
          conclusion: step.conclusion,
          started_at: step.started_at,
          completed_at: step.completed_at,
        })),
      }
    : {}),
});

const minutesBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 60_000;

// Queue: from the start of the attempt to the first job that got a runner. Execution: from that job's start to the
// completion of the attempt's last job. Skipped jobs never run, and in a re-run the jobs that were not re-run keep
// their times from the earlier attempt, so neither counts.
function timings(attempt, jobs) {
  const attemptStart = attempt.run_started_at ?? attempt.created_at;
  const own = jobs.filter(
    (job) => job.conclusion !== 'skipped' && Date.parse(job.started_at) >= Date.parse(attemptStart),
  );
  const started = own.filter((job) => job.runner_name || job.steps?.length);
  if (started.length === 0) {
    return {
      attempt_started_at: attemptStart,
      first_job_started_at: null,
      last_job_completed_at: null,
      queue_min: null,
      execution_min: null,
    };
  }
  const firstStart = started.map((job) => job.started_at).sort()[0];
  const lastEnd = own
    .map((job) => job.completed_at)
    .sort()
    .at(-1);
  return {
    attempt_started_at: attemptStart,
    first_job_started_at: firstStart,
    last_job_completed_at: lastEnd,
    queue_min: minutesBetween(attemptStart, firstStart),
    execution_min: minutesBetween(firstStart, lastEnd),
  };
}

// A commit can be in several PRs (e.g. one into main and one into staging); the PR that produced it wins.
function choosePull(sha, pulls) {
  const merged = pulls.filter((pull) => pull.merged_at);
  return (
    merged.find((pull) => pull.merge_commit_sha === sha) ??
    merged.filter((pull) => pull.base === BRANCH).sort((a, b) => a.merged_at.localeCompare(b.merged_at))[0] ??
    merged[0] ??
    null
  );
}

async function collectCommit(client, repo, sha) {
  const [pulls, { body: commit }] = await Promise.all([
    client.paginate(repoApi(repo, ['commits', sha, 'pulls']), (page) => page),
    client.request(repoApi(repo, ['commits', sha])),
  ]);
  const associated = pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    base: pull.base.ref,
    head: pull.head.ref,
    merged_at: pull.merged_at,
    merge_commit_sha: pull.merge_commit_sha,
  }));
  let chosen = choosePull(sha, associated)?.number ?? null;
  let source = chosen ? 'commits/{sha}/pulls' : null;
  // When two PRs are merged within a second, GitHub can link the merge commit to no PR at all. The merge commit's
  // own message still names it; the PR is taken only if it was merged into main and has the commit as a parent.
  const named = commit.commit.message.match(/^Merge pull request #(\d+) /)?.[1];
  if (!chosen && named && commit.parents.length === 2) {
    const { body: pull } = await client.request(repoApi(repo, ['pulls', named]));
    if (pull.merged_at && pull.base.ref === BRANCH && commit.parents.some((parent) => parent.sha === pull.head.sha)) {
      chosen = pull.number;
      source = 'merge commit message';
    }
  }
  return {
    message: commit.commit.message.split('\n')[0],
    parents: commit.parents.map((parent) => parent.sha),
    author_date: commit.commit.author.date,
    committer_date: commit.commit.committer.date,
    associated_pulls: associated,
    pull: chosen,
    pull_source: source,
  };
}

async function collectPull(client, repo, number) {
  const prCommits = await client.paginate(repoApi(repo, ['pulls', number, 'commits']), (page) => page);
  const list = prCommits.map((c) => ({
    sha: c.sha,
    author_date: c.commit.author.date,
    committer_date: c.commit.committer.date,
  }));
  return {
    url: `https://github.com/${repo}/pull/${number}`,
    first_commit_at: list.map((c) => c.author_date).sort()[0] ?? null,
    commits: list,
  };
}

async function collect({ client, repo, from, to }) {
  const params = { branch: BRANCH, ...(from || to ? { created: `${from ?? '*'}..${to ?? '*'}` } : {}) };
  const listed = await client.paginate(
    repoApi(repo, ['actions', 'workflows', WORKFLOW_FILE, 'runs'], params),
    (body) => body.workflow_runs,
  );
  // `branch` matches head_branch, which a pull_request run from a fork's main would also have.
  const runs = listed
    .filter((run) => run.event !== 'pull_request' && !SKIPPED_ACTORS.has(run.actor?.login))
    .map(pickRun)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);

  console.error(`collect: ${runs.length} runs, ${runs.reduce((sum, run) => sum + run.run_attempt, 0)} attempts`);

  const attemptTasks = runs.flatMap((run) =>
    Array.from({ length: run.run_attempt }, (_, i) => ({ run, attempt: i + 1 })),
  );
  const attempts = await mapLimited(attemptTasks, PARALLEL_REQUESTS, async ({ run, attempt }) => {
    const base = ['actions', 'runs', run.id, 'attempts', attempt];
    const [{ body }, jobs] = await Promise.all([
      client.request(repoApi(repo, base)),
      client.paginate(repoApi(repo, [...base, 'jobs']), (page) => page.jobs),
    ]);
    const picked = pickAttempt(body);
    const pickedJobs = jobs.map(pickJob);
    return { run_id: run.id, ...picked, timings: timings(picked, pickedJobs), jobs: pickedJobs };
  });
  for (const run of runs) {
    run.attempts = attempts.filter((attempt) => attempt.run_id === run.id).map(({ run_id: _runId, ...rest }) => rest);
  }

  const shas = [...new Set(runs.map((run) => run.head_sha))];
  const commits = Object.fromEntries(
    await mapLimited(shas, PARALLEL_REQUESTS, async (sha) => [sha, await collectCommit(client, repo, sha)]),
  );

  const pullNumbers = [
    ...new Set(
      Object.values(commits)
        .map((commit) => commit.pull)
        .filter(Boolean),
    ),
  ];
  const pulls = Object.fromEntries(
    await mapLimited(pullNumbers, PARALLEL_REQUESTS, async (number) => [
      number,
      await collectPull(client, repo, number),
    ]),
  );

  return { runs, commits, pulls };
}

const pad = (n) => String(n).padStart(2, '0');
const shortDate = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
};
const shortDateTime = (iso) =>
  `${shortDate(iso)} ${pad(new Date(iso).getUTCHours())}:${pad(new Date(iso).getUTCMinutes())}`;
const minutes = (value) => (value === null ? '—' : value.toFixed(1));
const STATUS_ICONS = { success: '✅', failure: '❌', timed_out: '❌', startup_failure: '❌', cancelled: '⏹️' };

const noteOf = (notes, row) => notes[`${row.run_id}/${row.run_attempt}`] ?? {};

function buildRows(data, notes) {
  const rows = [];
  for (const run of data.runs) {
    const commit = data.commits[run.head_sha];
    const pull = commit.pull ? data.pulls[commit.pull] : null;
    for (const attempt of run.attempts) {
      const manual = noteOf(notes, { run_id: run.id, run_attempt: attempt.run_attempt });
      rows.push({
        number: rows.length + 1,
        run_id: run.id,
        run_number: run.run_number,
        run_attempt: attempt.run_attempt,
        event: run.event,
        head_sha: run.head_sha,
        pull: commit.pull,
        first_commit_at: pull ? pull.first_commit_at : commit.author_date,
        run_created_at: run.created_at,
        created_at: attempt.created_at,
        completed_at: attempt.timings.last_job_completed_at ?? attempt.updated_at,
        queue_min: attempt.timings.queue_min,
        execution_min: attempt.timings.execution_min,
        conclusion: attempt.conclusion,
        status: manual.status ?? attempt.conclusion ?? attempt.status,
        status_overridden: manual.status !== undefined,
        cause: manual.cause ?? null,
        note: manual.note ?? '',
        evidence: manual.evidence ?? null,
        url: run.html_url,
      });
    }
  }
  return rows;
}

function renderTable({ rows, repo, from, to, firstRunOn, collectedOn }) {
  const first = from ?? firstRunOn ?? collectedOn;
  const last = to ?? collectedOn;
  const firstYear = first.slice(0, 4);
  const lastYear = last.slice(0, 4);
  const fromText = firstYear === lastYear ? shortDate(first) : `${shortDate(first)}.${firstYear}`;
  const lines = [
    '# CI Metrics: Raw Data',
    '',
    `Runs of the \`CI\` workflow on \`main\` from ${fromText} to ${shortDate(last)}.${lastYear} (UTC dates), collected from the GitHub Actions API on ${collectedOn}.`,
    '',
    '| № | Commit | PR | First PR commit | Run completed | Queue, min | Execution, min | Status | Note |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    const commit = `[\`${row.head_sha.slice(0, 7)}\`](${row.url})`;
    const pr = row.pull ? `[#${row.pull}](https://github.com/${repo}/pull/${row.pull})` : '—';
    // A run cancelled before any job started never completed anything; a red run without a runner still did.
    const done = row.queue_min === null && row.conclusion === 'cancelled' ? '—' : shortDateTime(row.completed_at);
    const status = STATUS_ICONS[row.status] ?? row.status;
    lines.push(
      `| ${row.number} | ${commit} | ${pr} | ${shortDateTime(row.first_commit_at)} | ${done} | ${minutes(row.queue_min)} | ${minutes(row.execution_min)} | ${status} | ${row.note} |`,
    );
  }
  lines.push(
    '',
    '## AI Usage Note',
    '',
    'The data was collected and the table generated by Claude Code from the GitHub Actions API; the failure causes were taken from the run logs. Reviewed by the team.',
    '',
  );
  return lines.join('\n');
}

// --- DORA metrics, by the lab's definitions (see README.md, "Metrics") ---

function parseRowNumbers(text) {
  const numbers = new Set();
  for (const part of (text ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const bounds = part.split('-').map((bound) => (/^\d+$/.test(bound) ? Number(bound) : Number.NaN));
    if (bounds.length > 2 || bounds.some(Number.isNaN)) {
      fail(`--exclude-runs: "${part}" is not a row number or a range like 1-60`);
    }
    const [from, to = from] = bounds;
    if (to < from) {
      fail(`--exclude-runs: the range "${part}" is empty`);
    }
    for (let n = from; n <= to; n++) {
      numbers.add(n);
    }
  }
  return numbers;
}

function parseCauses(text) {
  const causes = (text ?? '')
    .split(',')
    .map((cause) => cause.trim())
    .filter(Boolean);
  const bad = causes.find((cause) => !CAUSE_PATTERN.test(cause));
  if (bad) {
    fail(`--ignore-failure-causes: "${bad}" is not a tag like billing or ghcr-denied`);
  }
  return new Set(causes);
}

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;
const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
const median = (values) => {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted.at(mid) : (sorted.at(mid - 1) + sorted.at(mid)) / 2;
};
const durationText = (min) => {
  if (min === null) {
    return null;
  }
  const whole = Math.round(min);
  const parts = [];
  if (whole >= 1440) {
    parts.push(`${Math.floor(whole / 1440)} d`);
  }
  if (whole % 1440 >= 60) {
    parts.push(`${Math.floor((whole % 1440) / 60)} h`);
  }
  parts.push(`${whole % 60} min`);
  return parts.join(' ');
};
const stats = (values) => ({
  count: values.length,
  mean_min: mean(values) === null ? null : round1(mean(values)),
  mean_text: durationText(mean(values)),
  median_min: median(values) === null ? null : round1(median(values)),
  median_text: durationText(median(values)),
});
const rowRef = (row) => ({
  row: row.number,
  run_number: row.run_number,
  run_attempt: row.run_attempt,
  completed_at: row.completed_at,
  url: `${row.url}/attempts/${row.run_attempt}`,
});

// A row is a deployment (green), a failure (red, unless its cause is ignored) or neither: cancelled runs and
// ignored red runs. `kind` drives every metric below.
function classify(row, ignoredCauses) {
  if (row.status === 'success') {
    return 'deployment';
  }
  if (RED.has(row.status)) {
    return ignoredCauses.has(row.cause) ? 'ignored' : 'failure';
  }
  return 'not_completed';
}

function computeMetrics({ data, notes, from, to, excludeRunsText, ignoredCauses }) {
  const excludeRows = parseRowNumbers(excludeRunsText);
  if (!data.rows.length || data.rows[0].run_created_at === undefined) {
    fail('runs.json comes from an older collector or is empty; collect again first');
  }
  // Without --from/--to the period comes from runs.json; it is printed, so it must be a plain date.
  const periodFrom = assertMatches(
    from ?? data.period?.from ?? data.rows[0].run_created_at.slice(0, 10),
    DATE_PATTERN,
    'runs.json: the start of the period is not a date like 2026-10-20; collect again first',
  );
  const periodTo = assertMatches(
    to ?? data.period?.to ?? data.collected_at.slice(0, 10),
    DATE_PATTERN,
    'runs.json: the end of the period is not a date like 2026-10-20; collect again first',
  );
  const days =
    Math.round((Date.parse(`${periodTo}T00:00:00Z`) - Date.parse(`${periodFrom}T00:00:00Z`)) / 86_400_000) + 1;

  const withNotes = data.rows.map((row) => {
    const manual = notes ? noteOf(notes, row) : {};
    return {
      ...row,
      status: manual.status ?? (notes ? row.conclusion : row.status),
      cause: manual.cause ?? (notes ? null : row.cause),
    };
  });
  const inPeriod = withNotes.filter((row) => {
    const day = row.run_created_at.slice(0, 10);
    return day >= periodFrom && day <= periodTo;
  });
  const excluded = inPeriod.filter((row) => excludeRows.has(row.number));
  const kept = inPeriod
    .filter((row) => !excludeRows.has(row.number))
    .map((row) => ({ ...row, kind: classify(row, ignoredCauses) }));
  // Main is as green as its last completed run, so the timeline follows completion.
  const timeline = [...kept].sort((a, b) => a.completed_at.localeCompare(b.completed_at) || a.number - b.number);
  const byKind = (kind) => kept.filter((row) => row.kind === kind);
  const deployments = byKind('deployment');
  const failures = byKind('failure');

  // Lead time, per change (a PR, or a commit pushed directly): from its first commit to the completion of the first
  // green run created at or after the change's own first run. Main is linear, so every later run contains the commit.
  const firstRuns = new Map();
  for (const row of [...kept].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.number - b.number)) {
    const key = row.pull ? `#${row.pull}` : row.head_sha.slice(0, 7);
    if (!firstRuns.has(key)) {
      firstRuns.set(key, row);
    }
  }
  const greensByCreation = [...deployments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const leadItems = [];
  const pending = [];
  for (const [change, first] of firstRuns) {
    const green = greensByCreation.find((row) => row.created_at >= first.created_at);
    const base = {
      change,
      pull: first.pull,
      head_sha: first.head_sha.slice(0, 7),
      first_commit_at: first.first_commit_at,
      first_run_row: first.number,
    };
    if (!green) {
      pending.push(base);
      continue;
    }
    const lead = minutesBetween(first.first_commit_at, green.completed_at);
    leadItems.push({
      ...base,
      green_run: rowRef(green),
      lead_min: round1(lead),
      lead_text: durationText(lead),
      before_run_min: round1(lead - green.queue_min - green.execution_min),
      queue_min: round1(green.queue_min),
      execution_min: round1(green.execution_min),
    });
  }
  const totalLead = leadItems.reduce((sum, item) => sum + item.lead_min, 0);
  const share = (part) =>
    totalLead ? round2((leadItems.reduce((sum, item) => sum + part(item), 0) / totalLead) * 100) : null;

  // Recovery: an incident opens with a red run while main is green and closes with the next green run; red runs in
  // between belong to the same incident. Its duration runs from the first red run's completion to the green one's.
  const incidents = [];
  let open = null;
  for (const row of timeline) {
    if (row.kind === 'failure') {
      if (open) {
        open.red_runs.push(rowRef(row));
      } else {
        open = { red_runs: [rowRef(row)] };
      }
    } else if (row.kind === 'deployment' && open) {
      const duration = minutesBetween(open.red_runs[0].completed_at, row.completed_at);
      incidents.push({
        ...open,
        green_run: rowRef(row),
        recovery_min: round1(duration),
        recovery_text: durationText(duration),
      });
      open = null;
    }
  }

  const leadMinutes = leadItems.map((item) => item.lead_min);
  const recoveryMinutes = incidents.map((item) => item.recovery_min);
  const numbers = (rows) => rows.map((row) => row.number);
  return {
    generated_at: new Date().toISOString(),
    source: {
      file: 'runs.json',
      collected_at: data.collected_at,
      repository: data.repository,
      workflow: data.workflow,
      branch: data.branch,
    },
    definitions: {
      deployment: 'a green run of CI on main (one row of metrics-raw.md; each attempt of a re-run is a row of its own)',
      failure: 'a red run of CI on main; cancelled runs are neither a deployment nor a failure',
      change_lead_time:
        'from the first commit of the merged PR (for a direct push, the commit itself) to the completion of the first green run on main created at or after the change reached main; the queue is part of it',
      change_fail_rate: 'red runs / (green + red runs) on main',
      recovery_time:
        'from the completion of a red run on main to the completion of the next green run on main; consecutive red runs form one incident',
      period: 'UTC dates of run creation, inclusive',
    },
    period: { from: periodFrom, to: periodTo, days, weeks: round1(days / 7) },
    filters: {
      exclude_runs: excludeRunsText ?? null,
      excluded_rows: numbers(excluded),
      ignore_failure_causes: [...ignoredCauses],
      ignored_rows: byKind('ignored').map((row) => ({ row: row.number, cause: row.cause })),
    },
    counts: {
      rows_in_period: inPeriod.length,
      rows_counted: kept.length,
      deployments: deployments.length,
      failures: failures.length,
      not_completed: byKind('not_completed').length,
      ignored: byKind('ignored').length,
      excluded: excluded.length,
    },
    classification: {
      deployment: numbers(deployments),
      failure: numbers(failures),
      not_completed: numbers(byKind('not_completed')),
      ignored: numbers(byKind('ignored')),
      excluded: numbers(excluded),
    },
    deployment_frequency: {
      deployments: deployments.length,
      days,
      per_week: round1(deployments.length / (days / 7)),
      per_day: round1(deployments.length / days),
    },
    change_lead_time: {
      changes: leadItems.length,
      ...stats(leadMinutes),
      shares_percent: {
        before_run: share((item) => item.before_run_min),
        queue: share((item) => item.queue_min),
        execution: share((item) => item.execution_min),
      },
      pending: pending.length ? pending : [],
      items: leadItems,
    },
    change_fail_rate: {
      failures: failures.length,
      completed: deployments.length + failures.length,
      percent:
        deployments.length + failures.length
          ? round1((failures.length / (deployments.length + failures.length)) * 100)
          : null,
    },
    failed_deployment_recovery_time: {
      incidents: incidents.length,
      ...stats(recoveryMinutes),
      unresolved: open ? open.red_runs : [],
      items: incidents,
    },
  };
}

function runMetrics(options) {
  const runsPath = join(options.out, 'runs.json');
  const data = readJson(runsPath, 'run the collector first or pass --out with the folder that holds runs.json');
  const notes = options.notes ? (readJson(options.notes).attempts ?? {}) : null;
  const metrics = computeMetrics({
    data,
    notes,
    from: options.from,
    to: options.to,
    excludeRunsText: options['exclude-runs'],
    ignoredCauses: parseCauses(options['ignore-failure-causes']),
  });
  const outPath = join(options.out, 'dora-metrics.json');
  writeText(outPath, `${JSON.stringify(metrics, null, 2)}\n`);
  const {
    deployment_frequency: df,
    change_lead_time: lt,
    change_fail_rate: cfr,
    failed_deployment_recovery_time: rt,
  } = metrics;
  console.error(
    [
      `metrics: ${metrics.period.from}..${metrics.period.to} (${metrics.period.days} days), ${metrics.counts.rows_counted} rows counted -> ${relative('.', outPath)}`,
      `  deployment frequency: ${df.deployments} deployments, ${df.per_week}/week, ${df.per_day}/day`,
      `  change lead time: ${lt.changes} changes, mean ${lt.mean_text}, median ${lt.median_text}; before run ${lt.shares_percent.before_run}%, queue ${lt.shares_percent.queue}%, execution ${lt.shares_percent.execution}%`,
      `  change fail rate: ${cfr.failures} of ${cfr.completed} = ${cfr.percent}%`,
      `  recovery time: ${rt.incidents} incidents, mean ${rt.mean_text}, median ${rt.median_text}`,
    ].join('\n'),
  );
}

async function runCollect(options) {
  const token = readToken();
  const repo = readRepo(options.repo);
  const notes = options.notes ? (readJson(options.notes).attempts ?? {}) : {};
  const client = createClient(token);

  const data = await collect({ client, repo, from: options.from, to: options.to });
  const collectedAt = new Date().toISOString();
  const rows = buildRows(data, notes);

  // A status can come from notes.json and is printed below, so it is checked before anything is written.
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  const summary = Object.entries(counts)
    .map(([status, n]) => `${assertMatches(status, STATUS_PATTERN, 'a row has a status that is not a plain tag')} ${n}`)
    .join(', ');

  const tablePath = options.table ?? join(options.out, 'metrics-raw.md');
  const output = {
    repository: repo,
    workflow: `.github/workflows/${WORKFLOW_FILE}`,
    branch: BRANCH,
    period: { from: options.from ?? null, to: options.to ?? null },
    collected_at: collectedAt,
    rows,
    runs: data.runs,
    commits: data.commits,
    pulls: data.pulls,
  };
  writeText(join(options.out, 'runs.json'), `${JSON.stringify(output, null, 2)}\n`);
  writeText(
    tablePath,
    renderTable({
      rows,
      repo,
      from: options.from,
      to: options.to,
      firstRunOn: data.runs[0]?.created_at.slice(0, 10),
      collectedOn: collectedAt.slice(0, 10),
    }),
  );

  console.error(
    `collect: ${rows.length} rows (${summary}) -> ${relative('.', join(options.out, 'runs.json'))}, ${relative('.', tablePath)}`,
  );
}

async function main() {
  const options = parseOptions();
  if (options.metrics) {
    runMetrics(options);
  } else {
    await runCollect(options);
  }
}

main().catch((error) => fail(error.message ?? String(error)));
