import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../backend/services/chatbotKnowledgeService');
let server;
let baseURL;

test.beforeAll(async () => {
  const authModule = '\0dashboard-coach-test-auth';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'dashboard-coach-test',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'firebase/auth' || id === '../firebase') return authModule;
        },
        load(id) {
          if (id !== authModule) return;
          return `
          const user = { uid: 'coach-browser-user', displayName: 'Sam', email: 'sam@spcba.edu.ph', emailVerified: true, getIdToken: async () => 'coach-test-token' };
          export const auth = { currentUser: user, authStateReady: async () => {} };
          export function onAuthStateChanged(_auth, callback) { let live = true; queueMicrotask(() => live && callback(user)); return () => { live = false; }; }
          export async function updateProfile() {}
          export async function signOut() {}
        `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__coach-test__', async (_req, res, next) => {
            try {
              const html = await vite.transformIndexHtml(
                '/__coach-test__',
                '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fonts/fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/roleDashboard.jsx"></script></body></html>'
              );
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
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

const snapshot = (assessed = true) => ({
  fetchedAt: '2026-10-11T12:00:00Z',
  hasAssessmentData: assessed,
  role: 'backend',
  roleLabel: 'Backend Developer',
  difficulty: 'easy',
  preTestScore: assessed ? 60 : null,
  practiceScore: assessed ? 75 : null,
  postTestScore: assessed ? 80 : null,
  nextStage: assessed ? 'complete' : 'likert-pre',
});
async function api(page, { context = snapshot(), onChat, onContext } = {}) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/coach'))
      expect(route.request().headers().authorization).toBe('Bearer coach-test-token');
    if (path === '/api/coach/context')
      return onContext ? onContext(route) : route.fulfill({ json: { context } });
    if (path === '/api/coach/chat')
      return onChat
        ? onChat(route)
        : route.fulfill({
            json: {
              context,
              reply: context.hasAssessmentData
                ? 'Your baseline is 60%. Let’s practice completeness with one concrete example.'
                : 'You have no saved assessment results yet. Start with your confidence check; we can still practice a beginner answer.',
            },
          });
    if (path === '/api/recommendations/roles')
      return route.fulfill({ json: { roles: getRoleCatalogue() } });
    if (path === '/api/users/results-summary')
      return route.fulfill({
        json: { preTestScore: context.preTestScore, practiceHistory: [], threeCBreakdown: {} },
      });
    if (path === '/api/users/active-practice-session')
      return route.fulfill({ json: { nextStage: context.nextStage } });
    if (path === '/api/users/coach-browser-user')
      return route.fulfill({
        json: {
          user: { role: 'backend', unlockedDifficulty: 'easy', displayName: 'Sam' },
          hasCompletedDiagnostic: context.hasAssessmentData,
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
}
async function open(page) {
  await page.goto(`${baseURL}/__coach-test__`);
  await page.getByRole('tab', { name: 'AI Coach', exact: true }).click();
  return page.getByRole('tabpanel', { name: 'AI Coach', exact: true });
}

for (const viewport of [
  { width: 1440, height: 1000, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
]) {
  for (const assessed of [true, false]) {
    test(`${assessed ? 'saved metrics' : 'no assessment'} coaching on ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await api(page, { context: snapshot(assessed) });
      const panel = await open(page);
      const saved = panel.getByRole('complementary');
      if (viewport.name === 'mobile')
        await panel.getByRole('button', { name: 'Your progress' }).click();
      await expect(saved.getByRole('heading', { name: 'Your progress' })).toBeVisible();
      await expect(saved.getByRole('heading', { name: 'Next step' })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(
          `coach-brief-${viewport.name}-${assessed ? 'assessed' : 'empty'}.png`
        ),
        fullPage: true,
      });
      if (assessed) {
        await expect(saved.getByText('60.0%', { exact: true })).toBeHidden();
        await saved.getByText('View score details', { exact: true }).click();
        await expect(saved.getByText('60.0%', { exact: true })).toBeVisible();
        await expect(saved.getByText('75.0%', { exact: true })).toBeVisible();
        await expect(saved.getByText('80.0%', { exact: true })).toBeVisible();
        await expect(saved.getByText('Your starting score before practice.')).toBeVisible();
        await expect(saved.getByText('Average across your scored practice sets.')).toBeVisible();
        await expect(saved.getByText('Your score after completing practice.')).toBeVisible();
        await expect(saved.getByText('Continue with practice sets', { exact: true })).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`coach-scores-${viewport.name}.png`),
          fullPage: true,
        });
        const scoreToggle = saved.getByText('View score details', { exact: true });
        await scoreToggle.focus();
        await scoreToggle.press('Enter');
        await expect(saved.getByText('60.0%', { exact: true })).toBeHidden();
      } else {
        await expect(saved.locator('dl')).toHaveCount(0);
        await expect(saved.getByText('View score details', { exact: true })).toHaveCount(0);
        await expect(saved.getByText('No scores yet.', { exact: false })).toBeVisible();
        await expect(
          saved.getByText('Complete your confidence check', { exact: true })
        ).toBeVisible();
      }
      if (viewport.name === 'mobile')
        await panel.getByRole('button', { name: 'Your progress' }).click();
      await panel.getByRole('button', { name: 'Explain my progress' }).click();
      const conversation = panel.getByRole('log', { name: 'Coach conversation' });
      await expect(
        conversation.getByText(
          assessed ? 'Your baseline is 60%.' : 'You have no saved assessment results yet.',
          { exact: false }
        )
      ).toBeVisible();
      await page.getByRole('tab', { name: 'History', exact: true }).click();
      await page.getByRole('tab', { name: 'AI Coach', exact: true }).click();
      await expect(
        conversation.getByText(
          assessed ? 'Your baseline is 60%.' : 'You have no saved assessment results yet.',
          { exact: false }
        )
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.screenshot({
        path: testInfo.outputPath(`coach-${viewport.name}-${assessed ? 'assessed' : 'empty'}.png`),
        fullPage: true,
      });
      await panel.getByRole('button', { name: 'New conversation' }).click();
      await expect(panel.getByRole('button', { name: 'Explain my progress' })).toBeVisible();
      await expect(
        conversation.getByText(
          assessed ? 'Your baseline is 60%.' : 'You have no saved assessment results yet.',
          { exact: false }
        )
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}

for (const { width, height } of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 1000 },
  { width: 1024, height: 1000 },
  { width: 1100, height: 730 },
  { width: 1366, height: 768 },
  { width: 1440, height: 1000 },
  // The attached 1920px screenshot uses about 125% scaling with browser chrome.
  { width: 1536, height: 730 },
  { width: 1920, height: 920 },
]) {
  test(`coach starting workspace fits at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await api(page);
    const panel = await open(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(panel.getByRole('button', { name: 'Explain my progress' })).toBeEnabled();
    await expect(
      panel.getByRole('heading', { name: 'Make your next answer stronger.' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /Good .*Sam/ })).toBeHidden();
    const thread = panel.getByRole('log');
    // Every starter must fit in the initial conversation viewport.
    const lastStarter = await panel
      .getByRole('button', { name: 'Give me a practice drill' })
      .boundingBox();
    const threadBox = await thread.boundingBox();
    expect(lastStarter.y).toBeGreaterThanOrEqual(threadBox.y);
    expect(lastStarter.y + lastStarter.height).toBeLessThanOrEqual(
      threadBox.y + threadBox.height + 1
    );
    expect(
      await thread.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
    ).toBe(true);
    const headingFonts = await panel.locator('.db-ai-coach__welcome h3').evaluate((element) => ({
      actual: getComputedStyle(element).fontFamily,
      expected: getComputedStyle(element.closest('.db-root'))
        .getPropertyValue('--db-font-display')
        .trim(),
    }));
    expect(headingFonts.actual.replace(/["']/g, '')).toBe(
      headingFonts.expected.replace(/["']/g, '')
    );
    if (width > 1024) {
      const workspace = await panel.locator('.db-ai-coach__layout').boundingBox();
      expect(workspace.y + workspace.height).toBeLessThanOrEqual(height);
      expect(
        await page
          .locator('.db-main')
          .evaluate((element) => element.scrollHeight <= element.clientHeight + 1)
      ).toBe(true);
    }
    const input = panel.getByRole('textbox', { name: 'Ask your coach' });
    await input.focus();
    await input.fill('An answer with a second line');
    await input.press('Shift+Enter');
    await expect(input).toHaveValue('An answer with a second line\n');
    await input.fill('');
    await panel.getByText('How your data is used', { exact: true }).click();
    await expect(
      panel.getByText('An AI service processes your messages', { exact: false })
    ).toBeVisible();
    await panel.getByText('How your data is used', { exact: true }).click();
    if (width <= 900) {
      const toggle = panel.getByRole('button', { name: 'Your progress' });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.focus();
      await toggle.press('Enter');
      await panel.getByText('View score details', { exact: true }).click();
      await expect(
        panel.getByRole('complementary').getByText('60.0%', { exact: true })
      ).toBeVisible();
      await toggle.press('Enter');
      await expect(panel.getByRole('complementary')).toBeHidden();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`coach-welcome-${width}.png`),
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await input.fill('Explain my progress');
    await input.press('Enter');
    await expect(panel.getByText('Your baseline is 60%.', { exact: false })).toBeVisible();
    const messageEdges = await thread.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      const coach = element
        .querySelector('.db-ai-coach__message--assistant')
        .getBoundingClientRect();
      const user = element.querySelector('.db-ai-coach__message--user').getBoundingClientRect();
      return {
        coachLeft: coach.left,
        userRight: user.right,
        contentLeft: bounds.left + parseFloat(styles.paddingLeft),
        contentRight: bounds.left + element.clientWidth - parseFloat(styles.paddingRight),
        overflowing: element.scrollWidth > element.clientWidth,
      };
    });
    expect(Math.abs(messageEdges.coachLeft - messageEdges.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(messageEdges.userRight - messageEdges.contentRight)).toBeLessThanOrEqual(1);
    expect(messageEdges.overflowing).toBe(false);
    expect(
      await panel
        .locator('.db-ai-coach__message')
        .last()
        .evaluate((element) => getComputedStyle(element).animationName)
    ).toBe('none');
  });
}

test('long replies keep the composer separate and preserve the reader’s scroll position', async ({
  page,
}) => {
  let release;
  let count = 0;
  await api(page, {
    onChat: async (route) => {
      count += 1;
      if (count === 1)
        return route.fulfill({
          json: {
            context: snapshot(),
            reply: Array.from(
              { length: 30 },
              (_, i) =>
                `Practice point ${i + 1}: explain the approach, give a concrete example, and describe what you learned.`
            ).join('\n\n'),
          },
        });
      await new Promise((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        json: { context: snapshot(), reply: 'Your follow-up practice plan is ready.' },
      });
    },
  });
  const panel = await open(page);
  await panel.getByRole('button', { name: 'Explain my progress' }).click();
  const thread = panel.getByRole('log');
  await expect(thread.getByText('Practice point 30:', { exact: false })).toBeVisible();
  const input = panel.getByRole('textbox', { name: 'Ask your coach' });
  await input.fill('Help me with the first point.');
  await input.press('Enter');
  await expect(panel.getByRole('status')).toHaveText('Thinking through your question…');
  await thread.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(thread.getByText('Practice point 1:', { exact: false })).toBeInViewport();
  release();
  await expect(thread.getByText('Your follow-up practice plan is ready.')).toHaveCount(1);
  await expect(thread.getByText('Practice point 1:', { exact: false })).toBeInViewport();
  await expect(input).toBeInViewport();
});

test('pending reply blocks duplicate sends, allows drafting, refreshes metrics and sends no client progress', async ({
  page,
}) => {
  let release;
  let requests = 0;
  await api(page, {
    onChat: async (route) => {
      requests += 1;
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(['history', 'message']);
      await new Promise((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        json: {
          reply: 'Your newest practice average is 78%.',
          context: { ...snapshot(), practiceScore: 78 },
        },
      });
    },
  });
  const panel = await open(page);
  await panel.getByRole('button', { name: 'Explain my progress' }).click();
  await expect(panel.getByRole('status')).toHaveText('Thinking through your question…');
  const input = panel.getByRole('textbox', { name: 'Ask your coach' });
  await input.fill('My next question');
  await expect(panel.getByRole('button', { name: 'Send coach message' })).toBeDisabled();
  await input.press('Enter');
  expect(requests).toBe(1);
  release();
  await expect(panel.getByText('Your newest practice average is 78%.')).toBeVisible();
  await panel.getByRole('complementary').getByText('View score details', { exact: true }).click();
  await expect(panel.getByRole('complementary').getByText('78.0%', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('My next question');
  await expect(panel.getByRole('button', { name: 'Send coach message' })).toBeEnabled();
});

for (const [limit, message] of [
  [
    'window',
    'You have reached the 15-message coach limit for this 30-minute window. Please try again in 18 minutes.',
  ],
  ['daily', 'You have reached the 50-message daily coach limit. Please try again in 23 hours.'],
]) {
  test(`${limit} limit is a red alert and preserves the draft`, async ({ page }) => {
    await api(page, {
      onChat: (route) =>
        route.fulfill({ status: 429, json: { error: message, limit, retryAfterSeconds: 1080 } }),
    });
    const panel = await open(page);
    await panel.getByRole('button', { name: 'Explain my progress' }).click();
    const alert = panel.getByRole('alert');
    await expect(alert).toHaveText(message);
    await expect(alert).toHaveCSS('color', 'rgb(153, 27, 27)');
    await expect(panel.getByRole('textbox')).toHaveValue(
      'Explain my saved progress and what my metrics mean.'
    );
  });
}

test('progress outage cannot masquerade as an unassessed account and can be retried', async ({
  page,
}) => {
  let failed = true;
  await api(page, {
    onContext: (route) =>
      failed
        ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
        : route.fulfill({ json: { context: snapshot() } }),
  });
  const panel = await open(page);
  await expect(panel.getByRole('alert')).toContainText('Your saved progress couldn’t be loaded.');
  await expect(panel.getByRole('button', { name: 'Explain my progress' })).toBeDisabled();
  failed = false;
  await panel.getByRole('button', { name: 'Retry loading progress' }).click();
  await expect(panel.getByRole('button', { name: 'Explain my progress' })).toBeEnabled();
});

for (const width of [1536, 390]) {
  test(`coach displays safe search sources at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 730 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await api(page, {
      onChat: (route) =>
        route.fulfill({
          json: {
            reply:
              'Here is public salary context for junior backend roles in the Philippines.\n\nCompare the role requirements alongside the salary range. For your next practice session, prepare a concrete example of an API you built, the tradeoffs you considered, and how you tested it.',
            context: snapshot(),
            searchStatus: 'used',
            sources: [
              { title: 'Public salary report', url: 'https://example.org/careers' },
              { title: 'Unsafe link', url: 'javascript:alert(1)' },
              { title: 'Private host', url: 'https://localhost/internal' },
            ],
          },
        }),
    });
    const panel = await open(page);
    await panel
      .getByRole('textbox', { name: 'Ask your coach' })
      .fill('Check junior backend salaries in the Philippines.');
    await panel.getByRole('button', { name: 'Send coach message' }).click();
    const sources = panel.getByRole('navigation', { name: 'Sources for this reply' });
    await expect(sources.getByRole('link')).toHaveCount(1);
    const link = sources.getByRole('link', { name: 'Public salary report example.org' });
    await expect(link).toHaveAttribute('href', 'https://example.org/careers');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toBeVisible();
    await expect(panel.getByText('Live search couldn’t verify', { exact: false })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath(`coach-search-${width}.png`) });
  });
}

test('coach explains an attempted search outage without fabricated sources', async ({ page }) => {
  await api(page, {
    onChat: (route) =>
      route.fulfill({
        json: {
          reply:
            'I could not verify current salaries. We can still discuss general career guidance.',
          context: snapshot(),
          searchStatus: 'unavailable',
        },
      }),
  });
  const panel = await open(page);
  await panel.getByRole('button', { name: 'Explain my progress' }).click();
  await expect(
    panel.getByText('Live search couldn’t verify this answer. Treat current figures as unverified.')
  ).toBeVisible();
  await expect(panel.getByRole('navigation', { name: 'Sources for this reply' })).toHaveCount(0);
});
