#!/usr/bin/env node
// Calls the same technical scoring functions used by MainSets. No server, DB,
// microphone, question generation, or Deepgram session is required.
const fs = require('node:fs');
const path = require('node:path');
const { getScoringCases, dimensions, kinds } = require('../calibration/scoringCases');

function parseArgs(args) {
  const options = { role: 'all', difficulty: 'all', set: 'all', repeat: 1, concurrency: 2,
    timeout: 45000, dryRun: false, help: false,
    output: path.resolve(__dirname, '../../output/scoring-calibration') };
  const valueFlags = { '--role': 'role', '--difficulty': 'difficulty', '--set': 'set',
    '--repeat': 'repeat', '--concurrency': 'concurrency', '--timeout': 'timeout', '--output': 'output' };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--help' || flag === '-h') options.help = true;
    else {
      const key = valueFlags[flag];
      if (!key) throw new Error(`Unknown option: ${flag}`);
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      options[key] = ['repeat', 'concurrency', 'timeout'].includes(key) ? Number(value) : value;
    }
  }
  for (const [key, min, max] of [['repeat', 1, 5], ['concurrency', 1, 4], ['timeout', 1000, 120000]]) {
    if (!Number.isInteger(options[key]) || options[key] < min || options[key] > max) {
      throw new Error(`${key} must be an integer from ${min} to ${max}.`);
    }
  }
  if (!['all', 'easy', 'medium', 'hard'].includes(options.difficulty)) throw new Error('Invalid difficulty.');
  if (!['all', '1', '2', 'set1', 'set2'].includes(options.set)) throw new Error('Set must be 1, 2, or all.');
  if (options.set === '1' || options.set === '2') options.set = `set${options.set}`;
  options.output = path.resolve(options.output);
  return options;
}

function validateCases(cases, registeredRoles) {
  const ids = new Set();
  for (const item of cases) {
    if (!registeredRoles.includes(item.role) || ids.has(item.id)) throw new Error(`Invalid or duplicate case: ${item.id}`);
    ids.add(item.id);
    if (!dimensions[item.set] || !['easy', 'medium', 'hard'].includes(item.difficulty)
      || typeof item.question !== 'string' || !item.question.trim()) throw new Error(`Invalid case: ${item.id}`);
    if (item.set === 'set1' && !['focus_clarity', 'focus_correctness', 'focus_completeness'].includes(item.focus)) {
      throw new Error(`Missing Set 1 focus: ${item.id}`);
    }
    if (item.answers.length !== kinds.length || new Set(item.answers.map(answer => answer.kind)).size !== kinds.length) {
      throw new Error(`Each case needs four distinct answer kinds: ${item.id}`);
    }
    for (const answer of item.answers) {
      if (!kinds.includes(answer.kind) || typeof answer.answer !== 'string' || !answer.answer.trim()
        || !answer.expected || !Object.keys(answer.expected).length) throw new Error(`Invalid answer: ${item.id}`);
      for (const [key, range] of Object.entries(answer.expected)) {
        if (!dimensions[item.set].includes(key) || !Array.isArray(range) || range.length !== 2
          || !range.every(value => Number.isInteger(value) && value >= 1 && value <= 5) || range[0] > range[1]) {
          throw new Error(`Invalid expectation: ${item.id}.${key}`);
        }
      }
    }
  }
}

function selectCases(cases, options, registeredRoles) {
  if (options.role !== 'all' && !registeredRoles.includes(options.role)) throw new Error(`Unregistered role: ${options.role}`);
  const roles = options.role === 'all' ? registeredRoles : [options.role];
  const selected = cases.filter(item => roles.includes(item.role)
    && (options.difficulty === 'all' || item.difficulty === options.difficulty)
    && (options.set === 'all' || item.set === options.set));
  // A new registry entry cannot silently disappear from an "all roles" run.
  for (const role of roles) {
    for (const difficulty of options.difficulty === 'all' ? ['easy', 'medium', 'hard'] : [options.difficulty]) {
      for (const set of options.set === 'all' ? ['set1', 'set2'] : [options.set]) {
        const coverage = selected.filter(item => item.role === role && item.difficulty === difficulty && item.set === set);
        const required = set === 'set1' ? ['focus_clarity', 'focus_correctness', 'focus_completeness'] : [null];
        for (const focus of required) if (!coverage.some(item => item.focus === focus)) {
          throw new Error(`Missing calibration fixture: ${role} ${difficulty} ${set} ${focus || ''}`);
        }
      }
    }
  }
  return selected;
}

function checkScores(set, scores, expected) {
  const issues = [];
  for (const key of dimensions[set]) {
    if (!Number.isInteger(scores?.[key]) || scores[key] < 1 || scores[key] > 5) issues.push(`${key}: invalid score`);
  }
  for (const [key, [min, max]] of Object.entries(expected)) {
    if (Number.isInteger(scores?.[key]) && (scores[key] < min || scores[key] > max)) {
      issues.push(`${key}: expected ${min}–${max}, got ${scores[key]}`);
    }
  }
  return issues;
}

function summarize(results, planned) {
  return { planned, completed: results.length, passed: results.filter(item => item.status === 'pass').length,
    failed: results.filter(item => item.status === 'fail').length,
    errors: results.filter(item => item.status === 'error').length, notRun: planned - results.length };
}

