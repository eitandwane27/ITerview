import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
let sequence = 0;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiHistory.jsx' }); });
test.afterAll(async () => { await preview?.close(); });
test.setTimeout(45_000);
const dock = page => page.getByRole('complementary', { name: 'Nikki companion' });
function event(value) { preview.voiceAudit.callbacks.onEvent(value); }
function invoke(name = 'sign_out') {
  const id = `sign-out-${++sequence}`;
  event({ type: 'FunctionCallRequest', functions: [{ id, name, client_side: true, arguments: '{}' }] });
  return id;
}
async function result(id) {
  await expect.poll(() => preview.voiceAudit.commands.some(command => command.id === id), { timeout: 15000 }).toBe(true);
  return JSON.parse(preview.voiceAudit.commands.find(command => command.id === id).content);
}
async function connect(page, width = 1440, reducedMotion = 'reduce', height = 900) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion });
  await page.goto(preview.baseURL);
  await page.getByRole('button', { name: 'Start voice session', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Voice session is live' })).toContainText('LIVE');
  // Fixture-only controls overlap the real sidebar's account actions.
  await page.locator('.history-test-controls, .history-auth-controls').evaluateAll(nodes => nodes.forEach(node => { node.style.display = 'none'; }));
}

for (const [width, height, captions] of [[1366, 768, false], [390, 568, false], [844, 390, false], [390, 568, true], [844, 390, true]]) {
  test(`Sign Out and Nikki never overlap during opening or closing at ${width}x${height}, captions ${captions}`, async ({ page }) => {
    await connect(page, width, 'no-preference', height);
    if (captions) await page.getByRole('button', { name: 'Show captions', exact: true }).click();
    expect(await result(invoke('open_practice_history'))).toMatchObject({ ok: true });
    if (captions) event({ type: 'ConversationText', role: 'assistant', content: 'Thank you for listening to our interview practice demonstration. '.repeat(12) });
    await page.evaluate(() => {
      window.signOutLayout = { samples: 0, opening: 0, closing: 0, collisions: 0, outsideViewport: 0, done: false };
      let seen = false;
      const record = () => {
        const dialog = document.querySelector('.db-signout-modal[open]');
        const dock = dialog?.querySelector('.nikki-companion');
        if (dock) {
          seen = true;
          const a = dialog.getBoundingClientRect();
          const b = dock.getBoundingClientRect();
          const audit = window.signOutLayout;
          audit.samples += 1;
          if (dialog.hasAttribute('data-closing')) audit.closing += 1;
          else audit.opening += 1;
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) audit.collisions += 1;
          if (a.top < 0 || b.top < 0 || a.bottom > innerHeight || b.bottom > innerHeight || a.left < 0 || b.left < 0 || a.right > innerWidth || b.right > innerWidth) audit.outsideViewport += 1;
        } else if (seen) { window.signOutLayout.done = true; return; }
        requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.locator('button[aria-label="Sign Out"]:visible').first().click();
    const dialog = page.getByRole('dialog', { name: 'Sign out of ITerview?' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.getAnimations().every(animation => animation.playState === 'finished'))).toBe(true);
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click({ trial: true });
    await page.screenshot({ path: `test-results/nikki-signout-layout-${width}x${height}-${captions}.png` });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.signOutLayout.done)).toBe(true);
    const audit = await page.evaluate(() => window.signOutLayout);
    expect(audit.opening).toBeGreaterThan(0);
    expect(audit.closing).toBeGreaterThan(0);
    expect(audit.collisions).toBe(0);
    expect(audit.outsideViewport).toBe(0);
    expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(0);
    await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
  });
}

for (const width of [1440, 390]) {
  test(`goodbye waits for server audio and audible playback, then signs out once at ${width}px`, async ({ page }) => {
    await connect(page, width);
    // Invalidate the opening greeting, then dispatch a tool before TTS arrives.
    event({ type: 'AgentThinking' });
    const id = invoke();
    expect(await result(id)).toMatchObject({ ok: true, outcome: 'scheduled' });
    await expect(dock(page)).toContainText('Finishing the goodbye');
    await expect(page.locator('.voice-agent-playground')).toBeVisible();
    expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(0);
    await page.evaluate(() => {
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.signOutAudit.audioEndsAt = performance.now() + ((args[0] + this.buffer.duration - this.context.currentTime) * 1000);
        return start.apply(this, args);
      };
    });
    const audio = Buffer.alloc(24_000 * 2 * 2); // two seconds of synthetic PCM
    preview.voiceAudit.callbacks.onAudio(audio);
    event({ type: 'AgentAudioDone' });
    // AgentAudioDone does not mean the queued audio has played through.
    await expect(page.locator('.voice-agent-playground')).toBeVisible();
    await expect(page.locator('.voice-agent-playground')).toBeHidden({ timeout: 8000 });
    await expect(page.getByText('Signed out', { exact: true })).toBeVisible();
    await expect(page.getByTestId('nikki-test-location')).toHaveText('/landing');
    expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(1);
    const timing = await page.evaluate(() => window.signOutAudit);
    expect(timing.dashboardAt).toBeGreaterThanOrEqual(timing.audioEndsAt - 30);
    expect(await page.evaluate(() => window.microphoneAudit)).toEqual({ opened: 1, stopped: 1 });
    await expect(dock(page)).toHaveCount(0);
  });
}

