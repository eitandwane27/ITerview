import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../backend/config/roleConfig');

const roles = [
  { id: 'frontend', label: 'Frontend Developer' },
  { id: 'backend', label: 'Backend Developer' },
  { id: 'qa-test', label: 'QA Test Engineer' },
];
// Synthetic responses: these tests never call an AI provider or create interview sessions.
const questions = [
  'Explain the difference between a stack and a queue. When would you choose one over the other in a real-world application?',
  'How would you design a system to handle a large number of concurrent users? What key components and trade-offs would you consider?',
  'Given a list of numbers, how would you find the two numbers that add up to a target value? Walk through your approach and analyze the time and space complexity.',
  'What are some common performance bottlenecks in a web application, and how would you identify and address them?',
  'How would you approach debugging a production issue that only happens intermittently? What steps would you take to find the root cause?',
];
const results = questions.map((question, index) => ({
  index: index + 1,
  question,
  latency_ms: 100,
  error: null,
}));

for (const role of ['qa-engineer', 'cyber-security', 'network-engineer', 'game-developer', 'ui-ux-developer', 'android', 'ios', 'devops', 'data-analyst', 'ai-engineer', 'it-support']) {
  test(`registered ${role} role uses the technical generator contract`, async ({ page }) => {
    let request;
    await mockApi(page, (route, url) => {
      request = { path: url.pathname, params: Object.fromEntries(url.searchParams) };
      return route.fulfill({ json: { results } });
    });
    await page.route('**/api/recommendations/roles', (route) =>
      route.fulfill({ json: { roles: getRoleCatalogue() } })
    );
    await page.goto(`${baseURL}/hr-tester`);
    await expect(page.getByLabel('Target role')).toBeEnabled();
    await page.getByLabel('Target role').selectOption(role);
    await page.getByRole('button', { name: 'Technical Hard', exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    expect(request).toEqual({
      path: '/api/debug/generate-question-s2',
      params: { difficulty: 'hard', runs: '5', role },
    });
  });
}

test('difficulty controls follow the catalogue capabilities', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/recommendations/roles', (route) =>
    route.fulfill({
      json: {
        roles: roles.map((role) => ({
          ...role,
          supportedDifficulties: {
            set1: ['easy', 'medium', 'hard'],
            set2: ['easy'],
            set3: ['easy'],
          },
        })),
      },
    })
  );
  await page.goto(`${baseURL}/hr-tester`);
  await expect(page.getByLabel('Target role')).toBeEnabled();
  await page.getByLabel('Target role').selectOption('qa-test');
  await expect(page.getByRole('button', { name: 'Technical Easy', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Technical Medium', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Technical Hard', exact: true })).toBeDisabled();
});
let server;
let baseURL;

test.beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});

test.afterAll(async () => {
  await server?.close();
});

async function mockApi(page, handler) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/recommendations/roles') return route.fulfill({ json: { roles } });
    if (url.pathname.startsWith('/api/debug/')) {
      if (handler) return handler(route, url);
      return route.fulfill({ json: { params: Object.fromEntries(url.searchParams), results } });
    }
    return route.fulfill({ status: 404, json: { message: 'Unexpected API request' } });
  });
}

