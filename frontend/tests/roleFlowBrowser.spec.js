import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../backend/config/roleConfig');
const catalogue = [...getRoleCatalogue(), { id: 'qa-test', label: 'Quality Assurance Specialist',
  topics: ['Test planning', 'Defect reporting'],
  setTopics: { set1: ['Test planning'], set2: ['Defect reporting'] },
  supportedDifficulties: { set1: ['easy', 'medium', 'hard'], set2: ['easy', 'medium', 'hard'], set3: ['easy'] } }];
let server;
let baseURL;

test.beforeAll(async () => {
  const authModule = '\0role-flow-test-auth';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'role-flow-test-harness', enforce: 'pre',
      resolveId(id) { if (id === '../firebase' || id === 'firebase/auth') return authModule; },
      load(id) {
        if (id === authModule) return `
          const user = { uid: 'role-flow-user', displayName: 'Test User', email: 'test@example.test' };
          export const auth = { currentUser: user };
          export function onAuthStateChanged(_auth, callback) { queueMicrotask(() => callback(user)); return () => {}; }
        `;
      },
      configureServer(vite) {
        vite.middlewares.use('/__role-flow__', async (_req, res, next) => {
          try {
            const html = await vite.transformIndexHtml('/__role-flow__',
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/roleFlow.jsx"></script></body></html>');
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});
test.afterAll(async () => { await server?.close(); });

async function mockApi(page, { saveStatus = 200, onSave = () => {}, profileDelay = 0 } = {}) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/recommendations/roles') return route.fulfill({ json: { roles: catalogue } });
    if (url.pathname === '/api/users/role') {
      onSave(route.request().postDataJSON());
      return route.fulfill({ status: saveStatus, json: {} });
    }
    if (profileDelay) await new Promise(resolve => setTimeout(resolve, profileDelay));
    return route.fulfill({ json: { user: { role: 'backend', difficulty: 'hard', unlockedDifficulty: 'hard' } } });
  });
}

for (const role of catalogue) {
  test(`${role.id} uses its catalogue label in briefing, loader, and transition`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await mockApi(page);
    for (const view of ['briefing', 'loader', 'transition']) {
      await page.goto(`${baseURL}/__role-flow__?view=${view}&role=${role.id}`);
      const label = view === 'briefing' ? page.locator('.sb-role-badge')
        : view === 'transition' ? page.locator('.s2-role-highlight') : page.locator('.al-context-chip').first();
      if (view === 'loader') await expect(page.getByText(role.label, { exact: true }).first()).toBeVisible();
      else await expect(label).toHaveText(role.label);
      if (view === 'loader') await expect(page.getByText(`Focusing on ${role.setTopics.set2.slice(0, 3).join(', ')}`, { exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test('briefing stops after a rejected settings save and opens no socket', async ({ page }) => {
  let sockets = 0;
  await page.routeWebSocket(/\/ws\/set1/, () => { sockets++; });
  await mockApi(page, { saveStatus: 400 });
  await page.goto(`${baseURL}/__role-flow__?view=briefing`);
  await expect(page.locator('.sb-role-badge')).toHaveText('Quality Assurance Specialist');
  await page.getByRole('button', { name: 'Start Practice Studio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not save your interview settings. Please try again.');
  await expect(page.getByRole('button', { name: 'Start Practice Studio' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Enter Studio' })).toHaveCount(0);
  expect(sockets).toBe(0);
});

test('briefing saves canonical settings and waits for real readiness', async ({ page }) => {
  let saved;
  let socket;
  let socketUrl;
  await page.routeWebSocket(/\/ws\/set1/, ws => { socket = ws; socketUrl = new URL(ws.url()); });
  await mockApi(page, { onSave: body => { saved = body; } });
  await page.goto(`${baseURL}/__role-flow__?view=briefing`);
  await page.getByRole('button', { name: 'Start Practice Studio' }).click();
  await expect.poll(() => socketUrl?.searchParams.get('mode')).toBe('practice');
  expect(saved).toEqual({ firebaseUid: 'role-flow-user', role: 'qa-test', difficulty: 'hard', focusArea: 'clarity' });
  await expect(page.getByRole('button', { name: 'Enter Studio' })).toHaveCount(0);
  socket.send(JSON.stringify({ type: 'generation_complete', role: 'qa-test' }));
  await page.getByRole('button', { name: 'Enter Studio' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-confirmed', 'true');
});

test('briefing reports socket failure and keeps readiness disabled', async ({ page }) => {
  await mockApi(page);
  await page.routeWebSocket(/\/ws\/set1/, ws => {
    ws.send(JSON.stringify({ type: 'error', message: 'Question generation is temporarily unavailable.' }));
  });
  await page.goto(`${baseURL}/__role-flow__?view=briefing`);
  await page.getByRole('button', { name: 'Start Practice Studio' }).click();
  await expect(page.getByRole('alert')).toHaveText('Question generation is temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Start Practice Studio' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Enter Studio' })).toHaveCount(0);
});

test('briefing retries a failed catalogue without assigning a different role', async ({ page }) => {
  await mockApi(page);
  let unavailable = true;
  await page.route('**/api/recommendations/roles', route => {
    return route.fulfill(unavailable ? { status: 503, json: {} } : { json: { roles: catalogue } });
  });
  await page.goto(`${baseURL}/__role-flow__?view=briefing`);
  await expect(page.getByRole('button', { name: 'Start Practice Studio' })).toBeDisabled();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry loading roles' }).click();
  await expect(page.locator('.sb-role-badge')).toHaveText('Quality Assurance Specialist');
  await expect(page.getByRole('button', { name: 'Start Practice Studio' })).toBeEnabled();
});

for (const set of [1, 2, 3]) {
  test(`MainSets Set ${set} displays socket questions and keeps session settings after a late profile fetch`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let socket;
    const paths = [];
    await page.routeWebSocket(/\/ws\/set[123]/, ws => {
      socket = ws;
      paths.push(new URL(ws.url()).pathname);
      ws.send(JSON.stringify({ type: 'session_meta', role: 'qa-test', roleLabel: 'Quality Assurance Specialist', difficulty: 'easy', mode: 'practice', weakness: set === 1 ? 'focus_correctness' : undefined, totalQuestions: 5 }));
      ws.send(JSON.stringify({ type: 'question_text', text: 'What information belongs in a defect report?', index: 1 }));
    });
    await mockApi(page, { profileDelay: 200 });
    await page.goto(`${baseURL}/__role-flow__?view=main&set=${set}`);
    await expect(page.locator('.ix-question-title')).toHaveText('What information belongs in a defect report?');
    await expect(page.locator('.ix-badge-difficulty')).toHaveAttribute('data-difficulty', 'easy');
    await expect(page.locator('.ix-pip-avatar-circle')).toHaveText('TU');
    await expect(page.locator('.ix-badge-difficulty')).toHaveAttribute('data-difficulty', 'easy');
    expect(paths).toEqual([`/ws/set${set}`]);
    if (set === 1) {
      await expect(page.locator('.ix-focus-tag')).toHaveText('correctness');
      socket.send(JSON.stringify({ type: 'session_complete' }));
      await expect(page.locator('.s2-role-highlight')).toHaveText('Quality Assurance Specialist');
    }
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`additional-role briefing fits ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.goto(`${baseURL}/__role-flow__?view=briefing`);
    await expect(page.locator('.sb-role-badge')).toHaveText('Quality Assurance Specialist');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/role-flow-${viewport.name}.png`, fullPage: true });
  });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test('evaluation retries the original transcript on ' + viewport.name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        return context.createMediaStreamDestination().stream;
      };
    });
    await mockApi(page);
    let socket;
    const submitted = [];
    await page.routeWebSocket(/\/ws\/set1/, ws => {
      socket = ws;
      ws.send(JSON.stringify({ type: 'question_text', text: 'What is input validation?', index: 1 }));
      // Empty audio exercises the existing playback failure completion path.
      ws.send(JSON.stringify({ type: 'tts_audio', data: '' }));
      ws.onMessage(data => {
        if (typeof data !== 'string') return;
        const message = JSON.parse(data);
        if (message.type === 'start_recording') ws.send(JSON.stringify({ type: 'transcript', isFinal: true, text: 'It checks user input.' }));
        if (message.type === 'submit_answer') {
          submitted.push(message.final_text);
          if (submitted.length === 1) ws.send(JSON.stringify({ type: 'error', code: 'EVALUATION_FAILED', message: 'Could not score your answer. Retry evaluation to submit the same answer again.' }));
        }
      });
    });
    await page.goto(baseURL + '/__role-flow__?view=main&set=1');
    await expect(page.locator('#btn-toggle-mic')).toBeEnabled();
    await page.locator('#btn-toggle-mic').click();
    await expect(page.getByRole('button', { name: 'Stop & Submit' })).toBeVisible();
    await expect(page.getByText('It checks user input.', { exact: true }).first()).toBeVisible();
    await page.locator('#btn-toggle-mic').click();
    await expect(page.getByRole('alert')).toContainText('Could not score your answer');
    await expect(page.getByRole('button', { name: 'Retry evaluation' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/evaluation-retry-' + viewport.name + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Retry evaluation' }).click();
    await expect.poll(() => submitted.length).toBe(2);
    expect(submitted).toEqual(['It checks user input.', 'It checks user input.']);
    await expect(page.getByRole('button', { name: 'Retry evaluation' })).toHaveCount(0);
    socket.send(JSON.stringify({ type: 'question_text', text: 'What is an API?', index: 2 }));
    await expect(page.locator('.ix-question-title')).toHaveText('What is an API?');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
