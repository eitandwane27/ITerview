const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { ROLE_CONFIG, VALID_ROLES, getRoleConfig, getRoleCatalogue, getRoleSetConfig, getRoleRestrictions } = require('../config/roleConfig');
const { validateRoleConfig } = require('../config/validateRoleConfig');
const User = require('../models/User');
const router = require('../routes/userRoutes');

test('all profile and main-set role enums match the registered catalogue', () => {
  for (const name of ['User', 'Set1Session', 'Set2Session', 'Set3Session']) {
    const model = require(`../models/${name}`);
    assert.deepEqual(model.schema.path('role').enumValues, VALID_ROLES);
    for (const role of VALID_ROLES) {
      assert.equal(new model({ role }).validateSync()?.errors.role, undefined);
    }
    assert.ok(new model({ role: 'unregistered-role' }).validateSync().errors.role);
  }
  assert.equal(new User({ role: null }).validateSync()?.errors.role, undefined);
});

test('model construction accepts an additional registered role without model edits', () => {
  const extraRoleId = 'qa-test';
  for (const name of ['User', 'Set1Session', 'Set2Session', 'Set3Session']) {
    const filename = path.resolve(__dirname, `../models/${name}.js`);
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const normalRequire = loaded.require.bind(loaded);
    loaded.require = (id) => {
      if (id === '../config/roleConfig') return { VALID_ROLES: [...VALID_ROLES, extraRoleId] };
      if (id === 'mongoose') return { Schema: mongoose.Schema,
        model: (_name, schema) => mongoose.model(`${name}RegistryTest`, schema) };
      return normalRequire(id);
    };
    try {
      loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
      const model = loaded.exports;
      assert.ok(model.schema.path('role').enumValues.includes(extraRoleId));
      assert.equal(new model({ role: extraRoleId }).validateSync()?.errors.role, undefined);
    } finally {
      mongoose.deleteModel(`${name}RegistryTest`);
    }
  }
});

test('startup validation accepts a complete additional role', () => {
  const additional = structuredClone(ROLE_CONFIG.backend);
  additional.id = 'qa-test';
  additional.label = 'QA Test Engineer';
  assert.doesNotThrow(() => validateRoleConfig({ ...ROLE_CONFIG, 'qa-test': additional }));
});

test('the catalogue publishes role display data and set capabilities without private prompts', () => {
  for (const role of getRoleCatalogue()) {
    assert.equal(role.label, ROLE_CONFIG[role.id].label);
    assert.ok(role.setTopics.set1.length);
    assert.ok(role.setTopics.set2.length);
    assert.deepEqual(role.supportedDifficulties.set3, ['easy']);
    assert.equal(role.avoidList, undefined);
    assert.equal(role.set1, undefined);
  }
  assert.equal(getRoleConfig('toString'), ROLE_CONFIG.fullstack);
});

test('difficulty scopes and restrictions allow hard calibration without carrying easy-only bans', () => {
  assert.ok(getRoleSetConfig(ROLE_CONFIG.backend, 'set1', 'hard').topicScope.some(topic => topic.includes('transactions')));
  assert.equal(getRoleRestrictions(ROLE_CONFIG.backend, 'hard').includes('keep to simple CRUD'), false);
  assert.equal(getRoleRestrictions(ROLE_CONFIG.frontend, 'medium').includes('event.preventDefault'), false);
  assert.ok(getRoleRestrictions(ROLE_CONFIG.backend, 'easy').includes('keep to simple CRUD'));
});

