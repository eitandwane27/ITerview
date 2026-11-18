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
    await chooseRole(page, role);
    await page.getByRole('button', { name: 'Technical Hard', exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    expect(request).toEqual({
      path: '/api/admin/hr-tester/generate-question-s2',
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
  await chooseRole(page, 'qa-test');
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
    plugins: [{
      name: 'hr-tester-admin-session',
      enforce: 'pre',
      resolveId(id) {
        if (id === './auth/SchoolAuthContext') return '\0hr-tester-admin-session';
      },
      load(id) {
        if (id !== '\0hr-tester-admin-session') return;
        return `
          import { createElement } from 'react';
          import { SchoolAuthContext } from '/src/auth/schoolAuth.js';
          const session = { status: 'admin', user: { getIdToken: async () => 'hr-admin-test-token' } };
          export function SchoolAuthProvider({ children }) {
            return createElement(SchoolAuthContext.Provider, { value: session }, children);
          }
        `;
      },
    }],
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
    if (url.pathname === '/api/admin/students') return route.fulfill({ json: { students: [] } });
    if (url.pathname.startsWith('/api/admin/hr-tester/')) {
      expect(route.request().headers().authorization).toBe('Bearer hr-admin-test-token');
      if (handler) return handler(route, url);
      return route.fulfill({ json: { params: Object.fromEntries(url.searchParams), results } });
    }
    return route.fulfill({ status: 404, json: { message: 'Unexpected API request' } });
  });
}

async function chooseRole(page, value) {
  await page.getByRole('combobox', { name: 'Target role' }).click();
  await page.getByRole('listbox', { name: 'Target role' }).locator(`[data-value="${value}"]`).click();
}

test('HR Tester opens from Admin and uses the shared Admin header', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${baseURL}/admin`);
  await page.getByRole('link', { name: 'HR Tester' }).click();
  await expect(page).toHaveURL(`${baseURL}/admin?tab=hr-tester`);
  await expect(page.getByRole('link', { name: 'HR Tester' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'HR Tester' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('H₀₄ keeps long responses, the rubric, and rating controls usable across questions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const responses = [0, 1, 2].map((questionIndex) => ({
    id: `response-${questionIndex}`, assessmentId: 'assessment', participantKey: 'participant', participantId: '0679',
    questionIndex, trialsSaved: 3, rated: false,
  }));
  const details = responses.map((response) => ({
    ...response, question: 'How do you stay up to date with changes in technology?',
    transcript: ('I read the release notes, follow members of developer communities, and try new tools on small projects.\n\n').repeat(16),
    trials: [2, 3, 2].map((clarity_score) => ({ clarity_score, correctness_score: 3, completeness_score: 4 })),
    rating: null, ratingRevision: 0,
  }));
  let rejectNextSave = true;
  await mockApi(page);
  await page.route('**/api/admin/scoring-study**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/').slice(4);
    if (!path.length) return route.fulfill({ json: { responses, trialCount: 3 } });
    const detail = details[Number(path[1])];
    if (path[2] === 'rating') {
      const payload = route.request().postDataJSON();
      const { id, scores, revision } = payload;
      expect(id).toBe(detail.id);
      expect(payload).not.toHaveProperty('raterCode');
      if (detail.questionIndex === 1 && rejectNextSave) {
        rejectNextSave = false;
        return route.fulfill({ status: 500, json: { message: 'Could not save this rating. Try again.' } });
      }
      if (route.request().method() === 'PATCH') {
        expect(revision).toBe(detail.ratingRevision);
        detail.ratingRevision += 1;
      }
      detail.rated = responses[detail.questionIndex].rated = true;
      detail.rating = scores;
    }
    return route.fulfill({ json: { response: { ...detail, trials: detail.rating ? detail.trials : [] } } });
  });

  await page.goto(`${baseURL}/admin`);
  await page.getByRole('link', { name: 'H₀₄ · HR ratings' }).click();
  await expect(page).toHaveURL(`${baseURL}/admin?tab=hr-ratings`);
  await page.getByRole('combobox', { name: 'Participant' }).click();
  await page.getByRole('option', { name: 'Participant 0679' }).click();
  const saveRating = page.getByRole('button', { name: 'Save HR rating' });
  const saveAndNext = page.getByRole('button', { name: 'Save & next' });
  const compareWithAi = page.getByRole('button', { name: 'Compare with AI' });
  const comparison = page.getByRole('table', { name: 'HR and AI average scores out of five' });
  const score = (criterion, value) => page.getByRole('radiogroup', { name: criterion }).getByRole('radio', { name: new RegExp(`^${value} ·`) });
  await saveRating.waitFor();
  await page.screenshot({ path: testInfo.outputPath('hr-ratings-desktop.png'), animations: 'disabled' });
  await expect(saveRating).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Export scores CSV' })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(compareWithAi).toHaveCount(0);
  expect(await page.locator('blockquote').evaluate((transcript) => transcript.scrollHeight > transcript.clientHeight)).toBe(true);

  const rubric = page.getByText('3C scoring rubric', { exact: true });
  await rubric.press('Enter');
  await expect(page.getByRole('heading', { name: 'What to score' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score levels' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scoring notes' })).toHaveCount(0);
  await expect(page.locator('.scoring-question')).toHaveCSS('animation-name', 'scoring-question-in');
  expect(await page.locator('.scoring-rubric').evaluate((rubric) => getComputedStyle(rubric, '::details-content').transitionDuration)).toContain('0.24s');
  await expect(saveRating).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1536, height: 730 });
  await page.screenshot({ path: testInfo.outputPath('hr-ratings-rubric.png'), animations: 'disabled', fullPage: true });
  await page.getByText('Fully meets', { exact: true }).scrollIntoViewIfNeeded();
  await expect(saveRating).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.setViewportSize({ width: 1280, height: 720 });
  await rubric.click();
  await expect(page.getByRole('heading', { name: 'Score levels' })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Rater code' })).toHaveCount(0);
  await score('Clarity', 3).check();
  await score('Clarity', 3).press('ArrowRight');
  await expect(score('Clarity', 4)).toBeChecked();
  await score('Correctness', 3).check();
  await saveRating.click();
  await expect(score('Completeness', 1)).toBeFocused();
  await score('Completeness', 5).check();
  await saveRating.click();
  const savedHeading = page.getByRole('heading', { name: 'Saved HR rating' });
  await expect(savedHeading).toBeFocused();
  expect(details[0].rating).toEqual({ clarity_score: 4, correctness_score: 3, completeness_score: 5 });
  await page.keyboard.press('Tab');
  await expect(compareWithAi).toBeFocused();
  await expect(compareWithAi).toHaveAttribute('aria-expanded', 'false');
  await expect(comparison).toBeHidden();
  await compareWithAi.press('Enter');
  await expect(compareWithAi).toHaveAttribute('aria-expanded', 'true');
  await expect(comparison.getByRole('row', { name: 'Clarity 4 2.3' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(1);
  await expect(page.getByText('Average of 3 saved AI trials.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('hr-compare-desktop.png'), animations: 'disabled', fullPage: true });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(comparison).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('hr-compare-tablet.png'), animations: 'disabled', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await comparison.scrollIntoViewIfNeeded();
  await expect(comparison).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('hr-compare-mobile.png'), animations: 'disabled', fullPage: true });
  await compareWithAi.click();
  await expect(comparison).toBeHidden();
  await page.getByRole('button', { name: 'Correct HR rating' }).click();
  await expect(compareWithAi).toHaveCount(0);
  await expect(score('Clarity', 4)).toBeChecked();
  await expect(score('Clarity', 4)).toBeFocused();
  await score('Clarity', 5).check();
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText(/Prior ratings are kept/)).toBeVisible();
  await expect(savedHeading).toBeFocused();
  await expect(compareWithAi).toHaveAttribute('aria-expanded', 'true');
  await expect(comparison.getByRole('row', { name: 'Clarity 5 2.3' })).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('hr-compare-after-correction.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByRole('heading', { name: 'Question 2' })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Saved response' })).toHaveText('Question 2 · To rate');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(compareWithAi).toHaveCount(0);
  await expect(saveAndNext).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => scrollY)).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('hr-ratings-mobile.png'), animations: 'disabled', fullPage: true });
  await expect(score('Clarity', 1)).toBeInViewport({ ratio: 1 });

  await score('Clarity', 4).check();
  await score('Correctness', 4).check();
  await score('Completeness', 5).check();
  await saveAndNext.click();
  await expect(page.getByRole('alert')).toHaveText('Could not save this rating. Try again.');
  await expect(page.getByRole('heading', { name: 'Question 2' })).toBeVisible();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(3);
  await saveAndNext.click();
  await expect(page.getByRole('heading', { name: 'Question 3' })).toBeFocused();
  expect(details[1].rating).toEqual({ clarity_score: 4, correctness_score: 4, completeness_score: 5 });
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(saveRating).toBeVisible();
  await expect(saveAndNext).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.scoring-question')).toHaveCSS('animation-name', 'none');
  await rubric.press('Enter');
  await expect(page.getByRole('heading', { name: 'Score levels' })).toBeVisible();
  expect(await page.locator('.scoring-rubric').evaluate((rubric) => getComputedStyle(rubric, '::details-content').transitionDuration)).toBe('0s');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(score('Clarity', 1)).toBeInViewport({ ratio: 1 });
  const ratingBottom = await page.locator('.scoring-rating').evaluate((rating) => rating.getBoundingClientRect().bottom);
  const rubricTop = await rubric.evaluate((summary) => summary.getBoundingClientRect().top);
  expect(rubricTop).toBeGreaterThan(ratingBottom);
  await page.screenshot({ path: testInfo.outputPath('hr-ratings-mobile-rubric.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await rubric.press('Enter');
  await expect(page.getByRole('heading', { name: 'Score levels' })).toBeHidden();

  await page.getByRole('link', { name: 'Scoring Study', exact: true }).click();
  await page.getByRole('combobox', { name: 'Participant' }).click();
  await page.getByRole('option', { name: 'Participant 0679' }).click();
  await expect(page.getByRole('table', { name: 'AI trials and HR scores out of five' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export scores CSV' })).toBeEnabled();
});

test('H₀₄ marks a participant completed only after all five responses are rated', async ({ page }, testInfo) => {
  const scores = { clarity_score: 4, correctness_score: 4, completeness_score: 4 };
  const responses = [5, 4].flatMap((count, index) => Array.from({ length: count }, (_, questionIndex) => ({
    id: `${index}-${questionIndex}`, assessmentId: `assessment-${index}`, participantKey: `participant-${index}`,
    participantId: index === 0 ? '0679' : '0680', questionIndex, trialsSaved: 0, rated: questionIndex < 4,
  })));
  await mockApi(page);
  await page.route('**/api/admin/scoring-study**', async (route) => {
    const [, , , , assessmentId, questionIndex] = new URL(route.request().url()).pathname.split('/');
    if (!assessmentId) return route.fulfill({ json: { responses, trialCount: 3 } });
    const item = responses.find((item) => item.assessmentId === assessmentId && item.questionIndex === Number(questionIndex));
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ id: item.id, scores });
      item.rated = true;
    }
    return route.fulfill({ json: { response: {
      ...item, question: 'What is a unit test?', transcript: 'It checks one small unit of code.',
      trials: [], rating: item.rated ? scores : null, ratingRevision: 0,
    } } });
  });

  await page.goto(`${baseURL}/admin?tab=hr-ratings`);
  const participants = page.getByRole('combobox', { name: 'Participant' });
  await participants.click();
  await expect(page.getByRole('option', { name: /Completed/ })).toHaveCount(0);
  await page.getByRole('option', { name: 'Participant 0679', exact: true }).click();
  await page.getByRole('combobox', { name: 'Saved response' }).click();
  await page.getByRole('option', { name: 'Question 5 · To rate' }).click();
  for (const criterion of ['Clarity', 'Correctness', 'Completeness']) {
    await page.getByRole('radiogroup', { name: criterion }).getByRole('radio', { name: /^4 ·/ }).check();
  }
  await page.getByRole('button', { name: 'Save HR rating' }).click();
  await expect(page.getByRole('heading', { name: 'Saved HR rating' })).toBeVisible();
  await expect(page.getByText('No AI scores are saved for this response yet.')).toBeVisible();
  await expect(page.getByText('Compare with AI', { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await participants.click();
  await expect(page.getByRole('option', { name: 'Participant 0679 Completed' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Participant 0680', exact: true })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Participant' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('hr-ratings-completed-dropdown.png'), animations: 'disabled' });
});

for (const viewport of [
  { name: 'desktop', width: 1586, height: 992 },
  { name: 'tablet', width: 800, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`route, generation and responsive layout on ${viewport.name}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.goto(`${baseURL}/hrTester`);
    await expect(page).toHaveURL(`${baseURL}/admin?tab=hr-tester`);
    await expect(page.getByLabel('Target role')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Copy all' })).toBeDisabled();
    await page.getByRole('button', { name: 'Personalized 3C Medium', exact: true }).click();
    await expect(page.locator('.hr-tester__question')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Regenerate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy all' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `test-results/hr-tester-${viewport.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test(`role menu fits the viewport and supports keyboard selection on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.route('**/api/recommendations/roles', (route) =>
      route.fulfill({ json: { roles: getRoleCatalogue() } })
    );
    await page.goto(`${baseURL}/admin?tab=hr-tester`);
    const trigger = page.getByRole('combobox', { name: 'Target role' });
    const menu = page.getByRole('listbox', { name: 'Target role' });
    const last = menu.getByRole('option').last();
    await trigger.press('ArrowDown');
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await expect(menu).toHaveCSS('scrollbar-color', 'rgb(148, 163, 184) rgba(0, 0, 0, 0)');

    const initialY = await page.evaluate(() => scrollY);
    const lastLabel = await last.textContent();
    await trigger.press('End');
    await expect(last).toBeInViewport({ ratio: 1 });
    expect(await menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(initialY);
    await trigger.press('Enter');
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveText(lastLabel);
    await expect(trigger).toBeFocused();

    await trigger.press('ArrowUp');
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await trigger.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
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
  await chooseRole(page, 'qa-test');
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
      path: '/api/admin/hr-tester/generate-question',
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
      path: '/api/admin/hr-tester/generate-question-s2',
      params: {
        difficulty: difficulty.toLowerCase(),
        runs: '5',
        role: 'qa-test',
      },
    });
  }
  await chooseRole(page, 'qa-test');
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  await expect(page.getByRole('group', { name: 'Behavioral difficulty' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Behavioral (Easy|Medium|Hard)$/ })).toHaveCount(
    0
  );
  await page.getByRole('button', { name: 'Generate behavioral questions', exact: true }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  expect(requests.at(-1)).toEqual({
    path: '/api/admin/hr-tester/generate-question-s3',
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
    if (attempt === 1) return route.fulfill({ status: 503, json: { message: 'Question service unavailable.' } });
    if (attempt === 2) return route.fulfill({ json: { results: [{ question: {}, error: '' }] } });
    if (attempt === 3)
      return route.fulfill({
        json: { results: [{ index: 1, question: null, error: 'Provider unavailable' }] },
      });
    return route.fulfill({ json: { results } });
  });
  await page.goto(`${baseURL}/hr-tester`);
  await page.getByRole('button', { name: 'Personalized 3C Easy', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Question service unavailable.');
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
    if (url.pathname === '/api/admin/hr-tester/generate-question') {
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
  await chooseRole(page, 'backend');
  await expect(page.locator('.hr-tester__question')).toHaveCount(0);
});

test('behavioral generation, retry and regeneration do not depend on the role service', async ({
  page,
}) => {
  let attempts = 0;
  await mockApi(page, (route, url) => {
    expect(url.pathname).toBe('/api/admin/hr-tester/generate-question-s3');
    expect(url.searchParams.has('role')).toBe(false);
    expect(url.searchParams.has('difficulty')).toBe(false);
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { message: 'Question service unavailable.' } })
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
  await expect(page.getByRole('alert')).toContainText('Question service unavailable.');
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
      path: '/api/admin/hr-tester/generate-question',
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
  await page.getByRole('button', { name: 'Generate behavioral questions' }).click();
  await expect(page.locator('.hr-tester__question')).toHaveCount(5);
  await page.getByRole('radio', { name: 'Clarity', exact: true }).check();
  await expect(page.locator('.hr-tester__metadata')).toContainText('Set 1 · Personalized 3C · Hard');
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
