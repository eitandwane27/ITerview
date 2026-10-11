const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { BEHAVIORAL_COMPETENCIES } = require('../config/behavioralInterviewConfig');
const { getBehavioralQuestionIssue } = require('../utils/behavioralQuestionGuard');
const { sanitizeTTS } = require('../utils/ttsSanitizer');
const { BEHAVIORAL_QUESTION_ANGLES } = require('../config/behavioralQuestionAngles');
const { createBehavioralQuestionVariety } = require('../utils/behavioralQuestionVariety');
const { getBehavioralQuestionFallback } = require('../utils/behavioralQuestionFallback');

function harness(outputs) {
  const filename = path.resolve(__dirname, '../services/aiSet3Generator.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const requests = [];
  const variety = createBehavioralQuestionVariety(() => 0.999);
  loaded.require = id => id === '../utils/behavioralQuestionVariety'
    ? { behavioralQuestionVariety: variety } : id === 'openai' ? { OpenAI: class {
    chat = { completions: { create: async request => {
      requests.push(structuredClone(request));
      const output = outputs.shift();
      if (output instanceof Error) throw output;
      return { choices: [{ message: { content: output } }] };
    } } };
  } } : normalRequire(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return { requests, ...loaded.exports };
}

test('all competency examples are neutral single-event questions accepted before and after TTS sanitation', () => {
  for (const competency of BEHAVIORAL_COMPETENCIES) {
    for (const example of competency.examples) {
      assert.equal(getBehavioralQuestionIssue(example, competency), null, example);
      assert.equal(getBehavioralQuestionIssue(sanitizeTTS(example), competency), null, example);
    }
  }
});

test('behavioral guard rejects hypothetical, generic, unrelated, technical, leading, and sensitive questions', () => {
  const questions = [
    'What are your strengths?',
    'Tell me about a time you would help a team if asked.',
    'Tell me about a time you worked with a team. Describe another time you learned something new.',
    'Tell me about a time you worked with a team. What did you do? What was the outcome?',
    'Tell me about a time you shared `code` with your group.',
    'Tell me about a time you led a team through a production crisis.',
    'Tell me about a time you successfully resolved a team conflict.',
    'Tell me about a time you quickly helped a team under pressure.',
    'Tell me about a time you patiently reached a compromise in a group.',
    'Tell me about a time you discussed your mental health with a team.',
    'Tell me about a time you completed your group task alone.',
    'Tell me about a time you learned an unfamiliar skill.', // Wrong slot.
  ];
  for (const question of questions) assert.ok(getBehavioralQuestionIssue(question, BEHAVIORAL_COMPETENCIES[0]), question);
});

test('guard rejects exact repeats and excessive length', () => {
  const competency = BEHAVIORAL_COMPETENCIES[0];
  assert.ok(getBehavioralQuestionIssue(competency.examples[0], competency, [sanitizeTTS(competency.examples[0])]));
  assert.ok(getBehavioralQuestionIssue(`Tell me about a time you worked with a team ${'during an activity '.repeat(27)}`, competency));
});

test('conflict and resilience questions must request a response rather than just an event', () => {
  assert.ok(getBehavioralQuestionIssue('Tell me about a time you disagreed with someone during a group activity?', BEHAVIORAL_COMPETENCIES[2]));
  assert.ok(getBehavioralQuestionIssue('Tell me about a time you made a mistake during an assignment?', BEHAVIORAL_COMPETENCIES[3]));
  assert.equal(getBehavioralQuestionIssue('Describe a time you handled a disagreement during a shared task?', BEHAVIORAL_COMPETENCIES[2]), null);
});

test('all five slots and every legacy difficulty use the same entry-level profile and distinct competency', async () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const service = harness(BEHAVIORAL_QUESTION_ANGLES.map(angles => angles[0].example));
    const previous = [];
    for (const [index, competency] of BEHAVIORAL_COMPETENCIES.entries()) {
      previous.push(await service.generateSet3Question(previous, difficulty));
      assert.equal(service.getCompetencyTopic(index), competency.topic);
      const prompt = service.requests[index].messages[0].content;
      assert.ok(prompt.includes('Entry Level / Fresh Graduate'));
      assert.equal(prompt.includes('Easy ('), false);
      assert.ok(prompt.includes('personal action and outcome OR lesson'));
      assert.ok(prompt.includes(competency.instruction));
      assert.ok(prompt.includes('ENTRY-LEVEL BEHAVIORAL PRACTICE STANDARD'));
      assert.ok(prompt.includes('Do not prescribe the ideal behavior'));
    }
  }
});