test('normal-motion sign-out uses the visible cursor from History and an already open confirmation at 390px', async ({ page }) => {
  await connect(page, 390, 'no-preference');
  expect(await result(invoke('open_practice_history'))).toMatchObject({ ok: true });
  await page.locator('button[aria-label="Sign Out"]:visible').first().click();
  await expect(page.locator('.db-signout-modal .nikki-companion')).toBeVisible();
  event({ type: 'AgentThinking' });
  expect(await result(invoke())).toMatchObject({ outcome: 'scheduled' });
  event({ type: 'AgentAudioDone' });
  await expect(page.locator('.db-signout-modal__button--confirm[data-nikki-target]')).toBeVisible();
  await expect(page.locator('.db-signout-modal .nikki-cursor')).toBeVisible();
  await expect(page.getByText('Signed out', { exact: true })).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(1);
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(1);
});

for (const interruption of ['Stop', 'Escape', 'speech', 'model']) {
  test(`${interruption} cancels sign-out before the goodbye completes`, async ({ page }) => {
    await connect(page);
    event({ type: 'AgentThinking' });
    const id = invoke();
    await expect(dock(page)).toContainText('Finishing the goodbye');
    if (interruption === 'Stop') await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
    else if (interruption === 'Escape') await page.keyboard.press('Escape');
    else if (interruption === 'speech') event({ type: 'UserStartedSpeaking' });
    else event({ type: 'FunctionCallCancelled', functions: [{ id }] });
    await expect(dock(page)).toHaveCount(0);
    expect(preview.voiceAudit.commands.filter(command => command.id === id)).toHaveLength(1);
    event({ type: 'AgentAudioDone' });
    await expect(page.locator('.voice-agent-playground')).toBeVisible();
    expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(0);
    expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
    await page.getByRole('button', { name: 'End session', exact: true }).click();
  });
}

test('Sign Out hosts usable Nikki controls, hides underlying page context, and allows Stop before confirmation', async ({ page }) => {
  await connect(page, 1440, 'no-preference');
  const open = invoke('open_practice_history');
  expect(await result(open)).toMatchObject({ ok: true });
  event({ type: 'AgentThinking' });
  const id = invoke();
  event({ type: 'AgentAudioDone' });
  await expect(page.locator('.db-signout-modal[open]')).toBeVisible({ timeout: 12000 });
  await expect(page.locator('.db-signout-modal .nikki-companion')).toBeVisible();
  const current = await result(invoke('read_current_page'));
  expect(current.context).toMatchObject({ page: 'sign_out', state: 'ready' });
  expect(current.context.sessions).toBeUndefined();
  await dock(page).getByRole('button', { name: 'Mute Nikki microphone' }).click();
  await dock(page).getByRole('button', { name: 'Unmute Nikki microphone' }).click();
  await dock(page).getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(dock(page)).toContainText('Sign-out stopped');
  expect(preview.voiceAudit.commands.filter(command => command.id === id)).toHaveLength(1);
  expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});

test('failed authentication sign-out stays signed in and never retries automatically', async ({ page }) => {
  await connect(page);
  await page.evaluate(() => { window.signOutAudit.fail = true; });
  event({ type: 'AgentThinking' });
  const id = invoke();
  event({ type: 'AgentAudioDone' });
  expect(await result(id)).toMatchObject({ ok: true, outcome: 'scheduled' });
  await expect(page.locator('.db-signout-modal__error')).toContainText('Couldn’t sign out');
  await expect(dock(page)).toContainText('Sign-out failed');
  expect(await page.evaluate(() => window.signOutAudit.calls)).toBe(1);
  expect(await page.evaluate(() => window.microphoneAudit.stopped)).toBe(0);
  await dock(page).getByRole('button', { name: 'End Nikki conversation' }).click();
});