for (const viewport of [
  { name: 'desktop', width: 1586, height: 992 },
  { name: 'tablet', width: 800, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`route, generation and responsive layout on ${viewport.name}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.goto(`${baseURL}/hrTester`);
    await expect(page).toHaveURL(`${baseURL}/hr-tester`);
    await expect(page.getByLabel('Target role')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Copy all' })).toBeDisabled();
    await page.getByRole('button', { name: 'Personalized 3C Medium', exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy all' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: `test-results/hr-tester-${viewport.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('all set and difficulty choices use their REST contracts and server roles', async ({
  page,
}) => {
  const requests = [];
  await mockApi(page, async (route, url) => {
    requests.push({ path: url.pathname, params: Object.fromEntries(url.searchParams) });
    return route.fulfill({ json: { params: Object.fromEntries(url.searchParams), results } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await expect(page.getByLabel('Target role')).toBeEnabled();
  await page.getByLabel('Target role').selectOption('qa-test');
  await expect(page.locator('.hr-tester__set-heading h3')).toHaveText([
    'Personalized 3C',
    'Technical',
    'Behavioral',
  ]);
  await page.getByRole('radio', { name: 'Clarity', exact: true }).check();
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    await page.getByRole('button', { name: `Personalized 3C ${difficulty}`, exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    expect(requests.at(-1)).toEqual({
      path: '/api/debug/generate-question',
      params: {
        difficulty: difficulty.toLowerCase(),
        runs: '5',
        role: 'qa-test',
        weakness: 'focus_clarity',
      },
    });
  }
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    await page.getByRole('button', { name: `Technical ${difficulty}`, exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    expect(requests.at(-1)).toEqual({
      path: '/api/debug/generate-question-s2',
      params: {
        difficulty: difficulty.toLowerCase(),
        runs: '5',
        role: 'qa-test',
      },
    });
  }
  await expect(page.getByRole('group', { name: 'Behavioral difficulty' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Behavioral (Easy|Medium|Hard)$/ })).toHaveCount(
    0
  );
  await page.getByRole('button', { name: 'Generate behavioral questions', exact: true }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests.at(-1)).toEqual({
    path: '/api/debug/generate-question-s3',
    params: {
      runs: '5',
      startIndex: '0',
    },
  });
  await expect(page.getByText('Behavioral questions apply to all roles.')).toBeVisible();
  await expect(page.locator('.hr-tester__metadata')).toContainText('Set 3 · Behavioral');
  await expect(page.locator('.hr-tester__metadata')).not.toContainText(/Easy|Medium|Hard/);
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests).toHaveLength(8);
});

test('partial failures preserve successful questions and copy only those questions', async ({
  page,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockApi(page, (route) =>
    route.fulfill({
      json: {
        results: [
          results[0],
          {
            index: 2,
            question: null,
            latency_ms: 10,
            error: 'Provider unavailable',
          },
        ],
      },
    })
  );
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1 question(s) could not be generated');
  await expect(page.locator('.hr-tester__question')).toHaveCount(2);
  await page.getByRole('button', { name: 'Copy all' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(questions[0]);
  expect(copied).not.toContain('Provider unavailable');
});

test('HTTP and malformed-response failures offer recovery; all failed questions disable copying', async ({
  page,
}) => {
  let attempt = 0;
  await mockApi(page, (route) => {
    attempt += 1;
    if (attempt === 1) return route.fulfill({ status: 503, json: {} });
    if (attempt === 2) return route.fulfill({ json: { results: [{ question: {}, error: '' }] } });
    if (attempt === 3)
      return route.fulfill({
        json: { results: [{ index: 1, question: null, error: 'Provider unavailable' }] },
      });
    return route.fulfill({ json: { results } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('alert')).toContainText('no usable questions');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Copy all' })).toBeDisabled();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
});

test('role catalogue failures prevent generation and can be retried', async ({ page }) => {
  await mockApi(page);
  let unavailable = true;
  await page.route('**/api/recommendations/roles', (route) => {
    return unavailable
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { roles } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await expect(
    page.getByRole('button', { name: 'Personalized 3C Easy', exact: true })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry roles' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry roles' }).click();
  await expect(page.getByLabel('Target role')).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Personalized 3C Easy', exact: true })
  ).toBeEnabled();
});

test('cancelled or replaced requests cannot overwrite the latest selection', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await mockApi(page, async (route, url) => {
    if (url.pathname === '/api/debug/generate-question') {
      await pending;
      await route.fulfill({ json: { results } }).catch(() => {});
    } else
      await route.fulfill({
        json: { results: [{ ...results[0], question: 'New technical question' }] },
      });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByText('Preparing your question set')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Generation cancelled')).toBeVisible();
  await page.getByRole('button', { name: 'Personalized 3C Medium', exact: true }).click();
  await expect(page.getByText('Preparing your question set')).toBeVisible();
  await page.getByRole('button', { name: 'Technical Hard', exact: true }).click();
  await expect(page.getByText('New technical question', { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Technical Hard', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.locator('.hr-tester__question')).toHaveCount(1);
  await page.getByLabel('Target role').selectOption('backend');
  await expect(page.locator('.hr-tester__question')).toHaveCount(0);
});

test('behavioral generation, retry and regeneration do not depend on the role service', async ({
  page,
}) => {
  let attempts = 0;
  await mockApi(page, (route, url) => {
    expect(url.pathname).toBe('/api/debug/generate-question-s3');
    expect(url.searchParams.has('role')).toBe(false);
    expect(url.searchParams.has('difficulty')).toBe(false);
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { results } });
  });
  await page.route('**/api/recommendations/roles', (route) =>
    route.fulfill({ status: 503, json: {} })
  );
  await page.goto(`${baseURL}/hr-tester`);
  await expect(page.getByRole('button', { name: 'Retry roles' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Personalized 3C Easy', exact: true })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Generate behavioral questions', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(attempts).toBe(3);
});

test('mobile generation reveals loading and questions with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await mockApi(page, async (route) => {
    await pending;
    return route.fulfill({ json: { results } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByText('Preparing your question set')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  release();
  await expect(page.locator('.hr-tester__question-text').first()).toBeInViewport();
});

test('3C controls target every weakness, support keyboard selection and keep copy context accurate', async ({
  page,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const requests = [];
  await mockApi(page, (route, url) => {
    requests.push({ path: url.pathname, params: Object.fromEntries(url.searchParams) });
    return route.fulfill({ json: { results } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await expect(page.getByLabel('Target role')).toBeEnabled();
  await expect(page.getByRole('radio', { name: 'Completeness', exact: true })).toBeChecked();
  for (const label of ['Clarity', 'Correctness', 'Completeness']) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    await expect(page.locator('.hr-tester__question')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy all' })).toBeDisabled();
    await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    expect(requests.at(-1)).toEqual({
      path: '/api/debug/generate-question',
      params: {
        difficulty: 'medium',
        runs: '5',
        role: 'frontend',
        weakness: `focus_${label.toLowerCase()}`,
      },
    });
    await expect(page.locator('.hr-tester__context')).toContainText(label);
    await page.getByRole('button', { name: 'Copy all' }).click();
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      `Set 1 · Personalized 3C · Medium · Frontend Developer · ${label}`
    );
  }
  await page.getByRole('button', { name: 'Technical Hard', exact: true }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests.at(-1).params).not.toHaveProperty('weakness');
  await page.getByRole('radio', { name: 'Completeness', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Correctness', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Correctness', exact: true })).toBeFocused();
  await expect(page.locator('.hr-tester__question')).toHaveCount(0);
  await expect(page.locator('.hr-tester__metadata')).toContainText(
    'Set 1 · Personalized 3C · Hard'
  );
  await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests.at(-1).params.weakness).toBe('focus_correctness');
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests.at(-1).params.weakness).toBe('focus_correctness');
});

test('changing the 3C focus cancels a pending question set and discards its response', async ({
  page,
}) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await mockApi(page, async (route, url) => {
    attempts += 1;
    if (attempts === 1) {
      expect(url.searchParams.get('weakness')).toBe('focus_completeness');
      await pending;
      await route.fulfill({ json: { results } }).catch(() => {});
      return;
    }
    expect(url.searchParams.get('weakness')).toBe('focus_clarity');
    return route.fulfill({
      json: { results: [{ ...results[0], question: 'Fresh clarity question' }] },
    });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByText('Preparing your question set')).toBeVisible();
  await page.getByRole('radio', { name: 'Clarity', exact: true }).check();
  await expect(page.getByText('Preparing your question set')).not.toBeVisible();
  await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
  await expect(page.getByText('Fresh clarity question', { exact: true })).toBeVisible();
  release();
  await expect(page.locator('.hr-tester__question')).toHaveCount(1);
  await expect(page.locator('.hr-tester__context')).toContainText('Clarity');
});
