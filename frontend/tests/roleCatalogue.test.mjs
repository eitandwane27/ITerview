import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchRoleCatalogue, formatRoleLabel, getRoleTopics, getRoleOptions, getRoleSelectionError } from '../src/utils/roleCatalogue.js';

const roles = [
  { id: 'frontend', label: 'Frontend Developer' },
  { id: 'qa-test', label: 'QA Test Engineer' },
];

test('catalogue fetch preserves server order and labels, including additional roles', async () => {
  const controller = new AbortController();
  const result = await fetchRoleCatalogue({ signal: controller.signal, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/recommendations/roles');
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => ({ roles: roles.map(role => ({ ...role, topics: ['Example topic'] })) }) };
  } });
  assert.deepEqual(result, roles.map(role => ({ ...role, topics: ['Example topic'] })));
  assert.equal(formatRoleLabel('qa-test', result), 'QA Test Engineer');
});

test('catalogue fetch rejects network, HTTP, empty, and malformed responses', async () => {
  await assert.rejects(fetchRoleCatalogue({ fetchImpl: async () => { throw new Error('offline'); } }));
  await assert.rejects(fetchRoleCatalogue({ fetchImpl: async () => ({ ok: false }) }));
  for (const data of [{}, { roles: [] }, { roles: [null] }, { roles: [{ id: 'qa-test', label: '' }] },
    { roles: [roles[0], roles[0]] }, { roles: [{ id: 'bad role', label: 'Bad' }] }]) {
    await assert.rejects(fetchRoleCatalogue({ fetchImpl: async () => ({ ok: true, json: async () => data }) }));
  }
});

test('dropdown options come from the server and preserve an unavailable saved value', () => {
  const options = getRoleOptions(roles, 'ready', 'retired-role');
  assert.deepEqual(options.filter(option => !option.disabled).map(option => option.value), roles.map(role => role.id));
  assert.ok(options.find(option => option.value === 'retired-role').disabled);
  assert.equal(getRoleOptions(roles, 'ready', 'frontend').filter(option => option.value === 'frontend').length, 1);
});

test('loading and error options do not invent selectable roles', () => {
  for (const status of ['loading', 'error']) {
    const options = getRoleOptions([], status, 'frontend');
    assert.equal(options.find(option => option.value === 'frontend').disabled, true);
    assert.equal(options.filter(option => !option.disabled).length, 0);
  }
});

test('new sessions require a role in a successfully loaded catalogue', () => {
  assert.equal(getRoleSelectionError('qa-test', roles, 'ready'), null);
  assert.ok(getRoleSelectionError('retired-role', roles, 'ready'));
  assert.ok(getRoleSelectionError('', roles, 'ready'));
  assert.ok(getRoleSelectionError('frontend', roles, 'loading'));
  assert.ok(getRoleSelectionError('frontend', roles, 'error'));
});

test('historical role labels remain readable when a role is absent', () => {
  assert.equal(formatRoleLabel('legacy', roles), 'Legacy');
  assert.equal(formatRoleLabel(null, roles), 'Target role');
});

test('role topics and supported difficulties survive the shared catalogue boundary', async () => {
  const role = { ...roles[1], topics: ['Testing'], setTopics: { set1: ['Test planning'], set2: ['Defect reporting'] },
    supportedDifficulties: { set1: ['easy', 'medium', 'hard'], set2: ['easy', 'medium', 'hard'], set3: ['easy'] } };
  const catalogue = await fetchRoleCatalogue({ fetchImpl: async () => ({ ok: true, json: async () => ({ roles: [role] }) }) });
  assert.deepEqual(catalogue, [role]);
  assert.deepEqual(getRoleTopics('qa-test', catalogue, 2), ['Defect reporting']);
  assert.deepEqual(getRoleTopics('retired-role', catalogue, 2), []);
});
