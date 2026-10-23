import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server;
let baseURL;
test.beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'chatbot-browser-test',
      configureServer(vite) {
        vite.middlewares.use('/__chatbot-test__', async (req, res, next) => {
          try {
            const html = await vite.transformIndexHtml('/__chatbot-test__',
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f8fafc"><div id="root"></div><script type="module" src="/tests/fixtures/chatbot.jsx"></script></body></html>');
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

for (const viewport of [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
]) {
  test(`salary clarification, sources, follow-up, and reset on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/recommendations/**', async route => {
      if (route.request().url().endsWith('/roles')) return route.fulfill({ json: { roles: [] } });
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) return route.fulfill({ json: {
        reply: 'Do you mean highest paying? Which country and experience level should I compare?', recommendedRoleId: null,
      } });
      return route.fulfill({ json: {
        reply: 'Here is the career context for junior IT roles in the Philippines.\n\n- Salary estimates depend on the role and employer.\n- Compare pay periods and experience levels.',
        recommendedRoleId: null,
        sources: [
          { title: 'Philippines IT career and compensation report', url: 'https://example.org/report' },
          { title: 'Public report with a longer title that should wrap naturally inside the assistant without pushing links beyond the panel', url: 'https://example.net/careers' },
          { title: 'Unsafe source', url: 'javascript:alert(1)' },
        ], searchStatus: 'used',
      } });
    });
    await page.goto(`${baseURL}/__chatbot-test__`);
    await page.getByRole('button', { name: 'Ask about ITerview', exact: true }).click();
    await expect(page.getByText('Platform, study & career help')).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Ask about ITerview, studying, or your career' });
    await input.fill('whats like the most expensive role');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByText('Do you mean highest paying?', { exact: false })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sources for this reply' })).toHaveCount(0);
    await input.fill('Philippines, junior roles');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const sources = page.getByRole('navigation', { name: 'Sources for this reply' });
    await expect(sources).toBeVisible();
    await expect(sources.getByRole('link')).toHaveCount(2);
    const link = sources.getByRole('link').first();
    await expect(link).toHaveAttribute('href', 'https://example.org/report');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(page.getByText('Unsafe source')).toHaveCount(0);
    expect(requests[1].history.some(message => message.content.includes('Which country'))).toBe(true);
    const panel = page.locator('.track-guide-panel');
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await sources.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: testInfo.outputPath(`chatbot-${viewport.name}.png`) });
    await page.getByRole('button', { name: 'Start a new conversation' }).click();
    await expect(sources).toHaveCount(0);
    await expect(input).toHaveValue('');
    await expect(page.getByText("Hey! I can explain ITerview", { exact: false })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('search outage shows a useful response and its availability note', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/recommendations/**', route => route.fulfill({ json: route.request().url().endsWith('/roles')
    ? { roles: [] }
    : { reply: "I couldn't verify current job demand. We can still compare career paths.", searchStatus: 'unavailable' } }));
  await page.goto(`${baseURL}/__chatbot-test__`);
  await page.getByRole('button', { name: 'Ask about ITerview', exact: true }).click();
  await page.getByRole('textbox').fill('Current IT job demand');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Live search was unavailable for this reply.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sources for this reply' })).toHaveCount(0);
});
