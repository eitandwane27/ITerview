import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schoolAccessStatus } from '../src/utils/schoolAccess.js';

test('only verified school accounts can reach protected pages', () => {
  assert.equal(schoolAccessStatus(null), 'signed-out');
  assert.equal(schoolAccessStatus({ email: 'student@gmail.com', emailVerified: true }), 'wrong-school');
  assert.equal(schoolAccessStatus({ email: 'student@spcba.edu.ph', emailVerified: false }), 'verify');
  assert.equal(schoolAccessStatus({ email: 'student@spcba.edu.ph' }), 'verify');
  assert.equal(schoolAccessStatus({ email: 'student@spcba.edu.ph', emailVerified: true }), 'ready');
});
