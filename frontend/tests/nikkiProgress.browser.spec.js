import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
let sequence = 0;
let browserErrors;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiHistory.jsx' }); });
test.afterAll(async () => { await preview?.close(); });
test.beforeEach(({ page }) => { browserErrors = []; page.on('pageerror', error => browserErrors.push(error.message)); });
test.afterEach(() => { expect(browserErrors).toEqual([]); });
test.setTimeout(45_000);

async function call(name = 'read_current_page') {
  const id = `progress-awareness-${++sequence}`;
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: '{}' }] });
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id)).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
}
const read = async () => (await call()).context;
const panel = page => page.locator('#tabpanel-my-progress');
const dock = page => page.getByRole('complementary', { name: 'Nikki companion' });
async function connect(page, suffix = '') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(preview.baseURL + suffix);
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Voice session is live' })).toContainText('LIVE');
}
async function open(page) {
  const result = await call('open_my_progress');
  expect(result).toMatchObject({ ok: true, displayed: 'my_progress', context: { page: 'my_progress' } });
  await expect(panel(page)).toBeVisible();
  return result.context;
}
function comparison(overrides = {}) {
  return { preTestScore: 60, masteryScore: 80, postConfidenceScore: 22,
    threeCBreakdown: { clarity: 1, correctness: 2, completeness: 1 },
    postWeaknessTag: 'completeness', preWeaknessTag: 'clarity',
    questionBreakdowns: { postTest: { questions: [
      { metrics: { clarity: 4, correctness: 3, completeness: 5 }, answer: 'private-answer' },
      { metrics: { clarity: 5, correctness: 3, completeness: 4 } },
    ] } },
    practiceHistory: [{ attemptNumber: 1, role: 'frontend', overallScorePercentage: 70 }, { attemptNumber: 2, role: 'backend', overallScorePercentage: 90 }],
    email: 'private-email', ...overrides };
}

