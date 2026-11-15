import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import http from 'node:http';
import { once } from 'node:events';

const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { WebSocketServer } = require('ws');
const { createSchoolAuth } = require('./middleware/schoolAuth');
let vite, backend, wss, baseURL, mode, sessions, authCalls, tokenRequests;

test.beforeAll(async () => {
  // Use the real backend controller and school-auth handshake. Only Deepgram
  // itself is replaced, so tests never consume credits or need a server key.
  const stt = require('./services/sttService');
  const original = stt.createDeepgramLiveSession;
  const controllerPath = require.resolve('./controllers/micTestSocket');
  const cached = require.cache[controllerPath];
  let handleMicTestSocket;
  try {
    stt.createDeepgramLiveSession = (onTranscript, onError) => {
      const session = { onTranscript, onError, chunks: 0, finished: false,
        sendAudio() { this.chunks++; }, finish() { this.finished = true; } };
      sessions.push(session);
      return session;
    };
    delete require.cache[controllerPath];
    ({ handleMicTestSocket } = require(controllerPath));
  } finally {
    stt.createDeepgramLiveSession = original;
    delete require.cache[controllerPath];
    if (cached) require.cache[controllerPath] = cached;
  }
  const auth = createSchoolAuth(async token => {
    authCalls.push(token);
    return { uid: 'mic-browser-test', email: 'student@spcba.edu.ph', email_verified: token === 'synthetic-school-token',
      firebase: { sign_in_provider: 'password' } };
  });
  backend = http.createServer((req, res) => {
    if (req.url === '/api/deepgram/token') tokenRequests++;
    res.writeHead(502, { 'Access-Control-Allow-Origin': '*' });
    res.end();
  });
  wss = new WebSocketServer({ noServer: true, handleProtocols: protocols => protocols.has('iterview') ? 'iterview' : false });
  backend.on('upgrade', async (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname !== '/ws/mic-test' || mode === 'reject') {
      socket.end('HTTP/1.1 503 Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    try {
      await auth.authenticateSocket(req);
      wss.handleUpgrade(req, socket, head, handleMicTestSocket);
    } catch (error) { socket.end(`HTTP/1.1 ${error.status} Forbidden\r\nConnection: close\r\n\r\n`); }
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const authModule = '\0mic-test-auth';
  vite = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    define: { 'import.meta.env.VITE_BACKEND_URL': JSON.stringify(`http://127.0.0.1:${backend.address().port}`) },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'mic-test-auth', enforce: 'pre',
      resolveId(id) { if (id === '../firebase' || id === 'firebase/auth') return authModule; },
      load(id) { if (id === authModule) return `
        export const auth = { authStateReady: async () => {}, currentUser: {
          uid: 'mic-browser-test', email: 'student@spcba.edu.ph', emailVerified: true,
          getIdToken: async () => 'synthetic-school-token'
        } };
        export const signOut = async () => {};
      `; },
      configureServer(server) {
        server.middlewares.use('/__mic-test__', async (_req, res, next) => {
          try {
            res.setHeader('Content-Type', 'text/html');
            res.end(await server.transformIndexHtml('/__mic-test__',
              '<html><body><div id="root"></div><script type="module" src="/tests/fixtures/deepgramToken.jsx"></script></body></html>'));
          } catch (error) { next(error); }
        });
      },
    }],
  });
  await vite.listen();
  baseURL = `http://127.0.0.1:${vite.httpServer.address().port}/__mic-test__`;
});

test.afterAll(async () => {
  wss?.clients.forEach(ws => ws.terminate());
  wss?.close();
  backend?.close();
  await vite?.close();
});
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'] });
test.beforeEach(async ({ page }) => {
  mode = 'normal'; sessions = []; authCalls = []; tokenRequests = 0;
  await page.route('**/api/users/mic-browser-test', route => route.fulfill({
    json: { user: { interviewerVoice: 'aura-2-andromeda-en' } },
  }));
  await page.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.micTracks = [];
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await getUserMedia(...args);
      window.micTracks.push(...stream.getTracks());
      if (window.deferMic) await new Promise(resolve => { window.resumeMic = resolve; });
      return stream;
    };
  });
});

