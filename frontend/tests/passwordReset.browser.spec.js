import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server;
let baseURL;

test.beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'password-reset-test-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === '../firebase') return '\0reset-firebase';
          if (id === '/reset-test-entry.jsx') return '\0reset-entry';
        },
        load(id) {
          if (id === '\0reset-firebase')
            return `
          import { initializeApp } from 'firebase/app';
          import { getAuth } from 'firebase/auth';
          export const auth = getAuth(initializeApp({
            apiKey: 'synthetic-test-key', authDomain: 'reset-test.firebaseapp.com',
            projectId: 'reset-test'
          }));
        `;
          if (id === '\0reset-entry')
            return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { MemoryRouter } from 'react-router-dom';
          import AuthModal from '/src/components/AuthModal.jsx';
          import { SchoolAuthContext } from '/src/auth/schoolAuth.js';
          createRoot(document.getElementById('root')).render(
            React.createElement(MemoryRouter, null,
              React.createElement(SchoolAuthContext.Provider, { value: { status: 'signed-out' } },
                React.createElement(AuthModal, { initialMode: 'forgot', isPage: true })))
          );
        `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__reset-test__', async (_req, res, next) => {
            try {
              res.setHeader('Content-Type', 'text/html');
              res.end(
                await vite.transformIndexHtml(
                  '/__reset-test__',
                  '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/reset-test-entry.jsx"></script></body></html>'
                )
              );
            } catch (error) {
              next(error);
            }
          });
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

async function open(page, respond = (route) => route.fulfill({ json: {} })) {
  const requests = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (
      url.hostname === 'identitytoolkit.googleapis.com' &&
      url.pathname.endsWith('accounts:sendOobCode')
    ) {
      requests.push(route.request().postDataJSON());
      return respond(route);
    }
    // The real Firebase client runs, but all external traffic is intercepted.
    if (url.origin !== baseURL) return route.abort();
    return route.continue();
  });
  await page.goto(baseURL + '/__reset-test__');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  return requests;
}

async function submit(page, email = 'student@spcba.edu.ph') {
  await page.getByLabel('School email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
}

async function expectPrivateConfirmation(page, email) {
  const heading = page.getByRole('heading', { name: 'Check your email', exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.locator('.am-topbar')).toBeInViewport();
  await expect(page.locator('#am-subheading')).toHaveText(
    'If an ITerview account exists for this address, you’ll receive a password reset link.'
  );
  await expect(page.locator('.am-email-chip-address')).toHaveText(email);
  await expect(page.getByText('We sent a password reset link to')).toHaveCount(0);
}

test('invalid addresses and lookalike school domains never request a reset', async ({ page }) => {
  const requests = await open(page);
  for (const email of [
    '',
    'student9',
    'student@gmail.com',
    'student@spcba.edu.ph.attacker.test',
    'a@b@spcba.edu.ph',
  ]) {
    await submit(page, email);
    await expect(page.getByRole('alert')).toBeVisible();
  }
  expect(requests).toHaveLength(0);
});

for (const outcome of ['existing', 'unknown-protected', 'EMAIL_NOT_FOUND', 'USER_DISABLED']) {
  test(`${outcome} account receives the same private confirmation`, async ({ page }, testInfo) => {
    const requests = await open(page, (route) =>
      outcome === 'existing'
        ? route.fulfill({ json: { email: 'student9@spcba.edu.ph' } })
        : outcome === 'unknown-protected'
          ? route.fulfill({ json: {} })
          : route.fulfill({ status: 400, json: { error: { message: outcome } } })
    );
    await submit(page, ' Student9@SPCBA.EDU.PH ');
    await expectPrivateConfirmation(page, 'student9@spcba.edu.ph');
    if (outcome === 'existing') {
      await page.screenshot({
        path: testInfo.outputPath('reset-desktop.png'),
        fullPage: true,
        animations: 'disabled',
      });
    }
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      requestType: 'PASSWORD_RESET',
      email: 'student9@spcba.edu.ph',
    });
    await page.getByRole('button', { name: 'Edit email address' }).click();
    await expect(page.getByLabel('School email address')).toHaveValue('Student9@SPCBA.EDU.PH');
    await expect(page.getByRole('button', { name: /Try again in \d+s/ })).toBeDisabled();
    // Correcting the typo is allowed immediately, even during the old address's cooldown.
    await page.getByLabel('School email address').fill('student@spcba.edu.ph');
    await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeEnabled();
  });
}

test('cooldown survives reload, blocks Enter submissions, and expires', async ({ page }) => {
  const requests = await open(page);
  await submit(page);
  await expectPrivateConfirmation(page, 'student@spcba.edu.ph');
  await page.reload();
  await page.getByLabel('School email address').fill('student@spcba.edu.ph');
  await expect(page.getByRole('button', { name: /Try again in \d+s/ })).toBeDisabled();
  await page
    .locator('form')
    .evaluate((form) =>
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
  expect(requests).toHaveLength(1);
  await page.clock.install();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expectPrivateConfirmation(page, 'student@spcba.edu.ph');
  expect(requests).toHaveLength(2);
});

test('rapid submits share one pending request and keep the form busy', async ({ page }) => {
  let release;
  const requests = await open(
    page,
    (route) =>
      new Promise((resolve) => {
        release = async () => {
          await route.fulfill({ json: {} });
          resolve();
        };
      })
  );
  await page.getByLabel('School email address').fill('student@spcba.edu.ph');
  await page.locator('form').evaluate((form) => {
    for (let i = 0; i < 10; i++)
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Sending link…' })).toBeDisabled();
  await expect(page.getByLabel('School email address')).toBeDisabled();
  await release();
  await expectPrivateConfirmation(page, 'student@spcba.edu.ph');
  expect(requests).toHaveLength(1);
});

for (const failure of ['network', 'TOO_MANY_ATTEMPTS_TRY_LATER']) {
  test(`${failure} preserves the address and allows recovery`, async ({ page }) => {
    let fail = true;
    const requests = await open(page, (route) =>
      !fail
        ? route.fulfill({ json: {} })
        : failure === 'network'
          ? route.abort('internetdisconnected')
          : route.fulfill({ status: 400, json: { error: { message: failure } } })
    );
    await submit(page);
    await expect(page.getByRole('alert')).toContainText(
      failure === 'network' ? 'Network error' : 'Too many reset requests'
    );
    await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toHaveCount(
      0
    );
    await expect(page.getByLabel('School email address')).toHaveValue('student@spcba.edu.ph');
    fail = false;
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await expectPrivateConfirmation(page, 'student@spcba.edu.ph');
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });
}

test('mobile reset confirmation fits the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.screenshot({
    path: testInfo.outputPath('reset-form-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await submit(page, 'student9@spcba.edu.ph');
  await expectPrivateConfirmation(page, 'student9@spcba.edu.ph');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('reset-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
});
