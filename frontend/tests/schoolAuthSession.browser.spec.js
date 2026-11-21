import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server;
let baseURL;

test.beforeAll(async () => {
  server = await createServer({
    mode: 'test',
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'school-session-race-tests', enforce: 'pre',
      resolveId(id) {
        if (id === 'firebase/auth' || id === '../firebase') return '\0session-auth';
        if (id === '/session-test-entry.jsx') return '\0session-entry';
      },
      load(id) {
        if (id === '\0session-auth') return `
          const listeners = new Set();
          export const auth = { currentUser: null, authStateReady: async () => {} };
          export function onAuthStateChanged(_auth, callback) {
            listeners.add(callback);
            queueMicrotask(() => { if (listeners.has(callback)) callback(auth.currentUser); });
            return () => listeners.delete(callback);
          }
          function change(user) {
            auth.currentUser = user;
            for (const callback of listeners) callback(user);
          }
          export async function signOut() { change(null); }
          window.__authTest = {
            reloads: 0, refreshes: 0,
            signIn(uid, verified = true) {
              change({ uid, email: uid + '@spcba.edu.ph', emailVerified: verified,
                reload: async () => { window.__authTest.reloads++; },
                getIdToken: async (force) => {
                  if (force) window.__authTest.refreshes++;
                  if (window.__authTest.pendingTokenUid === uid) {
                    await new Promise(resolve => { window.__authTest.releaseToken = resolve; });
                  }
                  return uid + '-token';
                }
              });
            },
            verify() { auth.currentUser.emailVerified = true; },
            signOut
          };
        `;
        if (id === '\0session-entry') return `
          import React, { StrictMode, useEffect } from 'react';
          import { createRoot } from 'react-dom/client';
          import { SchoolAuthProvider } from '/src/auth/SchoolAuthContext.jsx';
          import { useSchoolAuth } from '/src/auth/schoolAuth.js';
          import { MemoryRouter } from 'react-router-dom';
          import SignInTransitionProvider from '/src/auth/SignInTransitionProvider.jsx';
          import { useSignInTransition } from '/src/auth/signInTransition.js';
          function Probe() {
            const session = useSchoolAuth();
            const transition = useSignInTransition();
            useEffect(() => { window.__sessionTest = session; window.__transitionTest = transition; }, [session, transition]);
            return React.createElement('output', { 'data-testid': 'session' },
              session.status + ':' + (session.user?.uid || '') + ':' + session.error);
          }
          createRoot(document.getElementById('root')).render(
            React.createElement(StrictMode, null, React.createElement(MemoryRouter, null,
              React.createElement(SchoolAuthProvider, null,
                React.createElement(SignInTransitionProvider, null, React.createElement(Probe)))))
          );
        `;
      },
      configureServer(vite) {
        vite.middlewares.use('/__session-test__', async (_req, res, next) => {
          try {
            res.setHeader('Content-Type', 'text/html');
            res.end(await vite.transformIndexHtml('/__session-test__',
              '<!doctype html><div id="root"></div><script type="module" src="/session-test-entry.jsx"></script>'));
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});

test.afterAll(async () => { await server?.close(); });

async function open(page) {
  await page.goto(baseURL + '/__session-test__');
  await expect(page.getByTestId('session')).toHaveText('signed-out::');
}

test('overlapping checks share one sync and fresh sign-in avoids forced refreshes', async ({ page }) => {
  const requests = [];
  await page.route('**/api/users/login', route => { requests.push(route); });
  await open(page);
  await page.evaluate(() => {
    window.__authTest.signIn('student');
    window.__firstCheck = window.__sessionTest.refreshSession({ reloadUser: false });
    window.__secondCheck = window.__sessionTest.refreshSession({ reloadUser: false });
  });
  await expect.poll(() => requests.length).toBe(1);
  expect(await page.evaluate(() => window.__firstCheck === window.__secondCheck)).toBe(true);
  expect(requests[0].request().headers().authorization).toBe('Bearer student-token');
  await requests[0].fulfill({ json: {} });
  await expect(page.getByTestId('session')).toHaveText('ready:student:');
  expect(await page.evaluate(() => ({ reloads: window.__authTest.reloads, refreshes: window.__authTest.refreshes })))
    .toEqual({ reloads: 0, refreshes: 0 });
});

test('a late login response after sign-out cannot return ready', async ({ page }) => {
  const requests = [];
  await page.route('**/api/users/login', route => { requests.push(route); });
  await open(page);
  await page.evaluate(() => {
    window.__authTest.signIn('student');
    window.__pendingCheck = window.__sessionTest.refreshSession({ reloadUser: false });
  });
  await expect.poll(() => requests.length).toBe(1);
  await page.evaluate(() => window.__sessionTest.logout());
  await expect(page.getByTestId('session')).toHaveText('signed-out::');
  await requests[0].fulfill({ json: {} });
  expect(await page.evaluate(() => window.__pendingCheck)).toBe('signed-out');
  await expect(page.getByTestId('session')).toHaveText('signed-out::');
});

test('switching accounts ignores the old failure and signing in again starts a new sync', async ({ page }) => {
  const requests = [];
  await page.route('**/api/users/login', route => { requests.push(route); });
  await open(page);
  await page.evaluate(() => window.__authTest.signIn('first'));
  await expect.poll(() => requests.length).toBe(1);
  await page.evaluate(() => window.__authTest.signIn('second'));
  await expect.poll(() => requests.length).toBe(2);
  await requests[1].fulfill({ json: {} });
  await expect(page.getByTestId('session')).toHaveText('ready:second:');
  await requests[0].fulfill({ status: 503, json: { message: 'Old account request failed' } });
  await expect(page.getByTestId('session')).toHaveText('ready:second:');
  await page.evaluate(() => window.__sessionTest.logout());
  await expect(page.getByTestId('session')).toHaveText('signed-out::');
  await page.evaluate(() => window.__authTest.signIn('second'));
  await expect.poll(() => requests.length).toBe(3);
  await requests[2].fulfill({ json: {} });
  await expect(page.getByTestId('session')).toHaveText('ready:second:');
});

test('switching accounts during token loading does not sync the old account', async ({ page }) => {
  const tokens = [];
  await page.route('**/api/users/login', route => {
    tokens.push(route.request().headers().authorization);
    return route.fulfill({ json: {} });
  });
  await open(page);
  await page.evaluate(() => {
    window.__authTest.pendingTokenUid = 'first';
    window.__authTest.signIn('first');
    window.__pendingCheck = window.__sessionTest.refreshSession({ reloadUser: false });
  });
  await expect.poll(() => page.evaluate(() => typeof window.__authTest.releaseToken)).toBe('function');
  await page.evaluate(() => window.__authTest.signIn('second'));
  await expect(page.getByTestId('session')).toHaveText('ready:second:');
  await page.evaluate(() => window.__authTest.releaseToken());
  expect(await page.evaluate(() => window.__pendingCheck)).toBe('signed-out');
  expect(tokens).toEqual(['Bearer second-token']);
});

test('explicit verification can be checked repeatedly and refreshes changed token claims', async ({ page }) => {
  let syncs = 0;
  await page.route('**/api/users/login', route => { syncs++; return route.fulfill({ json: {} }); });
  await open(page);
  await page.evaluate(() => window.__authTest.signIn('student', false));
  await expect(page.getByTestId('session')).toHaveText('verify:student:');
  expect(await page.evaluate(() => window.__sessionTest.refreshSession())).toBe('verify');
  await page.evaluate(() => window.__authTest.verify());
  expect(await page.evaluate(() => window.__sessionTest.refreshSession())).toBe('ready');
  await expect(page.getByTestId('session')).toHaveText('ready:student:');
  expect(syncs).toBe(1);
  expect(await page.evaluate(() => ({ reloads: window.__authTest.reloads, refreshes: window.__authTest.refreshes })))
    .toEqual({ reloads: 2, refreshes: 1 });
});

test('sign-out while the transition is pending clears its overlay and scroll lock', async ({ page }) => {
  const requests = [];
  await page.route('**/api/users/login', route => { requests.push(route); });
  await open(page);
  await page.evaluate(() => {
    window.__transitionTest.begin();
    window.__authTest.signIn('student');
  });
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByTestId('sign-in-transition')).toBeVisible();
  await page.evaluate(() => window.__sessionTest.logout());
  await expect(page.getByTestId('sign-in-transition')).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await requests[0].fulfill({ json: {} });
  await expect(page.getByTestId('session')).toHaveText('signed-out::');
  await expect(page.getByTestId('sign-in-transition')).toHaveCount(0);
});

test('cancelled completion timers cannot dismiss a newer transition', async ({ page }) => {
  await open(page);
  await page.clock.install();
  await page.evaluate(() => {
    window.__transitionTest.begin();
    window.__transitionTest.finish();
    window.__transitionTest.cancel();
    window.__transitionTest.begin();
  });
  await page.clock.runFor(3100);
  await expect(page.getByTestId('sign-in-transition')).toHaveAttribute('data-phase', 'account');
  await page.evaluate(() => window.__transitionTest.cancel());
  await expect(page.getByTestId('sign-in-transition')).toHaveCount(0);
});

test('fast completion keeps progress alive before the success beat and reveal', async ({ page }) => {
  await open(page);
  await page.clock.install();
  await page.evaluate(() => {
    const ticket = window.__transitionTest.begin();
    window.__transitionTest.openingDashboard(ticket);
    window.__transitionTest.finish();
  });
  const screen = page.getByTestId('sign-in-transition');
  await page.clock.runFor(1000);
  await expect(screen).toHaveAttribute('data-phase', 'dashboard');
  await expect(page.locator('.sit-progress__sweep')).toBeVisible();
  // Repeated dashboard renders must not extend the presentation timer.
  await page.evaluate(() => window.__transitionTest.finish());
  await page.clock.runFor(1200);
  await expect(screen).toHaveAttribute('data-phase', 'complete');
  await page.clock.runFor(600);
  await expect(screen).toHaveAttribute('data-phase', 'leaving');
  await page.clock.runFor(240);
  await expect(screen).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});
