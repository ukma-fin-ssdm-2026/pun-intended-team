// Written with the help of Claude
// Collects every attempt of the CI workflow (.github/workflows/ci.yml) on main from the GitHub REST API and writes
// runs.json (raw runs, jobs and PR commits) and a Markdown table in the format of docs/ci-cd/metrics-raw.md.
// Read-only: it creates no workflow and starts nothing in Actions. See README.md next to this file.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

const WORKFLOW_FILE = 'ci.yml';
const BRANCH = 'main';
const SKIPPED_ACTORS = new Set(['dependabot[bot]']);
const PARALLEL_REQUESTS = 6;

const USAGE = `Usage: node scripts/ci-metrics/collect.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out DIR]
                                            [--table FILE] [--notes FILE] [--repo OWNER/NAME]
  --from, --to  UTC dates of run creation, inclusive; the whole history by default
  --out         folder for runs.json and, unless --table is given, metrics-raw.md (default: ci-metrics-out)
  --table       path of the generated Markdown table
  --notes       JSON file with the Note column and status overrides (see README.md)
  --repo        repository; read from the origin remote by default
Auth: GITHUB_TOKEN, otherwise the token of \`gh auth login\`.`;

function fail(message) {
  console.error(`collect: ${message}`);
  process.exit(1);
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
    if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      fail(`--${name} must be a date like 2026-10-20, got "${value}"`);
    }
  }
  if (values.from && values.to && values.from > values.to) {
    fail('--from is after --to');
  }
  return values;
}

// The two file helpers take paths from the command line on purpose: the script is run by hand with trusted input.
function readJson(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from the CLI, run by hand
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeText(path, text) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from the CLI, run by hand
  mkdirSync(dirname(path), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from the CLI, run by hand
  writeFileSync(path, text);
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
    const match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
  } catch {
    // Falls through to the error below.
  }
  fail('cannot read the repository from the origin remote; pass --repo OWNER/NAME');
}

function createClient(token) {
  async function request(path) {
    const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;
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
      throw new Error(`GET ${url} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }

  // Follows the Link header; `pick` takes the array out of a page body.
  async function paginate(path, pick) {
    const items = [];
    let next = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    while (next) {
      const { body, link } = await request(next);
      items.push(...pick(body));
      next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
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
    client.paginate(`/repos/${repo}/commits/${sha}/pulls`, (page) => page),
    client.request(`/repos/${repo}/commits/${sha}`),
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
    const { body: pull } = await client.request(`/repos/${repo}/pulls/${named}`);
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
  const prCommits = await client.paginate(`/repos/${repo}/pulls/${number}/commits`, (page) => page);
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
  const created = from || to ? `&created=${from ?? '*'}..${to ?? '*'}` : '';
  const listed = await client.paginate(
    `/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?branch=${BRANCH}${created}`,
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
    const base = `/repos/${repo}/actions/runs/${run.id}/attempts/${attempt}`;
    const [{ body }, jobs] = await Promise.all([
      client.request(base),
      client.paginate(`${base}/jobs`, (page) => page.jobs),
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

function buildRows(data, notes) {
  const rows = [];
  for (const run of data.runs) {
    const commit = data.commits[run.head_sha];
    const pull = commit.pull ? data.pulls[commit.pull] : null;
    for (const attempt of run.attempts) {
      const manual = notes[`${run.id}/${attempt.run_attempt}`] ?? {};
      const status = manual.status ?? attempt.conclusion ?? attempt.status;
      rows.push({
        number: rows.length + 1,
        run_id: run.id,
        run_number: run.run_number,
        run_attempt: attempt.run_attempt,
        event: run.event,
        head_sha: run.head_sha,
        pull: commit.pull,
        first_commit_at: pull ? pull.first_commit_at : commit.author_date,
        completed_at: attempt.timings.last_job_completed_at ?? attempt.updated_at,
        queue_min: attempt.timings.queue_min,
        execution_min: attempt.timings.execution_min,
        conclusion: attempt.conclusion,
        status,
        status_overridden: manual.status !== undefined,
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

async function main() {
  const options = parseOptions();
  const token = readToken();
  const repo = readRepo(options.repo);
  const notes = options.notes ? (readJson(options.notes).attempts ?? {}) : {};
  const client = createClient(token);

  const data = await collect({ client, repo, from: options.from, to: options.to });
  const collectedAt = new Date().toISOString();
  const rows = buildRows(data, notes);

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

  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  console.error(
    `collect: ${rows.length} rows (${Object.entries(counts)
      .map(([status, n]) => `${status} ${n}`)
      .join(', ')}) -> ${relative('.', join(options.out, 'runs.json'))}, ${relative('.', tablePath)}`,
  );
}

main().catch((error) => fail(error.stack ?? String(error)));