async function runCalibration(cases, options, evaluators, onResult = () => {}) {
  const tasks = cases.flatMap(item => item.answers.flatMap(answer => Array.from({ length: options.repeat }, (_, index) =>
    ({ item, answer, trial: index + 1 }))));
  let next = 0;
  let stopped = false;
  const results = [];
  async function worker() {
    while (!stopped && next < tasks.length) {
      const { item, answer, trial } = tasks[next++];
      const start = Date.now();
      const result = { caseId: item.id, role: item.role, set: item.set, difficulty: item.difficulty,
        focus: item.focus, question: item.question, kind: answer.kind, answer: answer.answer,
        expected: answer.expected, trial };
      try {
        const scores = await evaluators[item.set](item.question, answer.answer, item.difficulty,
          { timeout: options.timeout, maxRetries: 0 });
        result.scores = scores;
        result.issues = checkScores(item.set, scores, answer.expected);
        result.status = result.issues.length ? 'fail' : 'pass';
      } catch (error) {
        // No raw provider bodies, keys, stack traces, or request headers in reports.
        result.status = 'error';
        result.issues = ['Evaluator request failed; remaining evaluations stopped.'];
        result.error = { name: error.name || 'Error', status: error.status || null };
        stopped = true;
      }
      result.latencyMs = Date.now() - start;
      results.push(result);
      onResult(result, results, tasks.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, tasks.length) }, worker));
  // Restore fixture order rather than network completion order.
  const order = new Map(cases.map((item, index) => [item.id, index]));
  results.sort((a, b) => order.get(a.caseId) - order.get(b.caseId) || kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || a.trial - b.trial);
  return { results, summary: summarize(results, tasks.length) };
}

function markdownReport(report) {
  const { summary } = report;
  const escape = value => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const lines = ['# Scoring calibration', '', `Started: ${report.startedAt}. Requested model: ${report.requestedModel}.`, '',
    `${summary.passed} passed, ${summary.failed} failed, ${summary.errors} errors, ${summary.notRun} not run (${summary.planned} planned).`, '',
    'This is a bounded fixture comparison, not proof of grading accuracy across all questions. Expectations are authored review anchors; they have not been independently validated by a human panel.', '',
    '| Case | Answer kind | Trial | Result | Scores | Issues |', '| --- | --- | --- | --- | --- | --- |'];
  for (const item of report.results) lines.push(`| ${escape(item.caseId)} | ${item.kind} | ${item.trial} | ${item.status} | ${escape(dimensions[item.set].map(key => `${key}=${item.scores?.[key] ?? '—'}`).join(', '))} | ${escape(item.issues.join('; '))} |`);
  lines.push('', '## Failed or unavailable evaluations', '');
  for (const item of report.results.filter(result => result.status !== 'pass')) {
    lines.push(`### ${item.caseId} / ${item.kind} / trial ${item.trial}`, '', `Question: ${item.question}`, '',
      `Answer: ${item.answer}`, '', `Issues: ${item.issues.join('; ')}`, '',
      `Feedback: ${item.scores?.tip || 'Unavailable'}`, '');
  }
  return lines.join('\n');
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(`Usage: node backend/scripts/calibrate_scoring.js [options]
  --role qa-engineer   Registered role ID, or all (default)
  --difficulty easy   easy, medium, hard, or all (default)
  --set 1             1, 2, or all (default)
  --repeat 1          Trials per answer, 1–5
  --concurrency 2     Parallel evaluator calls, 1–4
  --timeout 45000     Per-call timeout in milliseconds; provider retries disabled
  --output PATH       Report directory (default: output/scoring-calibration)
  --dry-run           Validate fixtures and list cases without API calls
Exit codes: 0 = all expectations passed, 1 = score mismatches, 2 = setup/provider error or incomplete run.
Set 3 is shared behavioral practice and is outside this technical role calibration.`);
    return 0;
  }
  const { VALID_ROLES } = require('../config/roleConfig');
  const fixtures = getScoringCases();
  validateCases(fixtures, VALID_ROLES);
  const cases = selectCases(fixtures, options, VALID_ROLES);
  const planned = cases.length * kinds.length * options.repeat;
  console.log(`${options.dryRun ? 'DRY RUN' : 'LIVE RUN'}: ${cases.length} questions, ${planned} evaluations, concurrency ${options.concurrency}.`);
  if (options.dryRun) {
    console.table(cases.map(({ id, question }) => ({ case: id, question })));
    return 0;
  }
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('Set DEEPSEEK_API_KEY in backend/.env or the environment.');
  const evaluators = { set1: require('../services/aiSet1Generator').evaluateSet1Answer,
    set2: require('../services/aiSet2Generator').evaluateSet2Answer };
  const requestedModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const startedAt = new Date().toISOString();
  const basename = `scoring-${options.role}-${startedAt.replace(/[:.]/g, '-')}`;
  fs.mkdirSync(options.output, { recursive: true });
  const jsonPath = path.join(options.output, `${basename}.json`);
  const markdownPath = path.join(options.output, `${basename}.md`);
  const save = (results, summary) => {
    const report = { schemaVersion: 1, startedAt, requestedModel, options, summary, results };
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(markdownPath, markdownReport(report));
  };
  save([], summarize([], planned));
  const completed = await runCalibration(cases, options, evaluators, (result, results, count) => {
    save(results, summarize(results, count));
    console.log(`[${results.length}/${count}] ${result.caseId} ${result.kind} ${result.status.toUpperCase()} (${result.latencyMs}ms)${result.issues.length ? ` — ${result.issues.join('; ')}` : ''}`);
  });
  save(completed.results, completed.summary);
  console.table(completed.summary);
  console.log(`Reports:\n${jsonPath}\n${markdownPath}`);
  return completed.summary.errors || completed.summary.notRun ? 2 : completed.summary.failed ? 1 : 0;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => {
  console.error(`Calibration stopped: ${error.message}`);
  process.exitCode = 2;
});

module.exports = { parseArgs, validateCases, selectCases, checkScores, summarize, runCalibration, markdownReport, main };