for (const width of [1440, 768, 390]) {
  test(`My Progress awareness matches the complete displayed comparison at ${width}px without extra fetches`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/users/results-summary?**', route => route.fulfill({ json: comparison() }));
    const requests = [];
    page.on('request', request => { if (request.url().includes('/api/')) requests.push({ method: request.method(), url: request.url() }); });
    await connect(page);
    const sessions = preview.voiceAudit.sessions;
    await open(page);
    await expect(panel(page).getByRole('heading', { name: 'Your progress at a glance' })).toBeVisible();
    const before = requests.length;
    const current = await read();
    expect(current).toMatchObject({ page: 'my_progress', state: 'ready', view: 'comparison',
      journey: { startingScore: '3.0 / 5.0', progressCheckScore: '4.0 / 5.0', changeLabel: '+1 point', changeUnit: 'points_out_of_five' },
      metrics: { clarity: '4.5 / 5.0', correctness: '3.0 / 5.0', completeness: '4.5 / 5.0' },
      average: '4.0 / 5.0', lowestMetric: 'correctness', weakTopic: 'Completeness', sessionsCount: 2 });
    expect(current.journey.startingScore).toBe(await panel(page).locator('.db-progression__baseline').innerText());
    expect(current.journey.progressCheckScore).toBe(await panel(page).locator('.db-progression__mastery').innerText());
    expect(current.journey.changeLabel).toBe(await panel(page).locator('.db-delta-pill__text').innerText());
    for (const metric of ['clarity', 'correctness', 'completeness']) {
      expect(current.metrics[metric]).toBe(await panel(page).locator(`.db-3c-cell__score--${metric}`).innerText());
    }
    expect(current.average).toBe(await panel(page).locator('.db-stat-card__value').nth(0).innerText());
    expect(String(current.sessionsCount)).toBe(await panel(page).locator('.db-stat-card__value').nth(1).innerText());
    expect(current.weakTopic).toBe(await panel(page).locator('.db-stat-card__value').nth(2).innerText());
    expect(current.controls.details).toContain('separate results page');
    expect(JSON.stringify(current)).not.toMatch(/private-|email|transcript|overallScorePercentage/);
    expect(JSON.stringify(current).length).toBeLessThan(8000);
    await read();
    expect(requests.length).toBe(before);
    expect(requests.every(request => request.method === 'GET')).toBe(true);
    expect(preview.voiceAudit.sessions).toBe(sessions);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await page.screenshot({ path: `test-results/nikki-progress-${width}.png`, fullPage: true });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

test('My Progress follows Score details expansion and collapse without leaking a hidden starting score', async ({ page }) => {
  await connect(page);
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Your starting point is saved' })).toBeVisible();
  let current = await read();
  expect(current).toMatchObject({ state: 'ready', view: 'starting_point', scoreDetails: { expanded: false } });
  expect(current.journey).toBeUndefined();
  expect(current.metrics).toBeUndefined();
  expect(current.sessionsCount).toBeUndefined();
  expect(JSON.stringify(current)).not.toContain('3.0');
  expect(current.guidance).toBe(await panel(page).locator('.db-assessment-guidance > p').innerText());
  await panel(page).locator('.starting-score-details summary').click();
  current = await read();
  expect(current.scoreDetails).toMatchObject({ expanded: true, label: 'Starting check (pre-test)', score: '3.0 / 5.0' });
  expect(current.scoreDetails.score).toBe((await panel(page).locator('.starting-score-details-value').innerText()).replace(/\s+/g, ' '));
  await panel(page).locator('.starting-score-details summary').click();
  expect((await read()).scoreDetails).toEqual({ expanded: false });
  await panel(page).getByRole('button', { name: 'Continue practice', exact: true }).click();
  expect((await read()).page).toBe('interview_prep');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('pending final confidence check does not reveal the hidden comparison or final score', async ({ page }) => {
  await page.route('**/api/users/results-summary?**', route => route.fulfill({ json: comparison({ postConfidenceScore: null }) }));
  await connect(page);
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Your progress check is saved' })).toBeVisible();
  const current = await read();
  expect(current).toMatchObject({ state: 'ready', view: 'reflection_pending', scoreDetails: { expanded: false } });
  expect(current.guidance).toBe(await panel(page).locator('.db-assessment-guidance > p').innerText());
  expect(current.controls.primary).toContain('Finish confidence check');
  expect(current.journey).toBeUndefined();
  expect(current.metrics).toBeUndefined();
  expect(JSON.stringify(current)).not.toMatch(/4\.0|3\.0|private-/);
  await expect(panel(page).getByRole('button', { name: 'Finish confidence check' })).toBeVisible();
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('empty progress explains the displayed 3C preview and never supplies stale assessment numbers', async ({ page }) => {
  await page.route('**/api/users/results-summary?**', route => route.fulfill({ json: comparison() }));
  await connect(page, '?fresh=1');
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Find your starting point' })).toBeVisible();
  const current = await read();
  expect(current).toMatchObject({ state: 'empty', title: 'Find your starting point', badge: 'Starting check next' });
  expect(current.message).toBe((await panel(page).locator('.db-progress-empty-hero__sub').innerText()).replace(/\s+/g, ' '));
  expect(current.preview.metrics.map(metric => metric.status)).toEqual(['Pending', 'Pending', 'Pending']);
  expect(current.preview.metrics.map(metric => metric.description)).toEqual(await panel(page).locator('.db-3c-cell__preview-desc').allInnerTexts());
  expect(current.journey).toBeUndefined();
  expect(current.metrics).toBeUndefined();
  expect(JSON.stringify(current)).not.toMatch(/3\.0|4\.0|private-/);
  await panel(page).getByRole('button', { name: 'Go to Interview Prep' }).click();
  expect((await read()).page).toBe('interview_prep');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('progress awareness reports loading then follows the loaded state without a new voice session', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/users/results-summary?**', async route => { await held; await route.fulfill({ json: comparison() }); });
  await connect(page);
  try {
    const current = await open(page);
    expect(current).toMatchObject({ state: 'loading' });
    expect(current.journey).toBeUndefined();
    await expect(panel(page).getByRole('status', { name: 'Loading dashboard metrics...' })).toBeVisible();
    expect((await read()).state).toBe('loading');
  } finally { release(); }
  await expect(panel(page).getByRole('heading', { name: 'Your progress at a glance' })).toBeVisible();
  expect((await read()).view).toBe('comparison');
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('progress errors and Retry clear stale content and publish the recovered comparison', async ({ page }) => {
  let attempts = 0;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/users/results-summary?**', async route => {
    attempts += 1;
    if (attempts > 1) await held;
    await route.fulfill(attempts === 1 ? { status: 503, json: { error: 'Synthetic unavailable data' } } : { json: comparison() });
  });
  await connect(page);
  await open(page);
  await expect(panel(page).getByRole('heading', { name: "Couldn't load your dashboard" })).toBeVisible();
  const error = await read();
  expect(error).toMatchObject({ state: 'error', title: "Couldn't load your dashboard" });
  expect(error.message).toBe(await panel(page).locator('.db-metrics-card__sub').innerText());
  expect(error.journey).toBeUndefined();
  expect(error.controls.retry).toContain('Retry');
  await panel(page).getByRole('button', { name: 'Retry', exact: true }).click();
  try { expect((await read()).state).toBe('loading'); } finally { release(); }
  await expect(panel(page).getByRole('heading', { name: 'Your progress at a glance' })).toBeVisible();
  expect((await read()).journey.progressCheckScore).toBe('4.0 / 5.0');
  expect(attempts).toBe(2);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const [masteryScore, changeLabel] of [[40, '-1 point'], [60, '0 points']]) {
  test(`progress comparison preserves ${changeLabel} and missing 3C values without calling them zero`, async ({ page }) => {
    await page.route('**/api/users/results-summary?**', route => route.fulfill({ json: comparison({ masteryScore,
      questionBreakdowns: { postTest: { questions: [{ metrics: { clarity: 4, correctness: null } }] } }, postWeaknessTag: null, preWeaknessTag: null }) }));
    await connect(page);
    await open(page);
    await expect(panel(page).getByRole('heading', { name: 'Your progress at a glance' })).toBeVisible();
    const current = await read();
    expect(current.journey.changeLabel).toBe(changeLabel);
    expect(current.journey.changeLabel).toBe(await panel(page).locator('.db-delta-pill__text').innerText());
    expect(current.metrics).toEqual({ clarity: '4.0 / 5.0', correctness: '--', completeness: '--' });
    expect(current.average).toBe('4.0 / 5.0');
    expect(current.weakTopic).toBe('--');
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

test('covered progress withholds scores and returns to its current content after dialogs close', async ({ page }) => {
  await page.route('**/api/users/results-summary?**', route => route.fulfill({ json: comparison() }));
  await connect(page);
  // Fixture-only buttons overlap the real sidebar's profile/sign-out controls.
  await page.addStyleTag({ content: '.history-test-controls, .history-auth-controls { display: none; }' });
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Your progress at a glance' })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile settings', exact: true }).click();
  expect(await read()).toEqual({ page: 'my_progress', state: 'covered', modal: 'profile' });
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await read()).view).toBe('comparison');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  expect(await read()).toEqual({ page: 'my_progress', state: 'covered', modal: 'sign_out' });
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await read()).view).toBe('comparison');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('progress context follows tab switches and clears on return while keeping Nikki connected', async ({ page }) => {
  await connect(page);
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Your starting point is saved' })).toBeVisible();
  await panel(page).locator('.starting-score-details summary').click();
  expect((await read()).scoreDetails.expanded).toBe(true);
  for (const [name, expected] of [['open_practice_history', 'practice_history'], ['open_interview_prep', 'interview_prep'], ['open_practice_again', 'practice_again']]) {
    await call(name);
    const current = await read();
    expect(current.page).toBe(expected);
    expect(current.scoreDetails).toBeUndefined();
  }
  await call('open_ai_coach');
  expect((await read()).state).toBe('unavailable');
  await open(page);
  await expect(panel(page).getByRole('heading', { name: 'Your starting point is saved' })).toBeVisible();
  expect((await read()).scoreDetails).toEqual({ expanded: false });
  await call('return_to_playground');
  expect((await read()).page).toBe('voice_agent_playground');
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
});
