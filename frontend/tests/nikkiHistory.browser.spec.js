import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiHistory.jsx' }); });
test.afterAll(async () => { await preview?.close(); });

async function connect(page, suffix = '') {
  await page.route('**/api/practice-again/questions**', async route => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { questions: [{
      id: 'synthetic-saved-question', role: 'frontend', set: 2, difficulty: 'easy',
      text: 'Explain a React component.', tip: 'Describe props and show a small example.', savedAt: '2026-10-20T08:00:00Z',
    }] } });
  });
  await page.goto(preview.baseURL + suffix);
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('LIVE');
}
const request = page => page.getByRole('button', { name: 'Test history request', exact: true }).click();
const companion = page => page.getByRole('complementary', { name: 'Nikki companion' });
const returnRequest = (id = 'return-1') => preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
  id, name: 'return_to_playground', client_side: true, arguments: '{}',
}] });

async function readCurrentPage(id) {
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'read_current_page', client_side: true, arguments: '{}',
  }] });
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.type === 'FunctionCallResponse' && command.id === id)).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.type === 'FunctionCallResponse' && command.id === id).content).context;
}

async function openPracticeAgain(id) {
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name: 'open_practice_again', client_side: true, arguments: '{}',
  }] });
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id && JSON.parse(command.content).ok)).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
}

const savedQuestions = [
  { id: 'react', role: 'frontend', set: 2, difficulty: 'Easy', text: 'Explain React props.', tip: 'Describe props with an example.' },
  { id: 'team', role: 'frontend', set: 3, difficulty: 'Medium', text: 'Describe a team challenge.', tip: 'Use STAR and describe your own action.' },
  { id: 'backend', role: 'backend', set: 1, difficulty: 'Easy', text: 'Tell me about your backend experience.', tip: 'Connect your experience to the role.' },
].map((question, index) => ({ ...question, savedAt: `2026-10-${20 - index}T08:00:00Z` }));

