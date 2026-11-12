const assert = require('node:assert/strict');
const { test } = require('node:test');
const User = require('../models/User');
const router = require('../routes/userRoutes');

const saveProfile = router.stack.find(layer =>
  layer.route?.path === '/role' && layer.route.methods.put
).route.stack[0].handle;

async function save(body) {
  const response = { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await saveProfile({ body: { firebaseUid: 'avatar-test', ...body } }, response);
  return response;
}

test('avatar preference persists with the other profile fields and is returned on reads', async t => {
  let savedUser;
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { firebaseUid: 'avatar-test' });
    assert.equal(options.runValidators, true);
    savedUser = new User({ firebaseUid: filter.firebaseUid, email: 'test@example.com', ...update.$set });
    assert.equal(savedUser.validateSync(), undefined);
    return savedUser;
  });
  const result = await save({ displayName: 'Sam', avatar: 'owl', role: 'frontend', focusArea: 'clarity' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.user.avatar, 'owl');
  assert.equal(result.body.user.displayName, 'Sam');
  assert.equal(result.body.user.focusArea, 'clarity');
  assert.equal(savedUser.toJSON().avatar, 'owl');
});

test('older clients can update preferences without overwriting the avatar', async t => {
  t.mock.method(User, 'findOneAndUpdate', async (_filter, update) => {
    assert.equal(Object.hasOwn(update.$set, 'avatar'), false);
    return { avatar: 'rabbit', ...update.$set };
  });
  assert.equal((await save({ focusArea: 'auto' })).body.user.avatar, 'rabbit');
});

test('missing avatar defaults to fox on legacy and new profile documents', () => {
  assert.equal(new User().avatar, 'fox');
  assert.equal(User.hydrate({ firebaseUid: 'legacy' }).avatar, 'fox');
});

for (const avatar of ['unknown', '', null, 5, { id: 'fox' }, ['fox']]) {
  test(`reject unsupported avatar ${JSON.stringify(avatar)} before updating the database`, async t => {
    const update = t.mock.method(User, 'findOneAndUpdate', () => { throw new Error('must not update'); });
    const result = await save({ avatar });
    assert.equal(result.statusCode, 400);
    assert.equal(update.mock.callCount(), 0);
  });
}
