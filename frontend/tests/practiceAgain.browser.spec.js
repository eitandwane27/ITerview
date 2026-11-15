import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import http from 'node:http';
import { once } from 'node:events';
import { speechAudioBase64 } from './fixtures/speechAudio';

const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const express = require('express');
const { WebSocketServer } = require('ws');
const { createSchoolAuth } = require('./middleware/schoolAuth');
const { createPracticeAgainRouter } = require('./routes/practiceAgainRoutes');
const { createPracticeAgainHandler } = require('./controllers/practiceAgainSocket');
const { getRoleCatalogue } = require('./config/roleConfig');
const id = '123456789012345678901234';
let vite, backend, wss, baseURL, records, failLoad, failRemove, evaluations, tokens, slowSpeech, releaseSpeech, playFeedback;
const firstQuestion = () => ({ id, text: 'Tell me about a time you helped a teammate.', role: 'backend',
  set: 3, questionIndex: 0, difficulty: 'Easy', tip: 'Describe your own actions and the result.', savedAt: '2026-10-22T01:00:00Z', isSaved: true });
const auth = createSchoolAuth(async token => {
  tokens.push(token);
  return { uid: 'practice-browser', email: 'student@spcba.edu.ph', email_verified: token === 'practice-token',
    firebase: { sign_in_provider: 'password' } };
});
const library = {
  list: async uid => {
    expect(uid).toBe('practice-browser');
    if (failLoad) throw new Error('offline');
    return records.filter(q => q.isSaved);
  },
  save: async (uid, input) => {
    expect(uid).toBe('practice-browser');
    const question = { ...firstQuestion(), ...input, role: 'backend', difficulty: 'Medium', isSaved: true };
    records = [question]; return question;
  },
  setSaved: async (uid, savedId, isSaved) => {
    expect(uid).toBe('practice-browser');
    if (failRemove && !isSaved) throw new Error('offline');
    const question = records.find(q => q.id === savedId);
    if (question) question.isSaved = isSaved;
    return question;
  },
};
test.beforeAll(async () => {
  const app = express();
  app.use((_req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api/practice-again', createPracticeAgainRouter({ authenticate: auth.requireSchoolUser, library }));
  app.get('/api/recommendations/roles', (_req, res) => res.json({ roles: getRoleCatalogue() }));
  app.get('/api/users/results-summary', (_req, res) => res.json({ practiceHistory: [], threeCBreakdown: {} }));
  app.get('/api/users/active-practice-session', (_req, res) => res.json({ nextStage: 'complete' }));
  app.get('/api/users/:uid', (_req, res) => res.json({ user: { role: 'frontend', difficulty: 'hard', unlockedDifficulty: 'hard', displayName: 'Sam' }, hasCompletedDiagnostic: true }));
  backend = http.createServer(app);
  wss = new WebSocketServer({ noServer: true, handleProtocols: protocols => protocols.has('iterview') ? 'iterview' : false });
  backend.on('upgrade', async (req, socket, head) => {
    try {
      await auth.authenticateSocket(req);
      wss.handleUpgrade(req, socket, head, ws => {
        if (req.url.startsWith('/ws/set2')) {
          ws.send(JSON.stringify({ type: 'session_meta', role: 'backend', difficulty: 'medium', mode: 'practice', totalQuestions: 5 }));
          ws.send(JSON.stringify({ type: 'question_text', text: 'Explain APIs.', index: 1 }));
          ws.send(JSON.stringify({ type: 'audio_unavailable' }));
        } else {
          createPracticeAgainHandler({
            loadVoice: async () => 'aura-2-zeus-en',
            find: async (uid, savedId) => {
              expect(uid).toBe('practice-browser');
              const question = records.find(q => q.id === savedId && q.isSaved);
              return question ? { ...question, difficulty: question.difficulty.toLowerCase(), competency: 'Teamwork & Collaboration' } : null;
            },
            speak: async (text, voice) => {
              expect(voice).toBe('aura-2-zeus-en');
              if (slowSpeech && text === 'You described a concrete contribution.') {
                return new Promise(resolve => { releaseSpeech = () => resolve(playFeedback ? Buffer.from(speechAudioBase64(), 'base64') : null); });
              }
              throw new Error('Audio offline');
            },
            reportTiming: () => {},
            stt: onTranscript => {
              let sent = false;
              return { sendAudio() { if (!sent) { sent = true; onTranscript('I helped my teammate test our project and we submitted it on time.', true); } }, finish() {} };
            },
            evaluate: async (question, text) => {
              evaluations.push({ question, text });
              return { situation_score: 4, action_score: 4, result_score: 4,
                tip: 'Explain how your help changed the outcome.', interviewer_reply: 'You described a concrete contribution.' };
            },
          })(ws, req);
        }
      });
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
  const authModule = '\0practice-again-auth';
  vite = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    define: { 'import.meta.env.VITE_BACKEND_URL': JSON.stringify(`http://127.0.0.1:${backend.address().port}`) },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'practice-again-harness', enforce: 'pre',
      resolveId(id) { if (id === '../firebase' || id === 'firebase/auth') return authModule; },
      load(id) { if (id === authModule) return `
        const user = { uid: 'practice-browser', displayName: 'Sam', email: 'student@spcba.edu.ph', emailVerified: true, getIdToken: async () => 'practice-token' };
        export const auth = { currentUser: user, authStateReady: async () => {} };
        export function onAuthStateChanged(_auth, callback) { let live = true; queueMicrotask(() => live && callback(user)); return () => { live = false; }; }
        export async function signOut() {} export async function updateProfile() {}
      `; },
      configureServer(server) { server.middlewares.use('/__practice-again__', async (_req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml('/__practice-again__', '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/practiceAgain.jsx"></script></body></html>'));
        } catch (error) { next(error); }
      }); },
    }],
  });
  await vite.listen(); baseURL = `http://127.0.0.1:${vite.httpServer.address().port}/__practice-again__`;
});
test.afterAll(async () => {
  wss?.clients.forEach(ws => ws.terminate()); wss?.close(); backend?.close(); await vite?.close();
});
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['microphone'] });
test.beforeEach(async ({ page }) => {
  records = [firstQuestion()]; failLoad = false; failRemove = false; evaluations = []; tokens = [];
  slowSpeech = false; releaseSpeech = null;
  playFeedback = false;
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('library loads account data, filters, removes, undoes and survives refresh', async ({ page }) => {
  await page.goto(baseURL);
  const panel = page.getByRole('tabpanel', { name: 'Practice Again', exact: true });
  await expect(panel.getByRole('button', { name: `Practice: ${records[0].text}`, exact: true })).toBeVisible();
  await panel.getByRole('searchbox').fill('no match');
  await expect(panel.getByRole('heading', { name: 'No matching questions' })).toBeVisible();
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await panel.getByRole('button', { name: `Remove saved question: ${records[0].text}` }).click();
  await expect(panel.getByRole('heading', { name: 'No saved questions yet' })).toBeVisible();
  await panel.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(panel.getByRole('button', { name: `Practice: ${records[0].text}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(panel.getByRole('button', { name: `Practice: ${records[0].text}`, exact: true })).toBeVisible();
  expect(tokens).toContain('practice-token');
});
test('failed reads and removals remain recoverable and do not claim success', async ({ page }) => {
  failLoad = true;
  await page.goto(baseURL);
  const panel = page.getByRole('tabpanel', { name: 'Practice Again', exact: true });
  await expect(panel.getByRole('alert')).toBeVisible();
  failLoad = false;
  await panel.getByRole('button', { name: 'Try again', exact: true }).click();
  const remove = panel.getByRole('button', { name: `Remove saved question: ${records[0].text}` });
  await expect(remove).toBeVisible();
  failRemove = true; await remove.click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(remove).toBeVisible();
  expect(records[0].isSaved).toBe(true);
});
test('interview bookmarks persist to the dashboard and undo is saved on the server', async ({ page }) => {
  records = [];
  await page.goto(`${baseURL}?start=${encodeURIComponent('/interview?set=2&mode=practice&autostart=true')}`);
  await expect(page.getByRole('heading', { name: 'Explain APIs.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save question 1 for practice', exact: true }).first().click();
  await expect.poll(() => records.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Remove question 1 from practice', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => records[0].isSaved).toBe(false);
  await page.getByRole('button', { name: 'Save question 1 for practice', exact: true }).first().click();
  await expect.poll(() => records[0].isSaved).toBe(true);
  await page.goto(baseURL);
  await expect(page.getByRole('button', { name: 'Practice: Explain APIs.', exact: true })).toBeVisible();
});
test('saved behavioral question runs one voice retry, gives feedback, and returns to the library on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByRole('button', { name: `Practice: ${records[0].text}`, exact: true }).click();
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByTestId('test-location')).toHaveText(`/interview?set=3&questionId=${id}&autostart=true`);
  await expect(page.getByText('Question 1 of 1', { exact: true })).toBeVisible();
  const mic = page.locator('#btn-toggle-mic');
  await expect(mic).toBeEnabled(); await mic.click();
  await expect(page.getByText('I helped my teammate test our project and we submitted it on time.', { exact: true }).first()).toBeVisible();
  await mic.click();
  expect(evaluations).toHaveLength(0);
  await page.getByRole('button', { name: 'Edit transcript', exact: true }).click();
  const correctedAnswer = 'I helped my teammate test our React project and we submitted it on time.';
  await page.getByRole('textbox', { name: 'Edit transcript', exact: true }).fill(correctedAnswer);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  const finish = page.getByRole('button', { name: 'Return to Practice Again', exact: true });
  await expect(finish).toBeVisible();
  expect(evaluations).toHaveLength(1);
  expect(evaluations[0].text).toBe(correctedAnswer);
  expect(evaluations[0].question).toMatchObject({ set: 3, role: 'backend', difficulty: 'easy' });
  await expect(page.getByText('Explain how your help changed the outcome.', { exact: true }).first()).toBeVisible();
  await finish.click();
  await expect(page.getByRole('tabpanel', { name: 'Practice Again', exact: true })).toBeVisible();
  expect(records).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('disconnecting during a retry stops the microphone and allows returning to the library', async ({ page }) => {
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.practiceTracks = [];
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await getUserMedia(...args);
      window.practiceTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto(`${baseURL}?start=${encodeURIComponent(`/interview?set=3&questionId=${id}&autostart=true`)}`);
  await expect(page.locator('#btn-toggle-mic')).toBeEnabled();
  await page.locator('#btn-toggle-mic').click();
  await expect.poll(() => page.evaluate(() => window.practiceTracks.length)).toBeGreaterThan(0);
  wss.clients.forEach(ws => ws.terminate());
  await expect(page.getByRole('alert')).toContainText('connection closed');
  await expect.poll(() => page.evaluate(() => window.practiceTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await page.locator('#btn-session-end').click();
  await page.getByRole('button', { name: 'Leave Drill', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Practice Again', exact: true })).toBeVisible();
});

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`practice orb moves from preparing to speaking to complete with ${reducedMotion} motion`, async ({ page }) => {
    slowSpeech = true; playFeedback = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion });
    try {
      await page.goto(`${baseURL}?start=${encodeURIComponent(`/interview?set=3&questionId=${id}&autostart=true`)}`);
      const mic = page.locator('#btn-toggle-mic');
      await expect(mic).toBeEnabled(); await mic.click();
      const orb = page.locator('.ix-orb-container');
      await expect(orb).toHaveAttribute('data-state', 'listening');
      await expect(page.getByText('I helped my teammate test our project and we submitted it on time.', { exact: true }).first()).toBeVisible();
      await mic.click();
      await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
      await expect.poll(() => Boolean(releaseSpeech)).toBe(true);
      await expect(page.locator('.ix-stage-card')).toHaveAttribute('data-state', 'responding');
      await expect(orb).toHaveAttribute('data-state', 'evaluating');
      await expect(orb).toHaveAttribute('aria-label', 'AI interviewer is preparing spoken feedback');
      await expect(page.getByRole('button', { name: 'Return to Practice Again', exact: true })).toBeEnabled();
      releaseSpeech();
      await expect(page.locator('.ix-stage-card')).toHaveAttribute('data-state', 'speaking');
      await expect(orb).toHaveAttribute('data-state', 'speaking');
      await expect(orb).toHaveAttribute('data-expressive', 'true');
      await expect.poll(() => orb.evaluate(element => Number(element.style.getPropertyValue('--ix-orb-fallback-level')))).toBeGreaterThan(0.03);
      if (reducedMotion === 'no-preference') {
        await page.locator('.ix-stage-card').screenshot({ path: 'test-results/practice-orb-speaking-mobile.png' });
      } else {
        expect(await page.locator('.ix-stage-signal').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
      }
      await expect(orb).toHaveAttribute('data-state', 'complete', { timeout: 10000 });
      await expect(page.locator('.ix-stage-card')).toHaveAttribute('data-state', 'complete');
    } finally { releaseSpeech?.(); }
  });
}

test('slow speech generation does not keep the retry in the analyzing state', async ({ page }) => {
  slowSpeech = true;
  try {
    await page.goto(`${baseURL}?start=${encodeURIComponent(`/interview?set=3&questionId=${id}&autostart=true`)}`);
    const mic = page.locator('#btn-toggle-mic');
    await expect(mic).toBeEnabled(); await mic.click();
    await expect(page.getByText('I helped my teammate test our project and we submitted it on time.', { exact: true }).first()).toBeVisible();
    await mic.click();
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await expect.poll(() => Boolean(releaseSpeech)).toBe(true);
    // The speech promise remains unresolved throughout these assertions.
    await expect(page.locator('.ix-state-evaluating')).toHaveCount(0);
    await expect(page.locator('.ix-stage-card')).toHaveAttribute('data-state', 'responding');
    await expect(page.locator('.ix-orb-container')).toHaveAttribute('data-state', 'evaluating');
    await expect(page.getByText('Explain how your help changed the outcome.', { exact: true }).first()).toBeVisible();
    const finish = page.getByRole('button', { name: 'Return to Practice Again', exact: true });
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(page.getByRole('tabpanel', { name: 'Practice Again', exact: true })).toBeVisible();
    expect(evaluations).toHaveLength(1);
  } finally { releaseSpeech?.(); }
});