test('Practice Again awareness follows search, role/set filters, focus, dialog, removal and Undo without operating controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await connect(page);
  const sessions = preview.voiceAudit.sessions;
  const calls = [];
  await page.route('**/api/practice-again/questions**', async route => {
    const method = route.request().method();
    calls.push(method);
    await route.fulfill({ json: method === 'GET' ? { questions: savedQuestions } : { question: savedQuestions[2] } });
  });
  const nav = await openPracticeAgain('practice-aware-open');
  expect(nav.context.page).toBe('practice_again');
  await expect(page.locator('.pa-question')).toHaveCount(3);
  let current = await readCurrentPage('practice-full-list');
  expect(current).toMatchObject({ totalQuestions: 3, displayedQuestions: 3, filteredOutQuestions: 0 });
  expect(current.questions.map(question => question.text)).toEqual(await page.locator('.pa-question__select').allInnerTexts());
  expect(current.tipPanel.question.tip).toBe(await page.locator('.pa-focus__tip p').innerText());
  expect(calls).toEqual(['GET']);
  await page.getByRole('button', { name: 'Show tip: Describe a team challenge.', exact: true }).click();
  current = await readCurrentPage('practice-selected-tip');
  expect(current.tipPanel.question.text).toBe(savedQuestions[1].text);
  expect(current.tipPanel.question.tip).toBe(savedQuestions[1].tip);
  await page.getByRole('button', { name: 'Try another question', exact: true }).click();
  expect((await readCurrentPage('practice-next-tip')).tipPanel.question.text).toBe(savedQuestions[2].text);
  await page.getByRole('combobox', { name: 'Filter saved questions by role' }).selectOption('frontend');
  await page.getByRole('button', { name: 'Set 3, 1 question', exact: true }).click();
  current = await readCurrentPage('practice-role-set');
  expect(current).toMatchObject({ totalQuestions: 3, displayedQuestions: 1, filteredOutQuestions: 2 });
  expect(current.filters).toMatchObject({ role: 'Frontend Developer', set: 'Set 3' });
  expect(current.filters.sets.map(item => item.count)).toEqual([2, 0, 1, 1]);
  expect(current.questions[0].text).toBe(savedQuestions[1].text);
  await page.getByRole('searchbox', { name: 'Find a saved question' }).fill('does not exist');
  await expect(page.getByRole('heading', { name: 'No matching questions', exact: true })).toBeVisible();
  current = await readCurrentPage('practice-no-matches');
  expect(current).toMatchObject({ state: 'no_matches', totalQuestions: 3, displayedQuestions: 0, filteredOutQuestions: 3, questions: [] });
  expect(current.tipPanel.question).toBeNull();
  expect(current.filters.search).toBe('does not exist');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  expect((await readCurrentPage('practice-cleared')).filters).toMatchObject({ role: 'All roles', set: 'All sets', search: '' });
  await page.getByRole('button', { name: 'Practice: Describe a team challenge.', exact: true }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  current = await readCurrentPage('practice-open-dialog');
  expect(current.dialog.text).toBe(await page.locator('#pa-dialog-question').innerText());
  expect(current.dialog.tip).toBe(await page.locator('.pa-dialog__coaching p').innerText());
  expect(current.tipPanel.question.text).toBe(savedQuestions[2].text);
  expect(current.controls.practice).toContain('Start practice in that dialog');
  expect(calls).toEqual(['GET']);
  await page.getByRole('button', { name: 'Close practice dialog', exact: true }).click();
  expect((await readCurrentPage('practice-dialog-closed')).dialog).toBeNull();
  await page.getByRole('combobox', { name: 'Filter saved questions by role' }).selectOption('backend');
  await page.getByRole('button', { name: `Remove saved question: ${savedQuestions[2].text}`, exact: true }).click();
  await expect(page.getByText('Question removed from your library.', { exact: true })).toBeVisible();
  current = await readCurrentPage('practice-removed');
  expect(current).toMatchObject({ state: 'no_matches', totalQuestions: 2, removalNoticeVisible: true, displayedQuestions: 0 });
  expect(current.filters.role).toBe('Backend Developer');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.pa-question')).toHaveCount(1);
  current = await readCurrentPage('practice-restored');
  expect(current).toMatchObject({ state: 'ready', totalQuestions: 3, removalNoticeVisible: false });
  expect(current.questions[0].text).toBe(savedQuestions[2].text);
  expect(calls).toEqual(['GET', 'DELETE', 'POST']);
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await expect(page.getByText('Interview destination', { exact: true })).toHaveCount(0);
  await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('Practice Again awareness respects collapsed mobile tips, resize, dialog and tab cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await connect(page);
  await openPracticeAgain('practice-mobile-open');
  let current = await readCurrentPage('practice-mobile-collapsed');
  expect(current.tipPanel).toMatchObject({ expanded: false, contentVisible: false, question: null });
  await expect(page.locator('.pa-focus__content')).toBeHidden();
  await page.getByRole('button', { name: 'Show tip: Explain a React component.', exact: true }).click();
  current = await readCurrentPage('practice-mobile-expanded');
  expect(current.tipPanel.contentVisible).toBe(true);
  expect(current.tipPanel.question.tip).toBe(await page.locator('.pa-focus__tip p').innerText());
  await page.getByRole('button', { name: 'A tip for your next try', exact: true }).click();
  expect((await readCurrentPage('practice-mobile-recollapsed')).tipPanel.question).toBeNull();
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await readCurrentPage('practice-resized-wide')).tipPanel.question.tip).toBe('Describe props and show a small example.');
  await page.setViewportSize({ width: 390, height: 900 });
  expect((await readCurrentPage('practice-resized-narrow')).tipPanel.question).toBeNull();
  await page.getByRole('button', { name: 'Practice: Explain a React component.', exact: true }).click();
  current = await readCurrentPage('practice-mobile-dialog');
  expect(current.tipPanel.question).toBeNull();
  expect(current.dialog.tip).toBe('Describe props and show a small example.');
  await page.keyboard.press('Escape');
  expect((await readCurrentPage('practice-mobile-dialog-dismissed')).dialog).toBeNull();
  await page.getByRole('tab', { name: 'AI Coach', exact: true }).click();
  expect((await readCurrentPage('practice-mobile-left')).state).toBe('unavailable');
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  expect((await readCurrentPage('practice-mobile-history')).page).toBe('practice_history');
  await companion(page).getByRole('button', { name: 'Return to Nikki' }).click();
  await expect(page.locator('.voice-agent-playground')).toBeVisible();
  expect((await readCurrentPage('practice-mobile-playground')).page).toBe('voice_agent_playground');
  await page.getByRole('button', { name: 'End session', exact: true }).click();
});