test('repair retains selected competency and history, without leaking rejected drafts', async () => {
  const good = BEHAVIORAL_QUESTION_ANGLES[2][0].example;
  const previous = BEHAVIORAL_COMPETENCIES.slice(0, 2).map(item => item.examples[0]);
  const service = harness(['Tell me about a time you successfully resolved a conflict.', good]);
  assert.equal(await service.generateSet3Question(previous, 'hard'), sanitizeTTS(good));
  assert.equal(service.requests.length, 2);
  assert.equal(service.requests[1].messages[0].content, service.requests[0].messages[0].content);
  assert.ok(service.requests[1].messages[1].content.includes(previous[0]));
  assert.ok(service.requests[1].messages.at(-1).content.includes('Conflict Resolution'));
});

test('three unsuitable drafts use a checked question from the selected competency', async t => {
  t.mock.method(console, 'warn', () => {});
  const service = harness(Array(3).fill('What are your strengths?'));
  const question = await service.generateSet3Question();
  assert.equal(question, sanitizeTTS(BEHAVIORAL_QUESTION_ANGLES[0][0].example));
  assert.equal(getBehavioralQuestionIssue(question, BEHAVIORAL_COMPETENCIES[0], [], BEHAVIORAL_QUESTION_ANGLES[0][0], { requireEvidenceProbe: true }), null);
  assert.equal(service.requests.length, 3);
});

test('empty or provider-failed generation fails immediately', async () => {
  for (const output of ['', '   ', new Error('provider unavailable')]) {
    const service = harness([output]);
    await assert.rejects(service.generateSet3Question());
    assert.equal(service.requests.length, 1);
  }
});

test('behavioral scoring uses independent evidence anchors and actual competency without technical difficulty rubrics', async t => {
  t.mock.method(console, 'log', () => {});
  const output = JSON.stringify({ situation_score: 5, action_score: 4, result_score: 5 });
  let reference;
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const service = harness([output]);
    const competency = BEHAVIORAL_COMPETENCIES[2];
    const transcript = 'We split the ideas into two options; my part was checking both with the group. We still disagreed, but I learned to check the requirements first.';
    const result = await service.evaluateSet3Answer(competency.examples[0], transcript, difficulty, competency.topic);
    const prompt = service.requests[0].messages[0].content;
    if (reference) assert.equal(prompt, reference);
    reference = prompt;
    assert.ok(prompt.includes(competency.evidence));
    for (const instruction of ['Situation includes Task', 'The word I is not required', 'Both are not required', 'An honest negative or mixed outcome can earn 5', 'Do not penalize accent', 'one well-explained action is sufficient', 'does not earn a high Action score', 'untrusted interview data']) {
      assert.ok(prompt.includes(instruction), instruction);
    }
    assert.equal(prompt.includes('DIFFICULTY SCORING RUBRIC'), false);
    assert.ok(prompt.includes('SCORING CALIBRATION EXAMPLES'));
    assert.ok(prompt.includes('When all three scores are 4 or 5'));
    assert.deepEqual(JSON.parse(service.requests[0].messages[1].content), { question: competency.examples[0], transcript });
    assert.equal(result.result_score, 5);
    assert.equal((result.interviewer_reply.match(/\./g) || []).length, 2);
  }
});

test('legacy three-argument evaluation stays supported without guessing a competency', async t => {
  t.mock.method(console, 'log', () => {});
  const service = harness([JSON.stringify({ situation_score: 2, action_score: 3, result_score: 4 })]);
  await service.evaluateSet3Answer('Saved question?', 'My example.', 'hard');
  assert.ok(service.requests[0].messages[0].content.includes('no slot label was supplied'));
});

test('malformed, absent, coerced, fractional, and out-of-range scores produce retryable failure instead of average marks', async () => {
  for (const output of ['', 'not json', '{}', '[]', 'null',
    JSON.stringify({ situation_score: '5', action_score: 3, result_score: 3 }),
    JSON.stringify({ situation_score: 4.5, action_score: 3, result_score: 3 }),
    JSON.stringify({ situation_score: 5, action_score: 6, result_score: 0 })]) {
    const service = harness([output]);
    await assert.rejects(service.evaluateSet3Answer('Question?', 'A real event.'), /invalid scores/);
  }
});

