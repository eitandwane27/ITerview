import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
let sequence = 0;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiHistory.jsx' }); });
test.afterAll(async () => { await preview?.close(); });
test.setTimeout(60_000);
const questions = [
  { id: 'react', role: 'frontend', set: 2, text: 'Explain React props.', tip: 'Show a small props example.' },
  { id: 'api', role: 'backend', set: 2, text: 'Explain REST APIs.', tip: 'Describe resources and HTTP methods.' },
  { id: 'api-errors', role: 'backend', set: 2, text: 'How do REST APIs handle errors?', tip: 'Discuss status codes.' },
  { id: 'team', role: 'backend', set: 3, text: 'Describe a team disagreement.', tip: 'Use a concrete example.' },
].map(question => ({ ...question, difficulty: 'easy', savedAt: '2026-10-20T08:00:00Z' }));
const dock = page => page.getByRole('complementary', { name: 'Nikki companion' });
function invoke(options = {}, name = 'operate_practice_again') {
  const id = `practice-action-${++sequence}`;
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: JSON.stringify(options) }] });
  return id;
}
async function result(id) {
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id), { timeout: 30_000 }).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
}
async function act(options, name) { return result(invoke(options, name)); }
async function connect(page, saved = questions) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/practice-again/questions**', route => route.fulfill({ json: { questions: saved } }));
  await page.goto(preview.baseURL);
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('LIVE');
}
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.testErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.testErrors).toEqual([]); });