for (const state of ['empty', 'loading', 'error']) {
  test(`Practice Again awareness reports ${state} and follows load or retry recovery`, async ({ page }) => {
    await connect(page);
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let recovery = false;
    await page.route('**/api/practice-again/questions**', async route => {
      expect(route.request().method()).toBe('GET');
      if (state === 'loading' && !recovery) await pending;
      await route.fulfill({ status: state === 'error' && !recovery ? 500 : 200,
        json: state === 'error' && !recovery ? { error: 'Saved questions could not be loaded.' }
          : { questions: state === 'empty' ? [] : savedQuestions } });
    });
    try {
      await openPracticeAgain(`practice-state-${state}`);
      if (state === 'empty') await expect(page.getByRole('heading', { name: 'No saved questions yet', exact: true })).toBeVisible();
      if (state === 'error') await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
      const current = await readCurrentPage(`practice-read-${state}`);
      expect(current.page).toBe('practice_again');
      expect(current.state).toBe(state);
      expect(current.questions || []).toEqual([]);
      if (state !== 'empty') {
        recovery = true;
        release();
        if (state === 'error') await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.locator('.pa-question')).toHaveCount(3);
        expect((await readCurrentPage(`practice-recovered-${state}`)).state).toBe('ready');
      }
      await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    } finally { release(); }
  });
}