test('debug generators use registered roles and only Set 1 exposes a weakness', async t => {
  const filename = path.resolve(__dirname, '../routes/debugRoutes.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  const seen = [];
  const set2Calls = [];
  const logs = [];
  t.mock.method(console, 'log', message => logs.push(message));
  loaded.require = (id) => {
    if (id === '../config/roleConfig') return { VALID_ROLES: [...VALID_ROLES, 'qa-test'] };
    if (id === '../services/aiSet1Generator') return { generateSet1Question: async (_focus, role) => {
      seen.push(role); return 'A test question?';
    } };
    if (id === '../services/aiSet2Generator') return { generateSet2Question: async (...args) => {
      const [role] = args;
      set2Calls.push(structuredClone(args));
      seen.push(role); return 'A test question?';
    } };
    if (id === '../services/aiSet3Generator') return {};
    return normalRequire(id);
  };
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  for (const routePath of ['/generate-question', '/generate-question-s2']) {
    const handler = loaded.exports.stack.find(layer => layer.route?.path === routePath).route.stack[0].handle;
    let response;
    await handler({ query: { role: 'qa-test', runs: '1', weakness: 'technical_depth' } }, { json(value) { response = value; } });
    assert.equal(response.params.role, 'qa-test');
    assert.equal(response.results[0].error, null);
    if (routePath === '/generate-question-s2') {
      assert.deepEqual(response.params, { role: 'qa-test', difficulty: 'easy', runs: 1 });
    } else {
      assert.equal(response.params.weakness, 'focus_completeness');
    }
  }
  assert.deepEqual(seen, ['qa-test', 'qa-test']);
  assert.deepEqual(set2Calls, [['qa-test', 'easy', []]]);
  assert.ok(logs.includes('[DEBUG-S2]   role=qa-test | difficulty=easy | runs=1'));
  assert.equal(logs.some(message => message.includes('[DEBUG-S2]') && message.includes('weakness')), false);
});

test('startup validation identifies malformed role content before serving requests', () => {
  const cases = [
    [role => { role.id = 'wrong-id'; }, /frontend.id/],
    [role => { role.label = ''; }, /frontend.label/],
    [role => { role.set1.topicScope = []; }, /frontend.set1.topicScope/],
    [role => { role.set2.topicKeywords.pop(); }, /frontend.set2.topicKeywords/],
    [role => { role.set1.easyExamples.focus_clarity = []; }, /focus_clarity/],
    [role => { role.set2.hardExamples = [null]; }, /hardExamples/],
    [role => { role.difficultyAvoidLists = 'invalid'; }, /difficultyAvoidLists/],
    [role => { role.set1.difficultyTopics = 3; }, /difficultyTopics/],
    [role => { role.set2.difficultyTopics.hard.topicKeywords.pop(); }, /difficultyTopics.hard.topicKeywords/],
  ];
  for (const [damage, expected] of cases) {
    const registry = structuredClone(ROLE_CONFIG);
    damage(registry.frontend);
    assert.throws(() => validateRoleConfig(registry), expected);
  }
  assert.throws(() => validateRoleConfig({ frontend: ROLE_CONFIG.frontend }), /fullstack/);
});

async function updateRole(body) {
  const handler = router.stack.find(layer => layer.route?.path === '/role').route.stack[0].handle;
  let status;
  let response;
  await handler({ body }, {
    status(code) { status = code; return this; },
    json(value) { response = value; return this; },
  });
  return { status, response };
}

test('profile updates reject invalid role IDs and types before database writes', async (t) => {
  const write = t.mock.method(User, 'findOneAndUpdate', async () => { throw new Error('Must not write'); });
  for (const role of ['unknown', 'toString', 0, false, [], {}]) {
    assert.equal((await updateRole({ firebaseUid: 'test-user', role })).status, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test('profile updates accept registered roles and retain profile-only updates', async (t) => {
  t.mock.method(console, 'log', () => {});
  const write = t.mock.method(User, 'findOneAndUpdate', async (_query, update, options) => {
    assert.equal(options.runValidators, true);
    return { firebaseUid: 'test-user', ...update.$set };
  });
  for (const role of VALID_ROLES) {
    const result = await updateRole({ firebaseUid: 'test-user', role });
    assert.equal(result.status, 200);
    assert.equal(result.response.user.role, role);
  }
  for (const role of [undefined, null, '']) {
    const result = await updateRole({ firebaseUid: 'test-user', role, displayName: 'Test name' });
    assert.equal(result.status, 200);
    assert.equal(result.response.user.role, undefined);
  }
  assert.equal(write.mock.callCount(), VALID_ROLES.length + 3);
});

test('database preference validation failures return a client error', async (t) => {
  t.mock.method(User, 'findOneAndUpdate', async () => {
    const error = new Error('Invalid preference');
    error.name = 'ValidationError';
    throw error;
  });
  assert.equal((await updateRole({ firebaseUid: 'test-user', role: VALID_ROLES[0] })).status, 400);
});
