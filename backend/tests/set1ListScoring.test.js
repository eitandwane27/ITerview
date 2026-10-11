const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { getEvaluatorRubric, HARD_SET1_SCORING, SET1_ITEM_LIST_SCORING } = require('../config/evaluatorRubrics');

function evaluator(output) {
  const filename = path.resolve(__dirname, '../services/aiSet1Generator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  loaded.require = id => id !== 'openai' ? normalRequire(id) : { OpenAI: class {
    chat = { completions: { create: async request => {
      requests.push(request);
      return { choices: [{ message: { content: JSON.stringify(output) } }] };
    } } };
  } };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { evaluate: loaded.exports.evaluateSet1Answer, requests };
}

test('shared tier rubrics distinguish missing coverage from factual error', () => {
  for (const rubric of [...['easy', 'medium', 'hard'].map(getEvaluatorRubric), HARD_SET1_SCORING]) {
    assert.match(rubric, /MUST NOT lower correctness solely because fewer items were supplied/);
    assert.match(rubric, /false, irrelevant, contradictory, or genuinely unidentifiable/);
  }
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`Set 1 ${difficulty} appends list guidance after the tier rubric and preserves independent scores`, async t => {
    t.mock.method(console, 'log', () => {});
    const count = difficulty === 'hard' ? 'three' : 'two';
    const output = { clarity_score: 5, correctness_score: 5, completeness_score: 2,
      tip: 'Add another distinct relevant detail.', interviewer_reply: 'That detail is valid. Add the other requested detail.' };
    const harness = evaluator(output);
    const result = await harness.evaluate(`Name ${count} details useful in a defect report?`, 'The input used.', difficulty);
    assert.deepEqual(result, output);
    const system = harness.requests[0].messages[0].content;
    assert.ok(system.endsWith(SET1_ITEM_LIST_SCORING));
    assert.match(system, /Mixed valid and invalid items must lose correctness/);
    assert.match(system, /Do not turn genuinely vague filler into a valid item/);
    assert.match(system, /a present value names a valid case without restating optional/);
    assert.match(system, /vague filler and must not earn factual credit by inference/);
    assert.ok(harness.requests[0].messages[1].content.includes('The input used.'));
  });
}

test('list instructions do not override returned scores or turn a naming task into a guaranteed high score', async t => {
  t.mock.method(console, 'log', () => {});
  const low = { clarity_score: 4, correctness_score: 1, completeness_score: 1,
    tip: 'Name relevant details.', interviewer_reply: 'Thank you for trying. Name relevant details next time.' };
  const harness = evaluator(low);
  assert.deepEqual(await harness.evaluate('Name two useful details in a defect report?', 'My favorite meal and favorite film.', 'medium'), low);
});

test('non-list questions retain their task rubric without the specialized item-list section', async t => {
  t.mock.method(console, 'log', () => {});
  const harness = evaluator({ clarity_score: 4, correctness_score: 4, completeness_score: 4 });
  await harness.evaluate('How does a database transaction prevent a partial transfer?', 'It commits both changes or neither.', 'hard');
  assert.ok(!harness.requests[0].messages[0].content.includes(SET1_ITEM_LIST_SCORING));
});