test('Practice Again marks omitted rows and truncated text while keeping the focused tip separate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await connect(page);
  const questions = Array.from({ length: 23 }, (_, i) => ({ ...savedQuestions[0], id: `large-${i}`, text: `Question ${i}: ${'q'.repeat(1100)}`, tip: 't'.repeat(2100) }));
  await page.route('**/api/practice-again/questions**', route => route.fulfill({ json: { questions } }));
  await openPracticeAgain('practice-large-open');
  await expect(page.locator('.pa-question')).toHaveCount(23);
  let current = await readCurrentPage('practice-large-list');
  expect(current).toMatchObject({ totalQuestions: 23, displayedQuestions: 23, omittedDisplayedQuestions: 3 });
  expect(current.questions).toHaveLength(20);
  expect(current.questions[0]).toMatchObject({ textTruncated: true });
  expect(current.questions[0].text.length).toBe(1000);
  await page.locator('.pa-question__select').last().click();
  current = await readCurrentPage('practice-large-focus');
  expect(current.tipPanel.question.text).toBe(questions[22].text.slice(0, 1000));
  expect(current.tipPanel.question.tip.length).toBe(2000);
  expect(current.tipPanel.question.tipTruncated).toBe(true);
  expect(JSON.stringify(current).length).toBeLessThan(64_000);
  await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

for (const width of [1440, 768, 390]) {
  test(`Practice Again Undo stays above Nikki at ${width}px even with long captions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await connect(page);
    // Synthetic fixture controls share the bottom edge at tablet widths.
    // Enable captions through the real control's keyboard activation.
    const captions = page.getByRole('button', { name: 'Show captions', exact: true });
    await captions.focus();
    await captions.press('Enter');
    await expect(page.getByRole('button', { name: 'Hide captions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.route('**/api/practice-again/questions**', route => route.fulfill({ json: route.request().method() === 'GET'
      ? { questions: [savedQuestions[0]] } : { question: savedQuestions[0] } }));
    await openPracticeAgain(`practice-undo-${width}`);
    await page.getByRole('button', { name: `Remove saved question: ${savedQuestions[0].text}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    preview.voiceAudit.callbacks.onEvent({ type: 'ConversationText', role: 'assistant', content: 'You can restore your last removed question with Undo. '.repeat(12) });
    await expect(page.locator('.nikki-companion__caption')).toContainText('You can restore your last removed question with Undo.');
    await expect.poll(async () => {
      const notice = await page.locator('.pa-undo').boundingBox();
      const dock = await companion(page).boundingBox();
      return notice && dock && notice.y + notice.height <= dock.y - 12;
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/nikki-practice-undo-${width}.png` });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.pa-question')).toHaveCount(1);
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    expect(await page.evaluate(() => document.body.style.getPropertyValue('--nikki-companion-clearance'))).toBe('');
  });
}

test('Practice Again reports an in-flight removal and its failure without inventing a successful removal', async ({ page }) => {
  await connect(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/practice-again/questions**', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: { questions: [savedQuestions[0]] } });
    else {
      await pending;
      await route.fulfill({ status: 500, json: { error: 'Could not remove this question. Please try again.' } });
    }
  });
  try {
    await openPracticeAgain('practice-removal-failure');
    const remove = page.getByRole('button', { name: `Remove saved question: ${savedQuestions[0].text}`, exact: true });
    await remove.click();
    await expect(remove).toBeDisabled();
    expect((await readCurrentPage('practice-removal-pending')).updating).toBe(true);
    release();
    await expect(page.getByRole('alert')).toHaveText('Could not remove this question. Please try again.');
    const current = await readCurrentPage('practice-removal-failed');
    expect(current).toMatchObject({ state: 'ready', totalQuestions: 1, updating: false, removalNoticeVisible: false,
      errorMessage: 'Could not remove this question. Please try again.' });
    expect(current.questions[0].text).toBe(savedQuestions[0].text);
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  } finally { release(); }
});

test('Practice Again starts only when the student presses Start practice and releases Nikki on handoff', async ({ page }) => {
  await connect(page);
  await openPracticeAgain('practice-manual-start');
  await page.getByRole('button', { name: 'Practice: Explain a React component.', exact: true }).click();
  expect((await readCurrentPage('practice-before-manual-start')).dialog.text).toBe('Explain a React component.');
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await expect(page.getByText('Interview destination', { exact: true })).toBeVisible();
  await expect(companion(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 1 });
});

for (const [label, tab, key, name, displayed] of [
  ['My Progress', 'my-progress', 'progress', 'open_my_progress', 'my_progress'],
  ['Practice Again', 'practice-again', 'practice-again', 'open_practice_again', 'practice_again'],
  ['AI Coach', 'ai-coach', 'ai-coach', 'open_ai_coach', 'ai_coach'],
]) {
  const tabRequest = id => preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
    id, name, client_side: true, arguments: '{}',
  }] });

  for (const width of [1440, 768, 390]) {
    test(`${label} opens through the existing cursor flow and returns with the same conversation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
      await connect(page);
      const sessions = preview.voiceAudit.sessions;
      const id = `${key}-${width}`;
      // Reduced motion can finish between Playwright polls. Record its brief
      // target/cursor state in the browser before issuing the tool request.
      if (width === 768) await page.evaluate(tabId => {
        window.navigationVisuals = { target: false, cursor: false };
        const observer = new MutationObserver(() => {
          if (document.getElementById(tabId)?.hasAttribute('data-nikki-target')) window.navigationVisuals.target = true;
          if (document.querySelector('.nikki-cursor')) window.navigationVisuals.cursor = true;
        });
        observer.observe(document.body, { attributes: true, childList: true, subtree: true });
      }, `tab-${tab}`);
      tabRequest(id);
      if (width === 768) await expect.poll(() => page.evaluate(() => window.navigationVisuals)).toEqual({ target: true, cursor: true });
      else {
        await expect(page.locator(`#tab-${tab}[data-nikki-target]`)).toBeVisible();
        await expect(page.locator('.nikki-cursor')).toBeVisible();
        expect(preview.voiceAudit.commands.some(command => command.id === id)).toBe(false);
      }
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(`#tabpanel-${tab}`)).toBeVisible();
      await expect(companion(page)).toContainText('Nikki is still here');
      await expect(page.locator('.va-workspace')).toHaveCount(0);
      await expect.poll(() => preview.voiceAudit.commands.filter(command => command.id === id).length).toBe(1);
      const result = JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
      expect(result).toMatchObject({ ok: true, displayed });
      if (displayed === 'practice_again' || displayed === 'my_progress') expect(result.context.page).toBe(displayed);
      else expect(result.context).toBeUndefined();
      await expect(page.getByText('Interview destination', { exact: true })).toHaveCount(0);
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      if (displayed === 'practice_again') await expect(page.getByRole('button', { name: 'Practice: Explain a React component.', exact: true })).toBeVisible();
      const current = await readCurrentPage(`read-${key}-${width}`);
      if (displayed === 'practice_again') {
        expect(current).toMatchObject({ page: 'practice_again', state: 'ready', totalQuestions: 1, displayedQuestions: 1 });
        expect(current.questions[0].text).toBe('Explain a React component.');
        expect(current.tipPanel.contentVisible).toBe(width > 1250);
        expect(current.tipPanel.question?.tip || null).toBe(width > 1250 ? 'Describe props and show a small example.' : null);
      } else if (displayed === 'my_progress') expect(current).toMatchObject({ page: 'my_progress', state: 'ready', view: 'starting_point', scoreDetails: { expanded: false } });
      else expect(current.state).toBe('unavailable');
      const bounds = await companion(page).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      returnRequest(`return-from-${key}-${width}`);
      await expect(page.locator('.voice-agent-playground')).toBeVisible();
      await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === `return-from-${key}-${width}` && JSON.parse(command.content).ok)).toBe(true);
      await expect(page.getByRole('status', { name: 'Voice session is live' })).toContainText('LIVE');
      expect(preview.voiceAudit.sessions).toBe(sessions);
      expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
      await page.getByRole('button', { name: 'End session', exact: true }).click();
    });
  }

  test(`switching History to ${label} clears History awareness and reopening either tab preserves the session`, async ({ page }) => {
    await connect(page);
    await request(page);
    await expect(companion(page)).toContainText('Nikki is still here');
    expect((await readCurrentPage(`history-before-${key}`)).page).toBe('practice_history');
    const sessions = preview.voiceAudit.sessions;
    tabRequest(`${key}-from-history`);
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(companion(page)).toContainText('Nikki is still here');
    await expect(page.locator('#tabpanel-history')).toBeHidden();
    const current = await readCurrentPage(`${key}-after-history`);
    if (displayed === 'practice_again' || displayed === 'my_progress') {
      expect(current.page).toBe(displayed);
      expect(current.sessions).toBeUndefined();
    } else expect(current.state).toBe('unavailable');
    tabRequest(`already-${key}`);
    await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === `already-${key}` && JSON.parse(command.content).ok)).toBe(true);
    await request(page);
    await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect((await readCurrentPage(`history-after-${key}`)).page).toBe('practice_history');
    expect(preview.voiceAudit.sessions).toBe(sessions);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });

  for (const stop of ['Stop', 'Escape', 'model cancellation']) {
    test(`${stop} cancels ${label} before its tab click without ending the conversation`, async ({ page }) => {
      await connect(page);
      tabRequest(`cancel-${key}`);
      await expect(page.locator(`#tab-${tab}[data-nikki-target]`)).toBeVisible();
      if (stop === 'Stop') await companion(page).getByRole('button', { name: 'Stop', exact: true }).click();
      else if (stop === 'Escape') await page.keyboard.press('Escape');
      else preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallCancelled', functions: [{ id: `cancel-${key}` }] });
      await expect(companion(page)).toContainText('You’re in control');
      await expect(page.locator('.nikki-cursor')).toHaveCount(0);
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'false');
      expect(preview.voiceAudit.commands.some(command => command.id === `cancel-${key}` && JSON.parse(command.content).ok)).toBe(false);
      expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
      await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    });
  }

  test(`an unavailable ${label} target reports failure and leaves the microphone connected`, async ({ page }) => {
    await connect(page);
    tabRequest(`failed-${key}`);
    await expect(page.locator(`#tab-${tab}[data-nikki-target]`)).toBeVisible();
    await page.locator(`#tab-${tab}`).evaluate(element => { element.disabled = true; });
    await expect(companion(page)).toContainText(`${label} couldn’t be opened`);
    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'false');
    await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === `failed-${key}` && JSON.parse(command.content).ok === false)).toBe(true);
    expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });

}

