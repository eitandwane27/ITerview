const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { VALID_ROLES } = require('../config/roleConfig');
const { getScoringCases, dimensions } = require('../calibration/scoringCases');
const { parseArgs, validateCases, selectCases, checkScores, runCalibration, markdownReport, main } = require('../scripts/calibrate_scoring');

test('every registered role has frozen calibration cases at every tier and Set 1 focus', () => {
  const cases = getScoringCases();
  validateCases(cases, VALID_ROLES);
  const selected = selectCases(cases, parseArgs([]), VALID_ROLES);
  assert.equal(selected.length, VALID_ROLES.length * 12);
  for (const role of VALID_ROLES) {
    assert.equal(selectCases(cases, parseArgs(['--role', role]), VALID_ROLES).length, 12);
  }
  const extraRegistry = [...VALID_ROLES, 'new-role'];
  assert.throws(() => selectCases(cases, parseArgs([]), extraRegistry), /Missing calibration fixture: new-role/);
  assert.throws(() => selectCases(cases, parseArgs(['--role', 'missing']), VALID_ROLES), /Unregistered role/);
});

test('filters keep only the requested real scoring set and difficulty', () => {
  const selected = selectCases(getScoringCases(), parseArgs(['--role', 'qa-engineer', '--difficulty', 'medium', '--set', '2']), VALID_ROLES);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].set, 'set2');
  assert.equal(selected[0].answers.length, 4);
  for (const args of [['--concurrency', '0'], ['--timeout', 'NaN'], ['--repeat', '9'], ['--difficulty', 'expert'], ['--role'], ['--unknown']]) {
    assert.throws(() => parseArgs(args));
  }
});

test('expectations keep clarity independent and detect wrong scores and malformed evaluator output', () => {
  assert.deepEqual(checkScores('set1', { clarity_score: 5, correctness_score: 1, completeness_score: 2 }, { correctness_score: [1, 2] }), []);
  assert.match(checkScores('set1', { clarity_score: 5, correctness_score: 4, completeness_score: 2 }, { correctness_score: [1, 2] })[0], /got 4/);
  assert.match(checkScores('set2', { problem_solving_score: '5', accuracy_score: 5, depth_score: 5 }, { depth_score: [4, 5] })[0], /invalid score/);
  const damaged = getScoringCases();
  damaged[0].answers[0].expected.correctness_score = [6, 7];
  assert.throws(() => validateCases(damaged, VALID_ROLES), /Invalid expectation/);
});

test('runner compares all four answer kinds, preserves feedback, and reports a mismatch', async () => {
  const item = getScoringCases().find(value => value.role === 'qa-engineer');
  const requests = [];
  const events = [];
  const options = parseArgs(['--repeat', '2']);
  const result = await runCalibration([item], options, { set1: async (question, answer, difficulty, requestOptions) => {
    requests.push({ question, answer, difficulty, requestOptions });
    const kind = item.answers.find(candidate => candidate.answer === answer).kind;
    // Deliberately over-score the wrong answer so the calibration must fail.
    return { clarity_score: 4, correctness_score: 4, completeness_score: kind === 'partial' ? 2 : 4, tip: 'Recorded feedback.' };
  } }, entry => events.push(entry));
  assert.deepEqual(result.summary, { planned: 8, completed: 8, passed: 6, failed: 2, errors: 0, notRun: 0 });
  assert.equal(requests.length, 8);
  assert.ok(requests.every(request => request.question === item.question && request.difficulty === item.difficulty));
  assert.deepEqual(requests[0].requestOptions, { timeout: 45000, maxRetries: 0 });
  assert.equal(events.length, 8);
  assert.equal(result.results[0].scores.tip, 'Recorded feedback.');
  const report = markdownReport({ ...result, startedAt: 'test', requestedModel: 'test' });
  assert.match(report, /Failed or unavailable evaluations/);
  assert.ok(report.includes(item.answers.find(answer => answer.kind === 'incorrect').answer));
});

test('provider failure stops the run and does not label skipped evaluations as passed', async () => {
  const item = getScoringCases()[0];
  const result = await runCalibration([item], parseArgs(['--concurrency', '1']), { set1: async () => {
    throw Object.assign(new Error('Secret provider response must not be reported'), { status: 401 });
  } });
  assert.deepEqual(result.summary, { planned: 4, completed: 1, passed: 0, failed: 0, errors: 1, notRun: 3 });
  assert.equal(result.results[0].error.status, 401);
  assert.ok(!JSON.stringify(result).includes('Secret provider response'));
});

test('concurrency is bounded and an already-running evaluation finishes after another fails', async () => {
  const item = getScoringCases()[0];
  let active = 0;
  let peak = 0;
  let call = 0;
  const result = await runCalibration([item], parseArgs(['--concurrency', '2']), { set1: async () => {
    const current = ++call;
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    if (current === 1) throw new Error('Provider failed');
    return { clarity_score: 4, correctness_score: 4, completeness_score: 2 };
  } });
  assert.equal(peak, 2);
  assert.equal(result.summary.completed, 2);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.summary.notRun, 2);
});

test('dry run validates and lists all fixtures without requiring a provider key', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'table', () => {});
  assert.equal(await main(['--dry-run']), 0);
});

for (const set of [1, 2]) {
  test(`real Set ${set} evaluator forwards bounded calibration options to the SDK`, async () => {
    const filename = path.resolve(__dirname, `../services/aiSet${set}Generator.js`);
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const normalRequire = loaded.require.bind(loaded);
    let seenOptions;
    loaded.require = id => id !== 'openai' ? normalRequire(id) : { OpenAI: class {
      chat = { completions: { create: async (_request, options) => {
        seenOptions = options;
        const scores = Object.fromEntries(dimensions[`set${set}`].map(key => [key, 4]));
        return { choices: [{ message: { content: JSON.stringify(scores) } }] };
      } } };
    } };
    loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
    const options = { timeout: 1234, maxRetries: 0 };
    await loaded.exports[`evaluateSet${set}Answer`]('What is a defect report used for?', 'It records a problem.', 'easy', options);
    assert.deepEqual(seenOptions, options);
  });
}
