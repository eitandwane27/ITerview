import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiHistory.jsx' }); });
test.afterAll(async () => { await preview?.close(); });
test.setTimeout(60_000);
async function connect(page, suffix = '') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(preview.baseURL + suffix);
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('LIVE');
}
function invoke(id, options, name = 'configure_interview_prep') {
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: JSON.stringify(options) }] });
}
async function result(id) {
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id), { timeout: 40_000 }).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
}
async function read(id) { invoke(id, {}, 'read_current_page'); return (await result(id)).context; }
const dock = page => page.getByRole('complementary', { name: 'Nikki companion' });

for (const width of [1440, 390]) {
  test(`follow-up Prep requests go straight to the requested control at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    invoke(`open-history-first-${width}`, {}, 'open_practice_history');
    expect(await result(`open-history-first-${width}`)).toMatchObject({ ok: true });
    await page.evaluate(() => {
      window.prepNavigationAudit = { clicks: [], targets: [] };
      document.addEventListener('click', event => {
        const control = event.target.closest('[role="tab"], [role="combobox"], [role="option"]');
        if (control) window.prepNavigationAudit.clicks.push(control.getAttribute('role') === 'option' ? control.dataset.value : control.id);
      }, true);
      new MutationObserver(records => records.forEach(record => {
        if (record.target.hasAttribute('data-nikki-target')) window.prepNavigationAudit.targets.push(record.target.getAttribute('role') === 'option' ? record.target.dataset.value : record.target.id);
      })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-nikki-target'] });
    });
    invoke(`set-role-first-${width}`, { role: 'backend' });
    expect(await result(`set-role-first-${width}`)).toMatchObject({ ok: true, context: { role: { value: 'backend' } } });
    expect(await page.evaluate(() => window.prepNavigationAudit.clicks)).toEqual(['tab-interview-prep', 'role-select', 'backend']);
    await page.evaluate(() => { window.prepNavigationAudit = { clicks: [], targets: [] }; });
    if (width === 1440) await page.emulateMedia({ reducedMotion: 'no-preference' });
    // A model may send an open call before its configure call, even on this tab.
    invoke(`already-open-prep-${width}`, {}, 'open_interview_prep');
    expect(await result(`already-open-prep-${width}`)).toMatchObject({ ok: true });
    invoke(`set-focus-next-${width}`, { focus: 'clarity' });
    expect(await result(`set-focus-next-${width}`)).toMatchObject({ ok: true, context: { role: { value: 'backend' }, focus: { value: 'clarity' } } });
    expect(await page.evaluate(() => window.prepNavigationAudit.clicks)).toEqual(['focus-select', 'clarity']);
    expect(await page.evaluate(() => window.prepNavigationAudit.targets)).toEqual(['focus-select', 'clarity']);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

for (const width of [1440, 390]) {
  test(`Interview Prep configures actual options at ${width}px without starting or extra reads`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await connect(page);
    const calls = [];
    page.on('request', req => { if (req.url().includes('/api/')) calls.push({ url: req.url(), method: req.method() }); });
    invoke(`config-${width}`, { role: 'Backend Developer', difficulty: 'easy', focus: 'completeness' });
    expect(await result(`config-${width}`)).toMatchObject({ ok: true, outcome: 'configured', context: { page: 'interview_prep', role: { value: 'backend' }, focus: { value: 'completeness' } } });
    await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'backend');
    await expect(page.locator('#focus-select')).toHaveAttribute('data-value', 'completeness');
    expect(calls.filter(call => call.method !== 'GET')).toEqual([]);
    expect((await read(`score-closed-${width}`)).startingScoreDetails.visible).toBe(false);
    await page.locator('.starting-score-details summary').click();
    expect((await read(`score-open-${width}`)).startingScoreDetails).toEqual({ visible: true, score: '3.0 / 5.0' });
    await page.locator('#difficulty-select').click();
    await expect(page.getByRole('option', { name: 'Hard · keep practicing to unlock' })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await page.screenshot({ path: `test-results/nikki-prep-${width}.png` });
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

test('Interview Prep prevalidates locked/unknown settings without changing role or discarding work', async ({ page }) => {
  await connect(page);
  invoke('locked-difficulty', { role: 'backend', difficulty: 'hard', action: 'start' });
  expect(await result('locked-difficulty')).toMatchObject({ ok: false, context: { role: { value: 'frontend' } } });
  invoke('unknown-role', { role: 'Astronaut', action: 'configure' });
  expect(await result('unknown-role')).toMatchObject({ ok: false });
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'frontend');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 1093, height: 614 },
  { width: 390, height: 568 },
  { width: 844, height: 390 },
]) {
test(`Interview Prep start prepares once and hands off the microphone at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  let prepared;
  let generations = 0;
  const writes = [];
  await page.route('**/api/users/role', async route => { writes.push(route.request().postDataJSON()); await route.fulfill({ json: { ok: true } }); });
  await page.routeWebSocket(/\/ws\/set1\?/, ws => {
    generations += 1;
    prepared = () => ws.send(JSON.stringify({ type: 'generation_complete' }));
    ws.send(JSON.stringify({ type: 'generation_progress', stage: 'generating_questions', current: 2, total: 5 }));
  });
  await connect(page);
  invoke(`before-start-history-${width}`, {}, 'open_practice_history');
  expect(await result(`before-start-history-${width}`)).toMatchObject({ ok: true });
  const expandedDock = await dock(page).boundingBox();
  invoke(`full-start-${width}`, { role: 'backend', difficulty: 'easy', focus: 'completeness', action: 'start' });
  await expect.poll(async () => generations || await dock(page).innerText(), { timeout: 15_000 }).toBe(1);
  const current = await read(`during-preparation-${width}`);
  expect(current.briefing).toMatchObject({ state: 'preparing', focus: 'completeness', questionCount: 5 });
  await expect(page.locator('.nikki-cursor')).toHaveAttribute('data-waiting', 'true');
  expect(preview.voiceAudit.commands.some(command => command.id === `full-start-${width}`)).toBe(false);
  await expect(dock(page).getByRole('status')).toContainText('Preparing interview…');
  await expect(dock(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await expect(dock(page).getByRole('button', { name: 'Mute Nikki microphone' })).toBeInViewport({ ratio: 1 });
  await expect(dock(page).getByRole('button', { name: 'Mute Nikki audio' })).toBeInViewport({ ratio: 1 });
  await expect(dock(page).getByRole('button', { name: 'End Nikki conversation' })).toBeInViewport({ ratio: 1 });
  const compactDock = await dock(page).boundingBox();
  const modal = await page.locator('.sb-modal').boundingBox();
  expect(compactDock.height).toBeLessThan(expandedDock.height);
  expect(compactDock.x + compactDock.width).toBeCloseTo(expandedDock.x + expandedDock.width);
  expect(compactDock.y + compactDock.height).toBeCloseTo(expandedDock.y + expandedDock.height);
  expect(modal.y).toBeGreaterThanOrEqual(0);
  expect(modal.y + modal.height).toBeLessThanOrEqual(compactDock.y - 16);
  await expect(page.locator('.sb-footer')).toBeInViewport({ ratio: 1 });
  if (width === 1440) {
    await expect(page.locator('.sb-metric-card').filter({ hasText: 'Completeness' })).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/nikki-prep-briefing-${width}.png` });
  if (width !== 1440) {
    const content = page.locator('.sb-content');
    await content.hover();
    await page.mouse.wheel(0, 500);
    await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('.sb-footer')).toBeInViewport({ ratio: 1 });
  }
  prepared();
  await expect(page.getByText('Interview destination', { exact: true })).toBeVisible();
  expect(await result(`full-start-${width}`)).toMatchObject({ ok: true, outcome: 'interview_opened' });
  expect(generations).toBe(1);
  expect(writes.every(value => value.role === 'backend' && value.difficulty === 'easy' && value.focusArea === 'completeness')).toBe(true);
  expect(await page.evaluate(() => window.handoffAudit)).toMatchObject({ opened: 1, stopped: 1, path: '/interview' });
});
}

test('spoken correction stops preparation and a subsequent configure request preserves the conversation', async ({ page }) => {
  let generations = 0;
  let prepared;
  await page.route('**/api/users/role', route => route.fulfill({ json: {} }));
  await page.routeWebSocket(/\/ws\/set1\?/, ws => { generations += 1; prepared = () => ws.send(JSON.stringify({ type: 'generation_complete' })); });
  await connect(page);
  invoke('interrupt-start', { action: 'start' });
  await expect.poll(async () => generations || await dock(page).innerText(), { timeout: 15_000 }).toBe(1);
  preview.voiceAudit.callbacks.onEvent({ type: 'UserStartedSpeaking' });
  expect(await result('interrupt-start')).toMatchObject({ ok: false, cancelled: true });
  await expect(page.locator('.nikki-cursor')).toHaveCount(0);
  prepared();
  await expect(page.getByText('Interview destination', { exact: true })).toHaveCount(0);
  // Cancel stops the preparation socket but does not erase saved work or close Nikki.
  const current = await read('after-interruption');
  expect(current.page).toBe('interview_prep');
  expect(current.briefing?.state).not.toBe('preparing');
  invoke('corrected-config', { role: 'backend' });
  expect(await result('corrected-config')).toMatchObject({ ok: true, outcome: 'configured' });
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('onboarding exposes its actual controls and starts only the required setup', async ({ page }) => {
  await connect(page, '?fresh=1');
  await page.route('**/api/users/active-practice-session?**', route => route.fulfill({ json: { nextStage: 'likert-pre' } }));
  await page.route('**/api/users/role', route => route.fulfill({ json: {} }));
  invoke('fresh-open', {}, 'open_interview_prep');
  expect(await result('fresh-open')).toMatchObject({ ok: true, context: { state: 'onboarding', difficulty: { visible: false }, focus: { visible: false } } });
  invoke('fresh-start', { role: 'backend', action: 'start' });
  await expect(page.getByText('Setup destination', { exact: true })).toBeVisible();
  expect(await result('fresh-start')).toMatchObject({ ok: true, outcome: 'setup_opened' });
  expect(await page.evaluate(() => window.handoffAudit)).toMatchObject({ stopped: 1, path: '/likert-pre' });
});

test('active session locks settings and resumes the saved set without a reset or preparation', async ({ page }) => {
  await page.route('**/api/users/active-practice-session?**', route => route.fulfill({ json: { hasActiveSession: true, hasResumableSession: true, activeSet: 2, answersCount: 2, nextStage: 'mainsets', mode: 'practice' } }));
  await connect(page);
  const mutations = [];
  page.on('request', req => { if (req.url().includes('/api/') && req.method() !== 'GET') mutations.push(req.url()); });
  invoke('active-change', { role: 'backend', action: 'start' });
  expect(await result('active-change')).toMatchObject({ ok: false, context: { session: { active: true, set: 2, nextQuestion: 3 } } });
  invoke('active-resume', { action: 'resume' });
  await expect(page.getByText('Interview destination', { exact: true })).toBeVisible();
  expect(await result('active-resume')).toMatchObject({ ok: true, outcome: 'interview_opened' });
  expect(mutations).toEqual([]);
  expect(await page.evaluate(() => window.handoffAudit.search)).toContain('set=2');
  expect(await page.evaluate(() => window.handoffAudit.search)).toContain('resume=true');
});

test('normal motion keeps a single cursor through dropdown clicks and Stop cancels remaining actions', async ({ page }) => {
  await connect(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    window.cursorAudit = { nodes: [], targets: [] };
    new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => { if (node instanceof Element && node.matches('.nikki-cursor')) window.cursorAudit.nodes.push(node); });
      if (record.type === 'attributes' && record.target.hasAttribute('data-nikki-target')) window.cursorAudit.targets.push(record.target.id || record.target.dataset.value);
    })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-nikki-target'] });
  });
  invoke('cursor-sequence', { role: 'backend', focus: 'completeness', action: 'start' });
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'backend', { timeout: 20_000 });
  expect(await page.evaluate(() => window.cursorAudit.nodes.length)).toBe(1);
  expect(await page.evaluate(() => window.cursorAudit.targets)).toEqual(expect.arrayContaining(['role-select', expect.stringContaining('backend')]));
  expect(await page.evaluate(() => window.cursorAudit.targets)).not.toContain('tab-interview-prep');
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await result('cursor-sequence')).toMatchObject({ ok: false, cancelled: true });
  await expect(page.locator('.nikki-cursor')).toHaveCount(0);
  await expect(page.locator('#focus-select')).toHaveAttribute('data-value', 'auto');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('failed question preparation stays visible, reports the error and never retries or enters', async ({ page }) => {
  let generations = 0;
  await page.routeWebSocket(/\/ws\/set1\?/, ws => {
    generations += 1;
    ws.send(JSON.stringify({ type: 'error', message: 'Synthetic preparation failure. Please try again.' }));
  });
  await page.route('**/api/users/role', route => route.fulfill({ json: {} }));
  await connect(page);
  invoke('generation-failure', { action: 'start' });
  expect(await result('generation-failure')).toMatchObject({ ok: false, context: { briefing: { state: 'error', errorMessage: 'Synthetic preparation failure. Please try again.' } } });
  await expect(page.getByRole('alert')).toContainText('Synthetic preparation failure');
  expect(generations).toBe(1);
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('Stop closes an automation-owned picker and the next corrected request can use it', async ({ page }) => {
  await connect(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  invoke('stop-open-picker', { role: 'backend' });
  await expect(page.locator('#role-select')).toHaveAttribute('aria-expanded', 'true', { timeout: 15_000 });
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await result('stop-open-picker')).toMatchObject({ ok: false, cancelled: true });
  await expect(page.locator('#role-select')).toHaveAttribute('aria-expanded', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  invoke('after-picker-stop', { role: 'backend' });
  expect(await result('after-picker-stop')).toMatchObject({ ok: true, context: { role: { value: 'backend' } } });
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('Stop aborts a pending journey lookup before it can navigate or save settings', async ({ page }) => {
  let checks = 0;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const writes = [];
  await page.route('**/api/users/active-practice-session?**', async route => {
    checks += 1;
    if (checks > 1) await held;
    await route.fulfill({ json: checks > 1 ? { nextStage: 'likert-pre' } : {} });
  });
  await page.route('**/api/users/role', async route => { writes.push(route.request().postDataJSON()); await route.fulfill({ json: {} }); });
  await connect(page);
  invoke('pending-lookup', { action: 'start' });
  await expect.poll(() => checks).toBe(2);
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await result('pending-lookup')).toMatchObject({ ok: false, cancelled: true });
  release();
  await expect(page.getByRole('tab', { name: 'Interview Prep', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('a newly detected saved session stops a fresh start instead of unexpectedly resuming it', async ({ page }) => {
  let checks = 0;
  await page.route('**/api/users/active-practice-session?**', async route => {
    checks += 1;
    await route.fulfill({ json: checks > 1 ? { hasActiveSession: true, hasResumableSession: true, activeSet: 2, answersCount: 1, nextStage: 'mainsets' } : {} });
  });
  await connect(page);
  invoke('new-saved-session', { action: 'start' });
  expect(await result('new-saved-session')).toMatchObject({ ok: false, context: { session: { active: true, set: 2 } } });
  await expect(page.getByText('Interview destination', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('shared setup pickers retain keyboard selection and leave locked difficulties unavailable', async ({ page }) => {
  await connect(page);
  invoke('keyboard-open', {}, 'open_interview_prep');
  expect(await result('keyboard-open')).toMatchObject({ ok: true });
  const focus = page.locator('#focus-select');
  await focus.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(focus).toHaveAttribute('data-value', 'star');
  const difficulty = page.locator('#difficulty-select');
  await difficulty.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(difficulty).toHaveAttribute('data-value', 'easy');
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});
