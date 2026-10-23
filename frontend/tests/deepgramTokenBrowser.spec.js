import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server, baseURL;
test.beforeAll(async () => {
  const authModule = '\0deepgram-token-test-auth';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'deepgram-token-test', enforce: 'pre',
      resolveId(id) { if (id === '../firebase' || id === 'firebase/auth') return authModule; },
      load(id) {
        if (id === authModule) return `
          export const auth = { authStateReady: async () => {}, currentUser: {
            uid: 'speech-test', email: 'student@spcba.edu.ph', emailVerified: true,
            getIdToken: async () => 'synthetic-school-token'
          } };
          export const signOut = async () => {};
        `;
      },
      configureServer(vite) {
        vite.middlewares.use('/__speech-test__', async (_req, res, next) => {
          try {
            const html = await vite.transformIndexHtml('/__speech-test__',
              '<!doctype html><html><body><div id="root"></div><script type="module" src="/tests/fixtures/deepgramToken.jsx"></script></body></html>');
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

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'] });

// The debugger's direct mode still uses grants; MicTest now uses /ws/mic-test.
for (const debuggerView of [true]) {
  test(`${debuggerView ? 'Flux debugger' : 'microphone test'} uses a fresh bearer grant and still transcribes`, async ({ page }) => {
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/deepgram/token', async route => {
      if (route.request().method() !== 'OPTIONS') requests.push(route.request().headers().authorization);
      await route.fulfill({ json: { token: `temporary-grant-${requests.length}`, expiresIn: 30 }, headers: {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization',
      } });
    });
    await page.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      window.speechSockets = [];
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor(url, protocols) {
          if (!url.startsWith('wss://api.deepgram.com/')) return new NativeWebSocket(url, protocols);
          this.url = url;
          this.protocols = protocols;
          this.audioChunks = 0;
          window.speechSockets.push(this);
          queueMicrotask(() => this.onopen?.());
        }
        send() { this.audioChunks++; }
        close() {
          this.readyState = 3;
          queueMicrotask(() => this.onclose?.({ code: 1000, reason: '', wasClean: true }));
        }
      };
    });
    await page.goto(`${baseURL}/__speech-test__${debuggerView ? '?debugger' : ''}`);
    if (debuggerView) await page.getByRole('button', { name: 'Direct Browser WS' }).click();
    const start = () => page.getByRole('button', { name: debuggerView ? /Start Test/ : 'Test microphone' }).click();
    await start();
    await expect.poll(() => page.evaluate(() => window.speechSockets.length)).toBe(1);
    const socket = await page.evaluate(() => ({ url: window.speechSockets[0].url, protocols: window.speechSockets[0].protocols }));
    expect(socket.url).toMatch(/^wss:\/\/api.deepgram.com\/v2\/listen\?/);
    expect(socket.protocols).toEqual(['bearer', 'temporary-grant-1']);
    await expect.poll(() => page.evaluate(() => window.speechSockets[0].audioChunks)).toBeGreaterThan(0);
    await page.evaluate(() => window.speechSockets[0].onmessage({ data: JSON.stringify({
      event: 'EndOfTurn', turn_index: 0, transcript: 'Synthetic microphone check passed',
    }) }));
    await expect(page.getByText('Synthetic microphone check passed', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /Stop test/i }).click();
    await start();
    await expect.poll(() => page.evaluate(() => window.speechSockets.length)).toBe(2);
    expect(await page.evaluate(() => window.speechSockets[1].protocols)).toEqual(['bearer', 'temporary-grant-2']);
    expect(requests).toEqual(['Bearer synthetic-school-token', 'Bearer synthetic-school-token']);
    expect(errors).toEqual([]);
  });
}
