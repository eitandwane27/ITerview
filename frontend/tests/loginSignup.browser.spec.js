import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server;
let baseURL;
const pageErrors = new WeakMap();
const projectId = 'mock-school-project';

test.beforeAll(async () => {
  // Exercise the real app and Firebase SDK with a synthetic project.
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 5189 },
    plugins: [
      {
        name: 'login-signup-test-auth',
        enforce: 'pre',
        resolveId(id) {
          if (id === '../firebase') return '\0validation-firebase';
        },
        load(id) {
          if (id === '\0validation-firebase')
            return `
          import { initializeApp } from 'firebase/app';
          import { getAuth } from 'firebase/auth';
          export const auth = getAuth(initializeApp({ apiKey: 'synthetic-test-key',
            authDomain: '${projectId}.firebaseapp.com', projectId: '${projectId}' }));
          window.__validationAuth = auth;
        `;
        },
      },
    ],
  });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});
test.afterAll(async () => {
  await server?.close();
});
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function open(page, mode = 'login', options = {}) {
  const state = {
    email: 'student@spcba.edu.ph',
    verified: false,
    requests: [],
    syncs: 0,
    ...options,
  };
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'RS256', kid: 'synthetic' })}.${encode({
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'validation-user',
      user_id: 'validation-user',
      iat: now,
      exp: now + 3600,
      auth_time: now,
      email: state.email,
      email_verified: state.verified,
      firebase: { sign_in_provider: 'password', identities: { email: [state.email] } },
    })}.synthetic-signature`;
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      const endpoint = url.pathname.split(':').at(-1);
      const body = route.request().postDataJSON();
      state.requests.push({ endpoint, body });
      if (['signUp', 'signInWithPassword'].includes(endpoint)) {
        if (state.holdAuth)
          await new Promise((resolve) => {
            state.releaseAuth = resolve;
          });
        if (state.networkError) return route.abort('internetdisconnected');
        if (state.authError) return json({ error: { message: state.authError } }, 400);
        state.email = body.email;
        return json({
          localId: 'validation-user',
          email: state.email,
          idToken: token(),
          refreshToken: 'synthetic-refresh',
          expiresIn: '3600',
        });
      }
      if (endpoint === 'lookup')
        return json({
          users: [
            {
              localId: 'validation-user',
              email: state.email,
              emailVerified: state.verified,
              passwordHash: 'synthetic',
              providerUserInfo: [
                { providerId: 'password', email: state.email, rawId: state.email },
              ],
              createdAt: '1600000000000',
              lastLoginAt: '1600000000000',
            },
          ],
        });
      if (endpoint === 'sendOobCode') {
        if (state.sendError) return json({ error: { message: state.sendError } }, 400);
        return json({ email: state.email });
      }
      return json({});
    }
    if (url.hostname === 'securetoken.googleapis.com')
      return json({
        access_token: token(),
        id_token: token(),
        expires_in: '3600',
        refresh_token: 'synthetic-refresh',
        user_id: 'validation-user',
        project_id: projectId,
        token_type: 'Bearer',
      });
    if (url.pathname === '/api/users/login') {
      state.syncs++;
      if (state.syncOffline) return route.abort('internetdisconnected');
      if (state.syncError)
        return json({ message: 'The server could not confirm access. Please try again.' }, 503);
      return json({ user: { firebaseUid: 'validation-user', email: state.email } });
    }
    if (url.pathname.startsWith('/api/'))
      return json({
        user: {
          firebaseUid: 'validation-user',
          email: state.email,
          role: 'frontend',
          confidenceScore: null,
        },
        roles: [],
        active: false,
        hasActiveSession: false,
        journey: { nextStep: 'likert-pre' },
      });
    if (url.origin !== baseURL) return route.abort();
    return route.continue();
  });
  await page.goto(`${baseURL}/${mode}`);
  await expect(page.getByLabel('School email address')).toBeVisible();
  return state;
}

const attempts = (state) =>
  state.requests.filter((r) => ['signUp', 'signInWithPassword'].includes(r.endpoint));
async function fill(
  page,
  mode,
  {
    email = 'student@spcba.edu.ph',
    password = 'SyntheticPassword123!',
    confirm = password,
    terms = true,
  } = {}
) {
  await page.getByLabel('School email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (mode === 'register') {
    await page.getByLabel('Confirm password', { exact: true }).fill(confirm);
    if (terms) await page.getByRole('checkbox').check();
  }
}
const submit = (page, mode) =>
  page
    .getByRole('button', { name: mode === 'register' ? 'Create account' : 'Sign in', exact: true })
    .click();

for (const mode of ['login', 'register']) {
  test(`${mode}: invalid input never reaches Firebase`, async ({ page }) => {
    const state = await open(page, mode);
    for (const email of [
      '',
      'not-an-email',
      'student@gmail.com',
      'student@spcba.edu.ph.fake.com',
      'a@@spcba.edu.ph',
      'a b@spcba.edu.ph',
    ]) {
      await fill(page, mode, { email });
      await submit(page, mode);
      await expect(page.getByRole('alert')).toBeVisible();
    }
    await fill(page, mode, { password: '' });
    await submit(page, mode);
    await expect(page.getByRole('alert')).toContainText('Please enter your password');
    expect(attempts(state)).toHaveLength(0);
  });

  test(`${mode}: rapid submissions produce only one account request`, async ({ page }) => {
    const state = await open(page, mode, { holdAuth: true });
    await fill(page, mode);
    await page.locator('form').evaluate((form) => {
      for (let i = 0; i < 10; i++)
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => attempts(state).length).toBe(1);
    if (mode === 'register')
      await expect(page.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
    else await expect(page.getByTestId('sign-in-transition')).toBeVisible();
    state.releaseAuth();
    await expect(page).toHaveURL(/\/verify-email$/);
    expect(attempts(state)).toHaveLength(1);
    expect(state.syncs).toBe(0);
  });

  test(`${mode}: normalize email and preserve password characters exactly`, async ({ page }) => {
    const state = await open(page, mode);
    await fill(page, mode, { email: ' Student@SPCBA.EDU.PH ', password: '  Password123!  ' });
    await submit(page, mode);
    await expect(page).toHaveURL(/\/verify-email$/);
    expect(attempts(state)[0].body).toMatchObject({
      email: 'student@spcba.edu.ph',
      password: '  Password123!  ',
    });
    expect(state.syncs).toBe(0);
    await page.goto(baseURL + '/dashboard');
    await expect(page).toHaveURL(/\/verify-email$/);
    expect(state.syncs).toBe(0);
  });

  test(`${mode}: offline failure keeps credentials and supports retry`, async ({ page }) => {
    const state = await open(page, mode, { networkError: true });
    await fill(page, mode);
    await submit(page, mode);
    await expect(page.getByRole('alert')).toContainText('Network error');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('SyntheticPassword123!');
    state.networkError = false;
    await submit(page, mode);
    await expect(page).toHaveURL(/\/verify-email$/);
  });
}

test('signup rejects weak/blank passwords, missing confirmation, mismatch and unchecked terms', async ({
  page,
}) => {
  const state = await open(page, 'register');
  for (const [values, message] of [
    [{ password: '12345' }, 'at least 6 characters'],
    [{ password: '      ' }, 'cannot contain only spaces'],
    [{ confirm: '' }, 'Please confirm your password'],
    [{ confirm: 'DifferentPassword!' }, 'Passwords do not match'],
    [{ terms: false }, 'Please read and accept'],
  ]) {
    await page.getByRole('checkbox').uncheck();
    await fill(page, 'register', values);
    await submit(page, 'register');
    await expect(page.getByRole('alert')).toContainText(message);
  }
  expect(attempts(state)).toHaveLength(0);
  await expect(page.getByRole('checkbox')).toBeFocused();
});

test('switching auth modes clears passwords, visibility, errors and agreement', async ({
  page,
}) => {
  await open(page, 'register');
  await fill(page, 'register', { confirm: 'mismatch' });
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await page.getByRole('button', { name: 'Show confirm password', exact: true }).click();
  await submit(page, 'register');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in →', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create one →', exact: true }).click();
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute(
    'type',
    'password'
  );
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

for (const [mode, code, message] of [
  ['login', 'EMAIL_NOT_FOUND', 'Invalid email or password'],
  ['login', 'INVALID_PASSWORD', 'Invalid email or password'],
  ['login', 'INVALID_LOGIN_CREDENTIALS', 'Invalid email or password'],
  ['login', 'USER_DISABLED', 'Sign-in is unavailable'],
  ['login', 'TOO_MANY_ATTEMPTS_TRY_LATER', 'Too many failed attempts'],
  ['register', 'EMAIL_EXISTS', 'An account with this email already exists'],
  ['register', 'WEAK_PASSWORD : Password should be at least 6 characters', 'Password is too weak'],
  ['register', 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS', 'security requirements'],
  ['register', 'OPERATION_NOT_ALLOWED', 'not enabled'],
  ['register', 'SOME_UNEXPECTED_PROVIDER_ERROR', 'Failed to create an account'],
]) {
  test(`${mode}: ${code} gives an actionable error and leaves the form usable`, async ({
    page,
  }) => {
    const state = await open(page, mode, { authError: code });
    await fill(page, mode);
    await submit(page, mode);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('SyntheticPassword123!');
    await expect(page.getByTestId('sign-in-transition')).toHaveCount(0);
    expect(state.syncs).toBe(0);
    state.authError = '';
    await submit(page, mode);
    await expect(page).toHaveURL(/\/verify-email$/);
  });
}

for (const syncOffline of [false, true]) {
  test(`verified login: backend ${syncOffline ? 'offline' : 'failure'} blocks access and can be retried`, async ({
    page,
  }) => {
    const state = await open(page, 'login', { verified: true, syncError: true, syncOffline });
    await fill(page, 'login');
    await submit(page, 'login');
    await expect(page.getByRole('alert')).toContainText(
      syncOffline ? 'Check your internet connection' : 'could not confirm access'
    );
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('sign-in-transition')).toHaveCount(0);
    state.syncError = false;
    state.syncOffline = false;
    await submit(page, 'login');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test('signup email failure preserves the new account and allows verification resend', async ({
  page,
}) => {
  const state = await open(page, 'register', { sendError: 'TOO_MANY_ATTEMPTS_TRY_LATER' });
  await fill(page, 'register');
  await submit(page, 'register');
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole('alert')).toContainText('Your account was created');
  expect(attempts(state)).toHaveLength(1);
  expect(state.syncs).toBe(0);
  state.sendError = '';
  await page.getByRole('button', { name: 'Resend verification email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Verification email sent');
  await expect(page.getByRole('button', { name: /Resend email in/ })).toBeDisabled();
  await page.getByRole('button', { name: 'I’ve verified my email' }).click();
  await expect(page.getByRole('alert')).toContainText('Your email is still unverified');
  expect(state.syncs).toBe(0);
  await page.getByRole('button', { name: 'Sign out to use another account' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('closing and reopening the modal clears password values and visibility', async ({ page }) => {
  await open(page);
  await page.goto(baseURL + '/landing');
  const launch = page
    .getByRole('banner')
    .getByRole('button', { name: 'Start practicing free', exact: true });
  await launch.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Password', { exact: true }).fill('SyntheticPassword123!');
  await dialog.getByLabel('Confirm password', { exact: true }).fill('SyntheticPassword123!');
  await dialog.getByRole('button', { name: 'Show password', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close modal' }).click();
  await launch.click();
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Confirm password', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
});

async function failSignOut(page) {
  await page.evaluate(() => {
    const auth = window.__validationAuth;
    const original = auth.signOut.bind(auth);
    auth.signOut = () => Promise.reject(new Error('Synthetic sign-out failure'));
    window.__restoreSignOut = () => {
      auth.signOut = original;
    };
  });
}

test('verification-page sign-out failure shows an error and can be retried', async ({ page }) => {
  await open(page, 'register');
  await fill(page, 'register');
  await submit(page, 'register');
  await expect(page).toHaveURL(/\/verify-email$/);
  await failSignOut(page);
  await page.getByRole('button', { name: 'Sign out to use another account' }).click();
  await expect(page.getByRole('alert')).toContainText('We couldn’t sign you out');
  await page.evaluate(() => window.__restoreSignOut());
  await page.getByRole('button', { name: 'Sign out to use another account' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('access-error page handles failed sign-out and permits a successful retry', async ({
  page,
}) => {
  await open(page, 'login', { verified: true, syncError: true });
  await fill(page, 'login');
  await submit(page, 'login');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto(baseURL + '/dashboard');
  await expect(page.getByRole('heading', { name: 'We couldn’t check access' })).toBeVisible();
  await failSignOut(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('We couldn’t sign you out');
  await page.evaluate(() => window.__restoreSignOut());
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('concurrent verification requests send one email even when browser storage is blocked', async ({
  page,
}) => {
  const state = await open(page, 'login');
  await fill(page, 'login');
  await submit(page, 'login');
  await expect(page).toHaveURL(/\/verify-email$/);
  const results = await page.evaluate(async () => {
    const { sendSchoolVerification } = await import('/src/utils/emailVerification.js');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled', 'SecurityError');
    };
    try {
      return await Promise.all([
        sendSchoolVerification(window.__validationAuth.currentUser),
        sendSchoolVerification(window.__validationAuth.currentUser),
      ]);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  expect(results).toEqual([true, false]);
  expect(state.requests.filter((r) => r.endpoint === 'sendOobCode')).toHaveLength(1);
  await expect(page.getByRole('button', { name: /Resend email in/ })).toBeDisabled();
});