for (const width of [1440, 768, 390]) {
  test(`Practice Again filters and shows the exact tip through real controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    const calls = [];
    page.on('request', req => { if (req.url().includes('/api/')) calls.push({ url: req.url(), method: req.method() }); });
    const sessions = preview.voiceAudit.sessions;
    expect(await act({ role: 'Backend Developer', search: 'REST', set: '2', question: 'Explain REST APIs.', action: 'show_tip' })).toMatchObject({ ok: true, outcome: 'tip_shown', context: { displayedQuestions: 2, filters: { role: 'Backend Developer', search: 'REST', set: 'Set 2' }, tipPanel: { contentVisible: true, question: { text: 'Explain REST APIs.' } } } });
    await expect(page.getByRole('searchbox')).toHaveValue('REST');
    await expect(page.getByRole('combobox', { name: 'Filter saved questions by role' })).toHaveValue('backend');
    await expect(page.locator('.pa-focus__tip')).toHaveText('Try this approachDescribe resources and HTTP methods.');
    await page.evaluate(() => {
      window.practiceTabClicks = 0;
      document.getElementById('tab-practice-again').addEventListener('click', () => window.practiceTabClicks++);
    });
    expect(await act({ action: 'next_question' })).toMatchObject({ ok: true, context: { tipPanel: { question: { text: 'How do REST APIs handle errors?' } } } });
    expect(await page.evaluate(() => window.practiceTabClicks)).toBe(0);
    expect(await act({ role: 'all', search: '', set: 'all' })).toMatchObject({ ok: true, context: { displayedQuestions: 4 } });
    expect(calls.filter(call => call.method !== 'GET')).toEqual([]);
    expect(calls.filter(call => call.url.includes('/practice-again/'))).toHaveLength(1);
    expect(preview.voiceAudit.sessions).toBe(sessions);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await page.screenshot({ path: `test-results/nikki-practice-actions-${width}.png` });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });

  test(`Practice Again opens and closes its native dialog with usable Nikki controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    expect(await act({ question: 'Explain React props.', action: 'open_practice' })).toMatchObject({ ok: true, outcome: 'dialog_opened' });
    await expect(page.locator('.pa-dialog .nikki-companion')).toBeVisible();
    await dock(page).getByRole('button', { name: 'Mute Nikki microphone' }).click();
    await expect(dock(page).getByRole('button', { name: 'Unmute Nikki microphone' })).toBeVisible();
    await dock(page).getByRole('button', { name: 'Unmute Nikki microphone' }).click();
    await page.screenshot({ path: `test-results/nikki-practice-dialog-${width}.png` });
    expect(await act({ action: 'close_dialog' })).toMatchObject({ ok: true, outcome: 'dialog_closed', context: { dialog: null } });
    await expect(page.locator('.pa-dialog')).toHaveCount(0);
    await expect(dock(page)).toBeVisible();
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });

  test(`Practice Again starts the requested saved question and releases audio at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    if (width !== 768) await page.emulateMedia({ reducedMotion: 'no-preference' });
    const writes = [];
    page.on('request', req => { if (req.url().includes('/api/') && req.method() !== 'GET') writes.push(req.url()); });
    await page.evaluate(() => {
      window.practiceModalPointer = false;
      new MutationObserver(records => {
        if (records.some(record => record.target.matches('.pa-dialog__action button[data-nikki-target]')) &&
            document.querySelector('.pa-dialog .nikki-cursor')) window.practiceModalPointer = true;
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-nikki-target'] });
    });
    const id = invoke({ role: 'backend', search: 'Explain REST', set: '2', question: 'Explain REST APIs.', action: 'start' });
    await expect(page.getByText('Interview destination', { exact: true })).toBeVisible({ timeout: 20_000 });
    expect(await result(id)).toMatchObject({ ok: true, outcome: 'interview_opened' });
    expect(await page.evaluate(() => window.practiceModalPointer)).toBe(true);
    const audit = await page.evaluate(() => window.handoffAudit);
    expect(audit).toMatchObject({ opened: 1, stopped: 1, path: '/interview' });
    expect(new URLSearchParams(audit.search).get('questionId')).toBe('api');
    expect(new URLSearchParams(audit.search).get('set')).toBe('2');
    expect(new URLSearchParams(audit.search).get('autostart')).toBe('true');
    expect(writes).toEqual([]);
    await expect(dock(page)).toHaveCount(0);
  });
}

test('ambiguous, missing and unknown-role requests never choose a question or start', async ({ page }) => {
  await connect(page);
  for (const options of [
    { question: 'REST APIs', action: 'start' }, { question: 'missing question', action: 'start' },
    { action: 'start' }, { role: 'Astronaut', search: 'new', question: 'props', action: 'start' },
  ]) expect(await act(options)).toMatchObject({ ok: false });
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('.pa-dialog')).toHaveCount(0);
  expect(await act({ question: 'Explain REST APIs.', action: 'open_practice' })).toMatchObject({ ok: true });
  expect(await act({ role: 'frontend' })).toMatchObject({ ok: false });
  expect(await act({ question: 'Explain React props.', action: 'start' })).toMatchObject({ ok: false });
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  expect(await act({ action: 'close_dialog' })).toMatchObject({ ok: true });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('duplicate question text is ambiguous and no-match filters are reported and recoverable', async ({ page }) => {
  await connect(page, [...questions, { ...questions[1], id: 'duplicate' }]);
  expect(await act({ question: 'Explain REST APIs.', action: 'start' })).toMatchObject({ ok: false, detail: expect.stringContaining('Several') });
  expect(await act({ search: 'not found', question: 'React', action: 'start' })).toMatchObject({ ok: false, context: { state: 'no_matches' } });
  expect(await act({ role: 'all', search: '', set: 'all' })).toMatchObject({ ok: true, context: { displayedQuestions: 5 } });
  await expect(page.locator('.pa-dialog')).toHaveCount(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const interruption of ['Stop', 'Escape', 'speech', 'manual', 'model']) {
  test(`Practice Again cancels remaining start clicks on ${interruption}`, async ({ page }) => {
    await connect(page);
    await act({}, 'open_practice_again');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const id = invoke({ question: 'Explain REST APIs.', action: 'start' });
    await expect(page.locator('.pa-row-practice[data-nikki-target]')).toBeVisible();
    if (interruption === 'Stop') await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
    if (interruption === 'Escape') await page.keyboard.press('Escape');
    if (interruption === 'speech') preview.voiceAudit.callbacks.onEvent({ type: 'UserStartedSpeaking' });
    if (interruption === 'manual') await page.getByRole('searchbox').fill('React');
    if (interruption === 'model') preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallCancelled', functions: [{ id }] });
    if (!['model'].includes(interruption)) expect(await result(id)).toMatchObject({ ok: false, cancelled: true });
    await expect(page.locator('.nikki-cursor')).toHaveCount(0);
    await expect(page.locator('.pa-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

test('start from an existing dialog is stoppable in the modal top layer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await connect(page);
  await act({ question: 'Explain React props.', action: 'open_practice' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const id = invoke({ action: 'start' });
  await expect(page.locator('.pa-dialog__action button[data-nikki-target]')).toBeVisible();
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await result(id)).toMatchObject({ ok: false, cancelled: true });
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  await expect(page.locator('.pa-dialog')).toBeVisible();
  await act({ action: 'close_dialog' });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const state of ['empty', 'error']) {
  test(`Practice Again refuses a start with ${state} data`, async ({ page }) => {
    await connect(page, []);
    if (state === 'error') await page.route('**/api/practice-again/questions**', route => route.fulfill({ status: 503, json: { error: 'Synthetic load error' } }));
    expect(await act({ question: 'React', action: 'start' })).toMatchObject({ ok: false, context: { state } });
    await expect(page.locator('.pa-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

test('Practice Again waits for loading, then uses the loaded library without a second fetch', async ({ page }) => {
  await connect(page);
  let release;
  let reads = 0;
  await page.route('**/api/practice-again/questions**', async route => {
    reads++;
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { questions } });
  });
  const id = invoke({ search: 'props', question: 'Explain React props.', action: 'show_tip' });
  await expect.poll(() => reads).toBe(1);
  expect(preview.voiceAudit.commands.some(command => command.id === id)).toBe(false);
  release();
  expect(await result(id)).toMatchObject({ ok: true, context: { displayedQuestions: 1, tipPanel: { question: { text: 'Explain React props.' } } } });
  expect(reads).toBe(1);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('updating and unrelated dialogs block automation; an existing practice dialog can start once', async ({ page }) => {
  await connect(page);
  await act({}, 'open_practice_again');
  let release;
  await page.route('**/api/practice-again/questions/react', async route => {
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { question: questions[0] } });
  });
  await page.getByRole('button', { name: 'Remove saved question: Explain React props.', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  expect(await act({ question: 'Explain REST APIs.', action: 'start' })).toMatchObject({ ok: false, context: { updating: true } });
  release();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.addStyleTag({ content: '.history-test-controls, .history-auth-controls { display:none; }' });
  await page.getByRole('button', { name: 'Open profile settings' }).click();
  expect(await act({ search: 'APIs' })).toMatchObject({ ok: false, detail: expect.stringContaining('Close the current dialog') });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await act({ question: 'Explain REST APIs.', action: 'open_practice' })).toMatchObject({ ok: true });
  const id = invoke({ action: 'start' });
  await expect(page.getByText('Interview destination', { exact: true })).toBeVisible();
  expect(await result(id)).toMatchObject({ ok: true, outcome: 'interview_opened' });
  expect(await page.evaluate(() => window.handoffAudit.stopped)).toBe(1);
});

test('question matching includes all rendered rows beyond the bounded awareness excerpt', async ({ page }) => {
  const saved = Array.from({ length: 24 }, (_, i) => ({ ...questions[0], id: `large-${i}`, text: `Explain component number ${i}.` }));
  saved.push({ ...questions[1], id: 'large-api' });
  await connect(page, saved);
  const output = await act({ question: 'Explain REST APIs.', action: 'show_tip' });
  expect(output).toMatchObject({ ok: true, context: { omittedDisplayedQuestions: 5, tipPanel: { question: { text: 'Explain REST APIs.' } } } });
  expect(output.context.questions).toHaveLength(20);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('long mobile tips scroll independently while the Stop control stays usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await connect(page, [{ ...questions[0], tip: 'Explain with a concrete example. '.repeat(100) }]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await act({ question: 'Explain React props.', action: 'open_practice' })).toMatchObject({ ok: true });
  const id = invoke({ action: 'start' });
  await expect(page.locator('.pa-dialog__action button[data-nikki-target]')).toBeVisible();
  const positions = await page.evaluate(() => ({
    button: document.querySelector('.pa-dialog__action button').getBoundingClientRect().toJSON(),
    dock: document.querySelector('.nikki-companion').getBoundingClientRect().toJSON(),
    dialog: document.querySelector('.pa-dialog').getBoundingClientRect().toJSON(),
  }));
  expect(positions.button.top).toBeGreaterThanOrEqual(positions.dialog.top);
  expect(positions.button.bottom).toBeLessThan(positions.dock.top);
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await result(id)).toMatchObject({ ok: false, cancelled: true });
  await page.screenshot({ path: 'test-results/nikki-practice-long-tip.png' });
  await act({ action: 'close_dialog' });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const width of [1440, 390]) {
  test(`leaving a practice review closes the dialog before navigating at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    await act({ question: 'Explain React props.', action: 'open_practice' });
    expect(await act({}, 'open_my_progress')).toMatchObject({ ok: true, displayed: 'my_progress' });
    await expect(page.locator('.pa-dialog')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'My Progress', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}