test('empty answer returns missing-evidence scores without a provider request', async () => {
  const service = harness([]);
  const result = await service.evaluateSet3Answer('Question?', '   ', 'hard');
  assert.equal(result.situation_score, 1);
  assert.equal(result.action_score, 1);
  assert.equal(result.result_score, 1);
  assert.equal(service.requests.length, 0);
  assert.equal((result.interviewer_reply.match(/\./g) || []).length, 2);
});

test('every event-angle example satisfies the entry-level behavioral guard', () => {
  for (const [index, angles] of BEHAVIORAL_QUESTION_ANGLES.entries()) {
    assert.equal(angles.length, 6);
    for (const angle of angles) {
      assert.equal(getBehavioralQuestionIssue(angle.example, BEHAVIORAL_COMPETENCIES[index], [], angle), null, angle.id);
      assert.equal(getBehavioralQuestionIssue(sanitizeTTS(angle.example), BEHAVIORAL_COMPETENCIES[index], [], angle), null, angle.id);
    }
  }
});

test('variety exhausts every angle before reuse and avoids a repeated angle across cycle boundaries', () => {
  const variety = createBehavioralQuestionVariety(() => 0);
  for (let index = 0; index < 5; index++) {
    const firstCycle = Array.from({ length: 6 }, () => variety.select(index).angle.id);
    const secondCycle = Array.from({ length: 6 }, () => variety.select(index).angle.id);
    assert.equal(new Set(firstCycle).size, 6);
    assert.equal(new Set(secondCycle).size, 6);
    assert.notEqual(secondCycle[0], firstCycle.at(-1));
  }
});

test('recent question memory is bounded and isolated by competency, and independent instances reset history', () => {
  const variety = createBehavioralQuestionVariety(() => 0.999);
  variety.select(0);
  for (let i = 0; i < 12; i++) variety.remember(0, `Question ${i}`);
  assert.deepEqual(variety.select(0).recentQuestions, Array.from({ length: 8 }, (_, i) => `Question ${i + 4}`));
  assert.deepEqual(variety.select(1).recentQuestions, []);
  assert.deepEqual(createBehavioralQuestionVariety(() => 0.999).select(0).recentQuestions, []);
});

test('a newly shuffled cycle swaps its first angle when it matches the last selection', () => {
  const randomValues = [...Array(5).fill(0.999), 0, ...Array(4).fill(0.999)];
  const variety = createBehavioralQuestionVariety(() => randomValues.shift());
  const firstCycle = Array.from({ length: 6 }, () => variety.select(0).angle.id);
  assert.equal(firstCycle.at(-1), BEHAVIORAL_QUESTION_ANGLES[0][5].id);
  assert.equal(variety.select(0).angle.id, BEHAVIORAL_QUESTION_ANGLES[0][1].id);
  assert.equal(variety.select(0).angle.id, BEHAVIORAL_QUESTION_ANGLES[0][5].id);
});

test('successive independent banks select distinct event angles rather than reusing benchmark questions', async () => {
  const first = BEHAVIORAL_QUESTION_ANGLES[0][0];
  const second = BEHAVIORAL_QUESTION_ANGLES[0][1];
  const service = harness([first.example, second.example]);
  await service.generateSet3Question([]);
  await service.generateSet3Question([]);
  assert.ok(service.requests[0].messages[0].content.includes(`Practice angle: ${first.id}`));
  assert.ok(service.requests[1].messages[0].content.includes(`Practice angle: ${second.id}`));
  assert.ok(service.requests[1].messages[1].content.includes(sanitizeTTS(first.example)));
  assert.equal(service.requests[0].messages[0].content.includes('CLASSROOM BEHAVIORAL BENCHMARKS'), false);
});

test('a shallow competency draft is repaired into the selected event angle with evidence', async () => {
  const angle = BEHAVIORAL_QUESTION_ANGLES[0][0];
  const service = harness([BEHAVIORAL_COMPETENCIES[0].examples[0], angle.example]);
  assert.equal(await service.generateSet3Question(), sanitizeTTS(angle.example));
  assert.equal(service.requests.length, 2);
  assert.ok(service.requests[1].messages.at(-1).content.includes('action and the outcome or lesson'));
});

test('another concrete event angle and a natural past-event opener pass on the first draft', async () => {
  const question = 'Recall a time you contributed to a group assignment. What did you do, and what was the outcome?';
  const service = harness([question]);
  assert.equal(await service.generateSet3Question(), sanitizeTTS(question));
  assert.equal(service.requests.length, 1);
});

