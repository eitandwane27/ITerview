import { expect, test } from 'playwright/test';
import { startTranscriptServer, spokenAnswer } from './fixtures/mainSetsTranscriptServer.mjs';

let server;
test.beforeAll(async () => { server = await startTranscriptServer(); });
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  server.messages.length = 0;
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'] });

const original = `${spokenAnswer} We tested it together.`;
const corrected = 'I used React to build our project. We tested it together.';
const submissions = () => server.messages.filter(message => message.type === 'submit_answer');

async function record(page, set = 1) {
  await page.goto(`${server.url}?set=${set}`);
  await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toHaveCount(0);
  await page.locator('#btn-toggle-mic').click();
  await expect(page.locator('.ix-transcript-final')).toHaveText(spokenAnswer);
  await expect(page.locator('.ix-transcript-interim')).toHaveText('We tested it together.');
  await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toHaveCount(0);
  await page.locator('#btn-toggle-mic').click();
  await expect(page.locator('.ix-transcript-review-box')).toHaveText(original);
  expect(submissions()).toEqual([]);
}

for (const set of [1, 2, 3]) {
  test(`set ${set} reviews and submits the corrected answer once, preserving it for retries and history`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await record(page, set);
    await page.getByRole('button', { name: 'Edit transcript', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Edit transcript', exact: true });
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue(original);
    await editor.fill(corrected);
    await expect(page.getByRole('button', { name: 'Submit answer', exact: true })).toBeDisabled();
    // Provider results queued after stop must never duplicate or overwrite edits.
    server.send({ type: 'transcript', text: 'Late provider result.', isFinal: true });
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.ix-transcript-review-box')).toHaveText(corrected);
    await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Submit answer', exact: true }).evaluate(button => { button.click(); button.click(); });
    await expect.poll(() => submissions()).toEqual([{ type: 'submit_answer', final_text: corrected }]);
    await expect(page.locator('.ix-state-evaluating')).toBeVisible();
    server.send({ type: 'error', code: 'EVALUATION_FAILED', message: 'Please retry evaluation.' });
    await page.getByRole('button', { name: 'Retry evaluation', exact: true }).click();
    await expect.poll(() => submissions().length).toBe(2);
    expect(submissions()[1].final_text).toBe(corrected);
    server.send({ type: 'coach_tip', tip: 'Describe your contribution.', interviewer_reply: 'Thank you.' });
    server.send({ type: 'question_text', index: 2, text: 'How did you test the project?' });
    await expect(page.getByRole('button', { name: 'Submit answer', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Transcript', exact: true }).click();
    await expect(page.getByText(corrected, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('cancel and Escape discard edits; blank edits cannot be saved; Space stays in the editor', async ({ page }) => {
  await record(page);
  const edit = page.getByRole('button', { name: 'Edit transcript', exact: true });
  const editor = page.getByRole('textbox', { name: 'Edit transcript', exact: true });
  await edit.click();
  await editor.fill('   ');
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.ix-transcript-review-box')).toHaveText(original);
  await edit.click();
  await editor.fill('React');
  await editor.press('Space');
  await expect(editor).toHaveValue('React ');
  await editor.press('Escape');
  await expect(edit).toBeFocused();
  await expect(page.locator('.ix-transcript-review-box')).toHaveText(original);
  expect(server.messages.filter(message => message.type === 'start_recording')).toHaveLength(1);
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await expect.poll(() => submissions()[0]?.final_text).toBe(original);
});

test('empty speech can be recorded again and preview timers cannot overwrite corrections', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${server.url}?preview`);
  await page.locator('#btn-toggle-mic').click();
  await page.locator('#btn-toggle-mic').click();
  await expect(page.getByText('No speech was captured. Record your answer again to continue.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit answer', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Record again', exact: true }).click();
  await page.clock.runFor(600);
  await page.locator('#btn-toggle-mic').click();
  await page.getByRole('button', { name: 'Edit transcript', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit transcript', exact: true }).fill(corrected);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.clock.runFor(4000);
  await expect(page.locator('.ix-transcript-review-box')).toHaveText(corrected);
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await page.clock.runFor(1600);
  await page.getByRole('tab', { name: 'Transcript', exact: true }).click();
  await expect(page.getByText(corrected, { exact: true })).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 680 }, { width: 390, height: 844 }]) {
  test(`review and editing fit at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await record(page);
    await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
    await page.getByRole('button', { name: 'Edit transcript', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Edit transcript', exact: true });
    await editor.fill(corrected.repeat(20));
    for (const control of [editor, page.getByRole('button', { name: 'Save changes', exact: true }),
      page.getByRole('button', { name: 'Submit answer', exact: true })]) {
      await expect(control).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('editing.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Record again', exact: true }).click();
    await expect(page.locator('.ix-transcript-final')).toHaveText(spokenAnswer);
    await expect(page.getByRole('button', { name: 'Edit transcript', exact: true })).toHaveCount(0);
  });
}
