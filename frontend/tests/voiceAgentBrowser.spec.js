import { expect, test } from 'playwright/test';

test('runs the connected voice-agent greeting and controls in a browser', async ({
  playwright,
}) => {
  test.setTimeout(60_000);
  const browser = await playwright.chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173',
    permissions: ['microphone'],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/voice-agent');
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Microphone input' })).toBeVisible();

  await page.getByRole('button', { name: 'Start voice session' }).click();
  await expect(page.getByRole('status')).toContainText('LIVE', { timeout: 30_000 });
  const microphonePicker = page.getByRole('combobox', { name: 'Microphone input' });
  await expect(microphonePicker).toBeEnabled();

  await page.waitForFunction(
    () => document.querySelector('.voice-agent-playground')?.dataset.state === 'speaking',
    undefined,
    { timeout: 30_000 }
  );
  await expect(page.getByRole('heading', { name: 'Speaking with you' })).toBeVisible();

  await page.getByRole('button', { name: 'Audio settings' }).click();
  const availableMicrophones = page.locator('#voice-agent-microphone option:not([value=""])');
  await expect.poll(() => availableMicrophones.count()).toBeGreaterThan(0);
  const alternateDeviceId = await availableMicrophones.first().getAttribute('value');
  expect(alternateDeviceId).toBeTruthy();
  await microphonePicker.selectOption(alternateDeviceId);
  await expect(microphonePicker).toHaveValue(alternateDeviceId);
  await expect(page.getByRole('status')).toContainText('LIVE');

  await page.getByRole('button', { name: 'Mute microphone' }).click();
  await expect(page.getByRole('button', { name: 'Unmute microphone' })).toBeVisible();

  await page.getByRole('button', { name: 'Show captions' }).click();
  await expect(page.getByRole('button', { name: 'Hide captions' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.getByRole('button', { name: 'Mute voice audio' }).click();
  await expect(page.getByRole('button', { name: 'Unmute voice audio' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );

  await page.screenshot({ path: 'test-results/voice-agent-live.png', fullPage: true });
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page).toHaveURL(/\/(dashboard|login)$/);
  expect(pageErrors).toEqual([]);

  await context.close();
});