test('flexible event angles still repair the wrong competency and missing evidence', async t => {
  t.mock.method(console, 'warn', () => {});
  const good = 'Recall a time you contributed to a group assignment. What did you do, and what was the outcome?';
  const service = harness([
    'Recall a time you learned an unfamiliar skill. What did you do, and what was the outcome?',
    'Recall a time you contributed to a group assignment?',
    good,
  ]);
  assert.equal(await service.generateSet3Question(), sanitizeTTS(good));
  assert.equal(service.requests.length, 3);
  assert.match(service.requests[1].messages.at(-1).content, /selected competency/);
  assert.match(service.requests[2].messages.at(-1).content, /action and the outcome or lesson/);
});

test('selected setback angles need not use the generic word setback, but still require a response', () => {
  const angle = BEHAVIORAL_QUESTION_ANGLES[3][4];
  const competency = BEHAVIORAL_COMPETENCIES[3];
  assert.equal(getBehavioralQuestionIssue('Tell me about a time you handled an unexpected delay during an activity?', competency, [], angle), null);
  assert.ok(getBehavioralQuestionIssue('Tell me about a time an unexpected delay interrupted your activity?', competency, [], angle));
});

test('an unfamiliar task can be described as something the candidate had never done before', () => {
  const angle = BEHAVIORAL_QUESTION_ANGLES[1][1];
  assert.equal(getBehavioralQuestionIssue('Tell me about a time you learned how to do a task you had never done before?', BEHAVIORAL_COMPETENCIES[1], [], angle), null);
});

test('recent cross-session repetition is a prompt preference rather than a rejection', async () => {
  const sharedDraft = 'Tell me about a time you responded when your group needed help with different schedules. What did you do, and what was the outcome?';
  const second = BEHAVIORAL_QUESTION_ANGLES[0][1];
  const service = harness([sharedDraft, sharedDraft]);
  await service.generateSet3Question();
  assert.equal(await service.generateSet3Question(), sanitizeTTS(sharedDraft));
  assert.equal(service.requests.length, 2);
  assert.ok(service.requests[1].messages[1].content.includes(sanitizeTTS(sharedDraft)));
  assert.ok(service.requests[1].messages[0].content.includes(`Practice angle: ${second.id}`));
});

test('all fallback angles include action/outcome evidence and remain safe after speech sanitation', () => {
  for (const [index, angles] of BEHAVIORAL_QUESTION_ANGLES.entries()) {
    for (const angle of angles) {
      const question = getBehavioralQuestionFallback(index, angle, [], []);
      assert.equal(getBehavioralQuestionIssue(question, BEHAVIORAL_COMPETENCIES[index], [], angle, { requireEvidenceProbe: true }), null, angle.id);
    }
  }
});

test('fallback prefers unseen questions, then permits cross-session reuse without repeating this session', () => {
  const angles = BEHAVIORAL_QUESTION_ANGLES[3];
  const recent = angles.map(angle => sanitizeTTS(angle.example));
  assert.equal(getBehavioralQuestionFallback(3, angles[0], [], [recent[0]]), recent[1]);
  assert.equal(getBehavioralQuestionFallback(3, angles[0], [recent[0]], recent), recent[1]);
  assert.throws(() => getBehavioralQuestionFallback(3, angles[0], recent, recent), /No suitable/);
});

test('evidence probes permit realistic project contexts but reject a shallow event or second story', () => {
  const competency = BEHAVIORAL_COMPETENCIES[3];
  const angle = BEHAVIORAL_QUESTION_ANGLES[3][0];
  const options = { requireEvidenceProbe: true };
  assert.equal(getBehavioralQuestionIssue('Tell me about a time you made a mistake during a software project. How did you respond, and what did you learn?', competency, [], angle, options), null);
  assert.equal(getBehavioralQuestionIssue('Describe a time you handled a mistake found during a code review. What did you do, and what was the outcome?', competency, [], angle, options), null);
  assert.equal(getBehavioralQuestionIssue('Tell me about a time you made a mistake in a project. What was your response, and what changed for the team?', competency, [], angle, options), null);
  assert.equal(getBehavioralQuestionIssue('Tell me about a time you made a mistake in a project. How did you respond, and how did things turn out?', competency, [], angle, options), null);
  assert.ok(getBehavioralQuestionIssue('Tell me about a time you handled a mistake in a project?', competency, [], angle, options));
  assert.ok(getBehavioralQuestionIssue('Tell me about a time you handled a mistake. Describe another time you worked with a team.', competency, [], angle, options));
});
