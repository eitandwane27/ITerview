import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let vite, baseURL;
const summary = {
  preConfidenceScore: 14,
  postConfidenceScore: 21,
  preTestScore: 52,
  masteryScore: 92,
  targetDifficulty: 'easy',
  nextDifficulty: 'medium',
  unlockThreshold: 75,
  threeCBreakdown: { clarity: 2.1, correctness: 3.2, completeness: 2.4 },
  practiceProgress: {
    source: 'latest-completed-attempt',
    attemptNumber: 2,
    completedAllSets: true,
    completedSetCount: 3,
  },
  sessionAverages: { practiceSetsAverage: { scoreOutOf5: 4.5 } },
  setScores: {
    set1: { score: 4.4, completed: true },
    set2: { score: 4.5, completed: true },
    set3: { score: 4.6, completed: true },
  },
  questionBreakdowns: {
    preTest: { questions: [{ metrics: { clarity: 2.1, correctness: 3.2, completeness: 2.4 } }] },
    postTest: { questions: [{ metrics: { clarity: 4.7, correctness: 4.8, completeness: 4.3 } }] },
  },
};

test.beforeAll(async () => {
  const authModule = '\0results-test-auth';
  vite = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'results-test-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === '../firebase' || id === 'firebase/auth') return authModule;
        },
        load(id) {
          if (id === authModule)
            return `
          const user = { uid: 'results-browser', email: 'student@spcba.edu.ph', emailVerified: true,
            getIdToken: async () => 'results-token' };
          export const auth = { currentUser: user, authStateReady: async () => {} };
          export function onAuthStateChanged(_auth, callback) {
            let live = true;
            queueMicrotask(() => live && callback(user));
            return () => { live = false; };
          }
        `;
        },
        configureServer(server) {
          server.middlewares.use('/__results__', async (_req, res, next) => {
            try {
              res.setHeader('Content-Type', 'text/html');
              res.end(
                await server.transformIndexHtml(
                  '/__results__',
                  '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts/fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/results.jsx"></script></body></html>'
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
  await vite.listen();
  baseURL = `http://127.0.0.1:${vite.httpServer.address().port}/__results__`;
});

test.afterAll(async () => {
  await vite?.close();
});
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const attempt of [1, 2]) {
  test(`practice attempt ${attempt} clearly identifies the fixed starting scores`, async ({
    page,
  }) => {
    await page.route('**/api/users/results-summary?**', (route) =>
      route.fulfill({
        json: {
          ...summary,
          practiceProgress: { ...summary.practiceProgress, attemptNumber: attempt },
        },
      })
    );
    await page.goto(`${baseURL}?mode=practice`);
    const rubric = page.getByRole('region', { name: '3C Rubric Diagnostic Breakdown' });
    await expect(rubric.getByText('Locked baseline', { exact: true })).toBeVisible();
    await expect(rubric).toHaveAccessibleDescription(
      /first starting-check scores stay fixed as a baseline for testing the research group's hypotheses/
    );
    await expect(rubric.getByText('Starting focus', { exact: true })).toBeVisible();
    await expect(rubric.locator('.rs-rubric-num')).toHaveText(['2.1', '3.2', '2.4']);
    await expect(page.locator('.rs-set-score-text')).toHaveText([
      '4.4 / 5.0',
      '4.5 / 5.0',
      '4.6 / 5.0',
    ]);
    if (attempt === 2) {
      await page.evaluate(() => document.fonts.ready);
      await rubric.screenshot({ path: '../output/results-locked-desktop.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(rubric.getByText('Locked baseline', { exact: true })).toBeVisible();
      expect(await rubric.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await rubric.screenshot({
        path: '../output/results-locked-mobile.png',
        style: '.rs-topbar { visibility: hidden; }',
      });
    }
  });
}

test('progress-check results keep their own scores without a baseline lock', async ({ page }) => {
  await page.route('**/api/users/results-summary?**', (route) => route.fulfill({ json: summary }));
  await page.goto(baseURL);
  const rubric = page.getByRole('region', { name: '3C Rubric Diagnostic Breakdown' });
  await expect(rubric.getByRole('heading', { name: 'What makes a strong answer' })).toBeVisible();
  await expect(rubric.getByText('Locked baseline', { exact: true })).toHaveCount(0);
  await expect(rubric.locator('.rs-rubric-num')).toHaveText(['4.7', '4.8', '4.3']);
  await expect(page.locator('.rs-confidence-card .rs-stage-value')).toHaveText(['2.8 / 5.0', '4.2 / 5.0']);
  await expect(page.getByText('on the 1–5 scale')).toBeVisible();
});

test('confidence results compare four-point pairs and suppress a change across scales', async ({ page }) => {
  let preConfidenceScaleMax = 4;
  await page.route('**/api/users/results-summary?**', (route) =>
    route.fulfill({ json: { ...summary, preConfidenceScaleMax, postConfidenceScore: 20, postConfidenceScaleMax: 4 } })
  );
  await page.goto(baseURL);
  const confidence = page.locator('.rs-confidence-card');
  await expect(confidence.locator('.rs-stage-value')).toHaveText(['2.8 / 4.0', '4.0 / 4.0']);
  await expect(confidence.getByText('on the 1–4 scale')).toBeVisible();
  await expect(confidence.locator('.rs-delta-value')).toHaveText('+1.2');

  preConfidenceScaleMax = 5;
  await page.reload();
  await expect(confidence.locator('.rs-stage-value')).toHaveText(['2.8 / 5.0', '4.0 / 4.0']);
  await expect(confidence.getByText('Your confidence checks used different scales.')).toBeVisible();
  await expect(confidence.locator('.rs-delta-value')).toHaveText('Unavailable');
});