test('AI Coach navigation preserves its text conversation and draft without automatically sending messages', async ({ page }) => {
  const chatRequests = [];
  await page.route('**/api/coach/chat', async route => {
    chatRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: 'Synthetic coach reply: practise one clear example.' } });
  });
  await connect(page);
  const sessions = preview.voiceAudit.sessions;
  const openTab = async (name, id) => {
    preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
      id, name, client_side: true, arguments: '{}',
    }] });
    await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id && JSON.parse(command.content).ok)).toBe(true);
  };
  await openTab('open_ai_coach', 'coach-chat-first');
  const input = page.getByPlaceholder('What should I work on next?', { exact: true });
  await expect(input).toBeEnabled();
  expect(chatRequests).toHaveLength(0);
  await input.fill('Help me structure an example.');
  await page.getByRole('button', { name: 'Send coach message', exact: true }).click();
  await expect(page.getByText('Synthetic coach reply: practise one clear example.', { exact: true })).toBeVisible();
  await input.fill('Keep this unsent draft.');
  await openTab('open_my_progress', 'coach-chat-progress');
  await openTab('open_ai_coach', 'coach-chat-again');
  await expect(input).toHaveValue('Keep this unsent draft.');
  await expect(page.getByText('Synthetic coach reply: practise one clear example.', { exact: true })).toBeVisible();
  await expect(page.getByText('Help me structure an example.', { exact: true })).toBeVisible();
  expect(chatRequests).toHaveLength(1);
  expect(chatRequests[0].message).toBe('Help me structure an example.');
  expect((await readCurrentPage('coach-chat-unavailable')).state).toBe('unavailable');
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('Nikki reads the same History cards and follows expansion, tab changes and return without reconnecting', async ({ page }) => {
  await connect(page);
  await request(page);
  await expect(page.getByRole('heading', { name: 'Practice history', exact: true })).toBeVisible();
  await expect(companion(page)).toContainText('Nikki is still here');
  const sessions = preview.voiceAudit.sessions;
  const first = await readCurrentPage('read-collapsed');
  expect(first.state).toBe('ready');
  expect(first.totalSessions).toBe(8);
  expect(first.displayedSessions).toBe(5);
  expect(first.hiddenSessions).toBe(3);
  expect(first.olderSessionsExpanded).toBe(false);
  const cards = page.locator('.db-attempt-card:visible');
  expect(first.sessions).toHaveLength(await cards.count());
  for (const [index, session] of first.sessions.entries()) {
    const card = cards.nth(index);
    expect(session.label).toBe(await card.locator('.db-attempt-badge').innerText());
    expect(session.role).toBe(await card.locator('h3').innerText());
    expect(session.completedAtLabel).toBe(await card.locator('time').innerText());
    expect(session.overall).toBe(await card.locator('.db-attempt-score').innerText());
    expect(Object.values(session.metrics)).toEqual(await card.locator('dd').allInnerTexts());
  }
  const navigation = preview.voiceAudit.commands.filter(command => command.type === 'FunctionCallResponse' && command.name === 'open_practice_history').at(-1);
  expect(JSON.parse(navigation.content).context).toEqual(first);
  await page.getByRole('button', { name: 'Show 3 older sessions' }).click();
  const expanded = await readCurrentPage('read-expanded');
  expect(expanded.displayedSessions).toBe(8);
  expect(expanded.sessions).toHaveLength(8);
  expect(expanded.olderSessionsExpanded).toBe(true);
  await page.getByRole('button', { name: 'Show fewer sessions' }).click();
  expect((await readCurrentPage('read-collapsed-again')).sessions).toHaveLength(5);
  await page.getByRole('tab', { name: 'My Progress', exact: true }).click();
  const progress = await readCurrentPage('read-other-tab');
  expect(progress).toMatchObject({ page: 'my_progress', state: 'ready', view: 'starting_point' });
  expect(progress.sessions).toBeUndefined();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  expect((await readCurrentPage('read-history-again')).page).toBe('practice_history');
  await companion(page).getByRole('button', { name: 'Return to Nikki' }).click();
  await expect(page.locator('.voice-agent-playground')).toBeVisible();
  expect((await readCurrentPage('read-playground')).page).toBe('voice_agent_playground');
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
});