async function start(page) {
  const expectedSessions = sessions.length + 1;
  await page.getByRole('button', { name: 'Test microphone' }).click();
  await expect.poll(() => sessions.length).toBe(expectedSessions);
  await expect.poll(() => sessions.at(-1).chunks).toBeGreaterThan(0);
}
async function expectReleased(page) {
  expect(await page.evaluate(() => window.micTracks.length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.micTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Test microphone' })).toBeEnabled();
}

test('mic check transcribes through the authenticated backend, stops, and restarts without Deepgram grants', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await start(page);
  sessions[0].onTranscript('Testing', false);
  await expect(page.getByText('Testing', { exact: true })).toBeVisible();
  sessions[0].onTranscript('My microphone works.', true);
  await expect(page.getByText('My microphone works.', { exact: true })).toBeVisible();
  await expect(page.getByText('Mic check passed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Stop test/i }).click();
  await expectReleased(page);
  await expect.poll(() => sessions[0].finished).toBe(true);
  await start(page);
  expect(sessions.length).toBe(2);
  expect(authCalls).toEqual(['synthetic-school-token', 'synthetic-school-token']);
  expect(tokenRequests).toBe(0);
  await page.goto('about:blank');
  await expect.poll(() => sessions[1].finished).toBe(true);
  expect(errors).toEqual([]);
});

test('provider failure shows a safe error, releases audio, and allows retry', async ({ page }) => {
  await page.goto(baseURL);
  await start(page);
  sessions[0].onError(new Error('Synthetic upstream secret'));
  await expect(page.getByRole('alert')).toHaveText('Could not connect to speech service. Please try again.');
  await expectReleased(page);
  expect(sessions[0].finished).toBe(true);
  await start(page);
  expect(sessions.length).toBe(2);
});

test('unexpected disconnect releases audio and allows retry', async ({ page }) => {
  await page.goto(baseURL);
  await start(page);
  wss.clients.forEach(ws => ws.close());
  await expect(page.getByRole('alert')).toHaveText('Speech service disconnected. Please run the microphone test again.');
  await expectReleased(page);
  await expect.poll(() => sessions[0].finished).toBe(true);
  await start(page);
  expect(sessions.length).toBe(2);
});

test('failed backend handshake releases the microphone without requesting a grant', async ({ page }) => {
  mode = 'reject';
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Test microphone' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not connect to speech service. Check your connection and sign in again if needed.');
  await expectReleased(page);
  expect(tokenRequests).toBe(0);
  expect(sessions.length).toBe(0);
});

test('leaving during microphone setup releases a late stream without opening speech', async ({ page }) => {
  await page.goto(baseURL);
  await page.evaluate(() => { window.deferMic = true; });
  await page.getByRole('button', { name: 'Test microphone' }).click();
  await expect.poll(() => page.evaluate(() => window.micTracks.length)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Start interview' }).click();
  await page.evaluate(() => window.resumeMic());
  await expect.poll(() => page.evaluate(() => window.micTracks.every(track => track.readyState === 'ended'))).toBe(true);
  expect(sessions.length).toBe(0);
});

for (const scenario of [
  { name: 'desktop', width: 1440, height: 1000, reduced: false },
  { name: 'mobile', width: 390, height: 844, reduced: false },
  { name: 'reduced motion', width: 1440, height: 1000, reduced: true },
]) {
  test(`start interview hands off to the briefing with the interview voice on ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.emulateMedia({ reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
    await page.clock.install({ time: new Date('2026-10-16T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-16T00:00:01Z'));
    await page.goto(`${baseURL}?handoff`);
    const voice = page.getByRole('combobox', { name: 'AI interviewer voice' });
    await expect(voice).toHaveText('Andromeda');
    await expect(page.getByRole('button', { name: 'Hear sample' })).toBeVisible();
    if (!scenario.reduced) {
      await voice.click();
      const menu = page.getByRole('listbox', { name: 'AI interviewer voice' });
      await expect(menu).toBeVisible();
      await expect(voice).toHaveCSS('padding-inline-start', '12px');
      await expect(menu).toHaveCSS('padding-inline-start', '6px');
      await expect(menu.getByText('Feminine', { exact: true })).toHaveCSS('padding-inline-start', '10px');
      await expect(menu.getByRole('option', { selected: true })).toHaveCSS('padding-inline-end', '10px');
      await expect.poll(() => menu.evaluate(list => list.clientHeight <= 236 && list.scrollHeight > list.clientHeight)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('voice-menu.png'), animations: 'disabled' });
      await voice.press('Escape');
      await expect(menu).toBeHidden();
    }
    await page.locator('#mictest-proceed-btn').scrollIntoViewIfNeeded();
    if (!scenario.reduced) await page.screenshot({ path: testInfo.outputPath('setup.png'), fullPage: true });
    // Dispatch twice in the same frame to cover accidental repeated activation.
    await page.locator('#mictest-proceed-btn').evaluate(button => { button.click(); button.click(); });
    await expect(page.locator('#mictest-proceed-btn')).toBeDisabled();
    await expect(page.locator('#mictest-proceed-btn')).toHaveText('Starting interview…');
    await expect(page.locator('.mictest-root')).toHaveAttribute('aria-busy', 'true');
    await page.clock.runFor(scenario.reduced ? 250 : 650);
    await expect(page.locator('.mictest-root')).toHaveCount(0);
    await expect(page.locator('.test-page')).toBeVisible();
    await expect(page.getByTestId('selected-voice')).toHaveText('aura-2-andromeda-en');
    // Opacity-only reduced-motion fades may use native browser animation time.
    await page.clock.resume();
    await expect.poll(() => page.locator('.test-page').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    expect(await page.locator('.test-page').evaluate(element => ({
      opacity: getComputedStyle(element).opacity,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }))).toEqual({ opacity: '1', overflow: false });
    if (!scenario.reduced) await page.screenshot({ path: testInfo.outputPath('briefing.png'), fullPage: true });
  });
}

test('plays a static preview and saves the selected voice before the interview', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const synthesisRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/tts/speak') synthesisRequests.push(request.url());
  });
  let saved;
  await page.route('**/api/users/role', route => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: {} });
  });
  await page.goto(`${baseURL}?handoff`);
  const picker = page.getByRole('combobox', { name: 'AI interviewer voice' });
  const options = page.getByRole('listbox', { name: 'AI interviewer voice' });
  await picker.press('ArrowDown');
  await expect(options.getByRole('option')).toHaveCount(26);
  await picker.press('Home');
  const luna = options.getByRole('group', { name: 'Feminine' }).getByRole('option', { name: 'Luna (Default)' });
  await expect(luna).toHaveAttribute('data-active', 'true');
  await picker.press('End');
  await expect(options.getByRole('group', { name: 'Masculine' }).getByRole('option', { name: 'Zeus' })).toBeInViewport();
  await picker.press('Enter');
  await expect(picker).toHaveText('Zeus');
  const sample = page.waitForResponse(response => response.url().includes('aura-2-zeus-en.wav'));
  await page.getByRole('button', { name: 'Hear sample' }).click();
  expect((await sample).ok()).toBeTruthy();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop sample' }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await page.getByRole('button', { name: 'Start interview' }).click();
  await expect(page.getByTestId('selected-voice')).toHaveText('aura-2-zeus-en');
  expect(saved).toEqual({ interviewerVoice: 'aura-2-zeus-en' });
  expect(synthesisRequests).toEqual([]);
});
