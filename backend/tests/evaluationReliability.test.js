const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function evaluator(output) {
  const filename = path.resolve(__dirname, '../services/aiEvaluator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = id => id === 'openai' ? { OpenAI: class {
    chat = { completions: { create: async () => {
      if (output instanceof Error) throw output;
      return { choices: [{ message: { content: output } }] };
    } } };
  } } : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports.evaluate3CScores;
}

for (const output of ['bad JSON', '{}', 'null', '{"clarity_score":4,"correctness_score":4}',
  '{"clarity_score":"4","correctness_score":4,"completeness_score":4}',
  '{"clarity_score":4.5,"correctness_score":4,"completeness_score":4}',
  '{"clarity_score":0,"correctness_score":4,"completeness_score":4}', new Error('Provider unavailable')]) {
  test(`pre/post evaluator propagates failure instead of fabricating scores: ${output}`, async t => {
    t.mock.method(console, 'error', () => {});
    await assert.rejects(evaluator(output)('What is an API?', 'It lets applications communicate.'));
  });
}

test('pre/post evaluator preserves valid independent scores and the empty-answer rule', async () => {
  const evaluate = evaluator('{"clarity_score":5,"correctness_score":4,"completeness_score":3,"primary_weakness":"focus_completeness"}');
  assert.deepEqual(await evaluate('What is an API?', 'It lets applications communicate.'), {
    clarity_score: 5, correctness_score: 4, completeness_score: 3, primary_weakness: 'focus_completeness',
  });
  assert.deepEqual(await evaluate('What is an API?', ''), {
    clarity_score: 1, correctness_score: 1, completeness_score: 1, primary_weakness: 'focus_completeness',
  });
});