for (const state of ['empty', 'error', 'loading']) {
  test(`Nikki reports ${state} History without borrowing scores from another view`, async ({ page }) => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/api/users/results-summary?*', async route => {
      if (state === 'loading') await pending;
      await route.fulfill({ status: state === 'error' ? 500 : 200, contentType: 'application/json', body: JSON.stringify({ practiceHistory: [] }) });
    });
    try {
      await connect(page, state === 'empty' ? '?fresh=1' : '');
      await request(page);
      await expect(companion(page)).toContainText('Nikki is still here');
      if (state === 'empty') await expect(page.getByText(/No practice attempts yet/)).toBeVisible();
      if (state === 'error') await expect(page.getByText(/Couldn't load your practice history/)).toBeVisible();
      const context = await readCurrentPage(`read-${state}`);
      expect(context.page).toBe('practice_history');
      expect(context.state).toBe(state);
      expect(context.sessions || []).toEqual([]);
      if (state === 'loading') {
        release();
        await expect(page.getByText(/No practice attempts yet/)).toBeVisible();
        expect((await readCurrentPage('read-after-loading')).state).toBe('empty');
      }
      await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    } finally { release(); }
  });
}

test('the Practice history example starts voice and navigates without a workspace loading panel', async ({ page }) => {
  await page.goto(preview.baseURL);
  await page.evaluate(() => {
    window.unexpectedWorkspace = false;
    new MutationObserver(() => {
      if (document.querySelector('.va-workspace')) window.unexpectedWorkspace = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Show me my practice history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice history', exact: true })).toBeVisible();
  await expect(companion(page)).toContainText('Nikki is still here');
  expect(await page.evaluate(() => window.unexpectedWorkspace)).toBe(false);
  await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('Nikki counts down on the Playground and dashboard, then reloads the saved balance', async ({ page }) => {
  let remainingMs = 900_000;
  await page.route('**/api/voice-agent/quota', route => route.fulfill({ json: { remainingMs } }));
  await connect(page);
  await expect(page.getByRole('timer', { name: 'Nikki voice time remaining' })).toHaveText(/^14:\d\d left$/);
  await request(page);
  const card = page.getByRole('button', { name: 'Open AI Voice Agent' });
  await expect(card).toHaveAccessibleDescription(/^14:\d\d left$/);
  await expect(companion(page)).toContainText('Nikki is still here');
  remainingMs = 810_000;
  await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  await expect(card).toHaveAccessibleDescription('13:30 left');
});

test('Nikki shows the time limit on the dashboard when a background conversation ends', async ({ page }) => {
  let client;
  await page.routeWebSocket('**/__nikki-history-ws__', socket => {
    client = socket;
    socket.connectToServer();
  });
  await connect(page);
  await request(page);
  await expect(companion(page)).toContainText('Nikki is still here');
  client.send(JSON.stringify({
    type: 'voice_agent_error', code: 'quota_exhausted', message: 'You’ve used all your Nikki voice time.',
  }));
  await expect(companion(page)).toContainText('You’ve used all your Nikki voice time.');
  await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
  await companion(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(companion(page)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('History executes through the real socket controller, survives routes, and ends on manual leave', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.playbackAudit = { starts: 0, stops: 0 };
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.playbackAudit.starts += 1;
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      window.playbackAudit.stops += 1;
      return stop.apply(this, args);
    };
  });
  await connect(page);
  // Queue real Web Audio playback before unmounting the Playground. The actual
  // backend controller sends PCM through the same socket used for tool calls.
  for (let i = 0; i < 3; i += 1) preview.voiceAudit.callbacks.onAudio(new Uint8Array(24_000 * 2 * 8));
  await expect.poll(() => page.evaluate(() => window.playbackAudit.starts)).toBe(3);
  const sessions = preview.voiceAudit.sessions;
  const commands = preview.voiceAudit.commands.length;
  // Model-driven navigation must preserve the current spoken response. Clicking
  // a new prompt intentionally interrupts it, so dispatch the provider tool here.
  preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallRequest', functions: [{
    id: 'playback-history', name: 'open_practice_history', client_side: true, arguments: '{}',
  }] });
  await expect(page.locator('.nikki-cursor')).toBeVisible();
  expect(preview.voiceAudit.commands.slice(commands).filter(command => command.type === 'FunctionCallResponse')).toHaveLength(0);
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(companion(page)).toContainText('Nikki is still here');
  await expect.poll(() => preview.voiceAudit.commands.slice(commands).filter(command => command.type === 'FunctionCallResponse').length).toBe(1);
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.playbackAudit.stops)).toBe(0);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  returnRequest('playback-return');
  await expect(page.locator('[data-nikki-return][data-nikki-target]')).toBeVisible();
  await expect.poll(() => preview.voiceAudit.commands.filter(command => command.id === 'playback-return' && command.type === 'FunctionCallResponse').length).toBe(1);
  await expect(page.locator('.voice-agent-playground')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('LIVE');
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.playbackAudit)).toEqual({ starts: 3, stops: 0 });
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.locator('.db-root')).toBeVisible();
  await expect(companion(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
  expect(await page.evaluate(() => window.playbackAudit.stops)).toBe(3);
  expect(errors).toEqual([]);
});

