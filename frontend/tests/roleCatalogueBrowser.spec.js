import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../backend/services/chatbotKnowledgeService');
const catalogue = [
  ...getRoleCatalogue(),
  { id: 'qa-test', label: 'QA Test Engineer', topics: ['Testing'] },
];
let server;
let baseURL;

test.beforeAll(async () => {
  // Test-only authentication module. No Firebase account, database, or AI calls.
  const authModule = '\0role-catalogue-test-auth';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'role-catalogue-test-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'firebase/auth' || id === '../firebase') return authModule;
        },
        load(id) {
          if (id !== authModule) return;
          return `
          const user = { uid: 'registry-browser-user', displayName: 'Test User', email: 'test@example.test' };
          export const auth = { currentUser: user };
          export function onAuthStateChanged(_auth, callback) {
            queueMicrotask(() => callback(user));
            return () => {};
          }
          export async function updateProfile(target, values) { Object.assign(target, values); }
          export async function signOut() {}
        `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__role-test__', async (req, res, next) => {
            try {
              const html = await vite.transformIndexHtml(
                '/__role-test__',
                '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/roleDashboard.jsx"></script></body></html>'
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

async function mockApi(
  page,
  {
    roles = catalogue,
    role = 'frontend',
    completed = true,
    active = {},
    catalogueHandler,
    saveStatus = 200,
    onSave = () => {},
  } = {}
) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (url.pathname === '/api/recommendations/roles') {
      if (catalogueHandler) return catalogueHandler(route);
      return json({ roles });
    }
    if (url.pathname === '/api/users/role') {
      onSave(route.request().postDataJSON());
      return json({ message: 'Test profile response' }, saveStatus);
    }
    if (url.pathname === '/api/users/results-summary') {
      return json({
        practiceHistory: [
          {
            role: 'qa-test',
            attemptNumber: 1,
            completedAt: '2026-09-01T12:00:00Z',
            overallScorePercentage: 80,
          },
        ],
        threeCBreakdown: { clarity: 4, correctness: 4, completeness: 4 },
        preTestScore: 80,
      });
    }
    if (url.pathname === '/api/users/active-practice-session') return json(active);
    if (url.pathname === '/api/users/registry-browser-user') {
      return json({
        user: { role, displayName: 'Test User', focusArea: 'auto', unlockedDifficulty: 'easy' },
        hasCompletedDiagnostic: completed,
      });
    }
    return json({ message: 'Unexpected test API request' }, 404);
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  for (const registeredRole of getRoleCatalogue().filter((role) =>
    ['qa-engineer', 'cyber-security', 'network-engineer', 'game-developer', 'ui-ux-developer', 'android', 'ios', 'devops', 'data-analyst', 'ai-engineer', 'it-support'].includes(role.id)
  )) {
    test(`registered ${registeredRole.label} role can be selected and saved on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      let saved;
      await mockApi(page, {
        role: registeredRole.id,
        onSave: (body) => {
          saved = body;
        },
      });
      await page.goto(`${baseURL}/__role-test__`);
      await expect(page.locator('#role-select')).toHaveValue(registeredRole.id);
      await expect(page.locator(`#role-select option[value="${registeredRole.id}"]`)).toHaveText(
        registeredRole.label
      );
      await page
        .getByRole('button', { name: 'Open profile settings' })
        .filter({ visible: true })
        .click();
      await expect(page.locator('#modal-role')).toHaveValue(registeredRole.id);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(saved.role).toBe(registeredRole.id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
    });
  }

  test(`dashboard and profile use server roles on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let saved;
    await mockApi(page, {
      onSave: (body) => {
        saved = body;
      },
    });
    await page.goto(`${baseURL}/__role-test__`);
    const select = page.locator('#role-select');
    await expect(select).toBeEnabled();
    await expect(select.locator('option')).toHaveText([
      'Select a role...',
      ...catalogue.map((role) => role.label),
    ]);
    await select.selectOption('qa-test');
    await page
      .getByRole('button', { name: 'Open profile settings' })
      .filter({ visible: true })
      .click();
    await expect(page.locator('#modal-role')).toHaveValue('qa-test');
    await expect(page.locator('#modal-role option')).toHaveText([
      'Select a role...',
      ...catalogue.map((role) => role.label),
    ]);
    await page.locator('#modal-role').selectOption('backend');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#role-select')).toHaveValue('backend');
    expect(saved.role).toBe('backend');
    await page.screenshot({
      path: `test-results/role-catalogue-${viewport.name}.png`,
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'QA Test Engineer', exact: true })
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  });
}

test('new-user dropdown waits for the catalogue before enabling setup', async ({ page }) => {
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  await mockApi(page, {
    role: '',
    completed: false,
    catalogueHandler: async (route) => {
      await wait;
      return route.fulfill({ json: { roles: catalogue } });
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toBeDisabled();
  await expect(page.locator('.db-onboarding__cta')).toBeDisabled();
  await expect(page.getByText('Loading target roles…', { exact: true })).toBeVisible();
  release();
  await expect(page.locator('#role-select')).toBeEnabled();
  await page.locator('#role-select').selectOption('qa-test');
  await expect(page.locator('.db-onboarding__cta')).toBeEnabled();
});

test('catalogue failure offers retry and restores the dropdown', async ({ page }) => {
  let attempts = 0;
  await mockApi(page, {
    catalogueHandler: (route) => {
      attempts++;
      return route.fulfill(
        attempts === 1 ? { status: 503, json: {} } : { json: { roles: catalogue } }
      );
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.getByRole('button', { name: 'Retry loading roles' })).toBeVisible();
  await expect(page.locator('#role-select')).toBeDisabled();
  await expect(page.locator('#btn-start-pretest')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry loading roles' }).click();
  await expect(page.locator('#role-select')).toBeEnabled();
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
  expect(attempts).toBe(2);
});

test('an unavailable saved role is preserved but cannot launch new practice', async ({ page }) => {
  await mockApi(page, { roles: catalogue.filter((role) => role.id !== 'frontend') });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toHaveValue('frontend');
  await expect(page.locator('#role-select option[value="frontend"]')).toBeDisabled();
  await expect(page.locator('#btn-start-pretest')).toBeDisabled();
  await expect(page.getByText(/Your saved target role is unavailable/)).toBeVisible();
  await page.locator('#role-select').selectOption('qa-test');
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
});

test('existing practice can resume during a catalogue outage without saving a role', async ({
  page,
}) => {
  let saves = 0;
  await mockApi(page, {
    active: {
      hasActiveSession: true,
      hasResumableSession: true,
      nextStage: 'mainsets',
      activeSet: 2,
      mode: 'practice',
    },
    catalogueHandler: (route) => route.fulfill({ status: 503, json: {} }),
    onSave: () => {
      saves++;
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
  await page.locator('#btn-start-pretest').click();
  await expect(page.getByTestId('test-location')).toContainText('/interview?set=2');
  expect(saves).toBe(0);
});

test('a rejected role save keeps onboarding on the dashboard', async ({ page }) => {
  await mockApi(page, { completed: false, active: { nextStage: 'likert-pre' }, saveStatus: 400 });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toBeEnabled();
  await page.locator('.db-onboarding__cta').click();
  await expect(page.getByText('Couldn’t save your target role. Please try again.')).toBeVisible();
  await expect(page.getByTestId('test-location')).toHaveText('/dashboard');
});

test('profile-only edits during an outage preserve the saved role', async ({ page }) => {
  let saved;
  await mockApi(page, {
    catalogueHandler: (route) => route.fulfill({ status: 503, json: {} }),
    onSave: (body) => {
      saved = body;
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.getByRole('button', { name: 'Retry loading roles' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Open profile settings' })
    .filter({ visible: true })
    .click();
  await expect(page.locator('#modal-role')).toBeDisabled();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Updated test name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saved.displayName).toBe('Updated test name');
  expect(saved).not.toHaveProperty('role');
  await expect(page.locator('#role-select')).toHaveValue('frontend');
});

for (const [currentTier, nextTier] of [
  ['easy', 'medium'],
  ['medium', 'hard'],
]) {
  test(`dashboard enables newly unlocked ${nextTier} on the first load`, async ({ page }) => {
    await mockApi(page);
    let tier = currentTier;
    let summaryRequests = 0;
    const profileTiers = [];
    let release;
    const summaryGate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/api/users/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/users/results-summary') {
        summaryRequests++;
        await summaryGate;
        // Simulate the backend persisting the upgrade before responding.
        tier = nextTier;
        return route.fulfill({
          json: {
            unlocked: true,
            unlockThreshold: 75,
            nextDifficulty: nextTier,
            preTestScore: 80,
            threeCBreakdown: { clarity: 4, correctness: 4, completeness: 4 },
          },
        });
      }
      if (pathname === '/api/users/registry-browser-user') {
        profileTiers.push(tier);
        return route.fulfill({
          json: {
            user: {
              role: 'frontend',
              displayName: 'Test User',
              focusArea: 'auto',
              unlockedDifficulty: tier,
            },
            hasCompletedDiagnostic: true,
          },
        });
      }
      return route.fallback();
    });
    await page.goto(`${baseURL}/__role-test__`);
    await expect.poll(() => summaryRequests).toBeGreaterThan(0);
    expect(profileTiers).toEqual([]);
    release();
    const difficulty = page.locator('#difficulty-select');
    await expect(difficulty).toBeEnabled();
    await expect(difficulty.locator(`option[value="${nextTier}"]`)).toBeEnabled();
    if (nextTier === 'medium')
      await expect(difficulty.locator('option[value="hard"]')).toBeDisabled();
    await difficulty.selectOption(nextTier);
    await expect(difficulty).toHaveValue(nextTier);
    expect(profileTiers.length).toBeGreaterThan(0);
    expect(profileTiers.every((value) => value === nextTier)).toBe(true);
  });
}