test('return while already in Playground succeeds without reconnecting', async ({ page }) => {
  await connect(page);
  const sessions = preview.voiceAudit.sessions;
  returnRequest('already-home');
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === 'already-home' && JSON.parse(command.content).displayed === 'voice_agent_playground')).toBe(true);
  expect(preview.voiceAudit.sessions).toBe(sessions);
  expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 0 });
  await expect(companion(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'End session', exact: true }).click();
});

for (const stop of ['Stop', 'Escape', 'model cancellation']) {
  test(`${stop} cancels a Playground return and keeps the conversation on History`, async ({ page }) => {
    await connect(page);
    await request(page);
    await expect(companion(page)).toContainText('Nikki is still here');
    returnRequest('cancel-return');
    await expect(page.locator('[data-nikki-return][data-nikki-target]')).toBeVisible();
    if (stop === 'Stop') await companion(page).getByRole('button', { name: 'Stop', exact: true }).click();
    else if (stop === 'Escape') await page.keyboard.press('Escape');
    else preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallCancelled', functions: [{ id: 'cancel-return' }] });
    await expect(companion(page)).toContainText('You’re in control');
    await expect(page.locator('.nikki-cursor')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
    expect(preview.voiceAudit.commands.some(command => command.id === 'cancel-return' && JSON.parse(command.content).ok)).toBe(false);
    await companion(page).getByRole('button', { name: 'Return to Nikki' }).click();
    await expect(page.locator('.voice-agent-playground')).toBeVisible();
    await page.getByRole('button', { name: 'End session', exact: true }).click();
  });
}

for (const stop of ['Stop', 'Escape', 'model cancellation']) {
  test(`${stop} prevents the pending tab click and reports no success`, async ({ page }) => {
    await connect(page);
    const start = preview.voiceAudit.commands.length;
    await request(page);
    await expect(page.locator('#tab-history[data-nikki-target]')).toBeVisible();
    if (stop === 'Stop') await companion(page).getByRole('button', { name: 'Stop', exact: true }).click();
    else if (stop === 'Escape') {
      await companion(page).getByRole('button', { name: 'Mute Nikki microphone' }).focus();
      await page.keyboard.press('Escape');
    }
    else preview.voiceAudit.callbacks.onEvent({ type: 'FunctionCallCancelled', functions: [{ id: 'history-1' }] });
    await expect(page.locator('.nikki-cursor')).toHaveCount(0);
    await expect(companion(page)).toContainText('You’re in control');
    await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'false');
    expect(preview.voiceAudit.commands.slice(start).some(command => command.type === 'FunctionCallResponse' && JSON.parse(command.content).ok)).toBe(false);
    expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    await expect(companion(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
  });
}

test('moving to an interview ends the companion and releases the microphone', async ({ page }) => {
  await connect(page);
  await request(page);
  await expect(companion(page)).toContainText('Nikki is still here');
  await page.getByRole('button', { name: 'Test interview handoff' }).click();
  await expect(page.getByText('Interview destination', { exact: true })).toBeVisible();
  await expect(companion(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
});

test('leaving while microphone permission is pending releases the late stream and never connects', async ({ page }) => {
  await page.goto(preview.baseURL + '?slowMic=1');
  const sessions = preview.voiceAudit.sessions;
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
  expect(preview.voiceAudit.sessions).toBe(sessions);
  await expect(companion(page)).toHaveCount(0);
});

for (const action of ['Test sign out', 'Test account change']) {
  test(`${action} disconnects the existing account session`, async ({ page }) => {
    await connect(page);
    await request(page);
    await expect(companion(page)).toContainText('Nikki is still here');
    const sessions = preview.voiceAudit.sessions;
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
    await expect(companion(page)).toHaveCount(0);
    expect(preview.voiceAudit.sessions).toBe(sessions);
  });
}

test('a failed target leaves an honest error and the conversation connected', async ({ page }) => {
  await connect(page);
  await request(page);
  await expect(page.locator('#tab-history[data-nikki-target]')).toBeVisible();
  await page.locator('#tab-history').evaluate(element => { element.disabled = true; });
  await expect(companion(page)).toContainText('History couldn’t be opened');
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'false');
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
});

test('a workspace requested on Dashboard is available on return without reconnecting', async ({ page }) => {
  await connect(page);
  await request(page);
  await expect(companion(page)).toContainText('Nikki is still here');
  const sessions = preview.voiceAudit.sessions;
  await page.getByRole('button', { name: 'Test workspace request' }).click();
  await companion(page).getByRole('button', { name: 'Return to Nikki' }).click();
  await expect(page.locator('.va-workspace')).toBeVisible();
  expect(preview.voiceAudit.sessions).toBe(sessions);
});

for (const width of [1440, 768, 390]) {
  test(`companion and real History remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
    await connect(page);
    await request(page);
    if (width !== 768) {
      await expect(page.locator('.nikki-cursor')).toBeVisible();
      const label = await page.locator('.nikki-cursor span').boundingBox();
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x + label.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/nikki-history-working-${width}.png` });
    }
    await expect(page.getByRole('heading', { name: 'Practice history', exact: true })).toBeVisible();
    await expect(companion(page)).toContainText('Nikki is still here');
    const bounds = await companion(page).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/nikki-history-${width}.png`, fullPage: true });
    await companion(page).getByRole('button', { name: 'Mute Nikki microphone' }).click();
    await expect(companion(page)).toContainText('Microphone muted');
    await companion(page).getByRole('button', { name: 'End Nikki conversation' }).click();
    await expect(companion(page)).toHaveCount(0);
  });
}
