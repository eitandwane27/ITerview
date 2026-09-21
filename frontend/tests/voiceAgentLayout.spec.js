import { expect, test } from 'playwright/test';

const baseURL = globalThis.process?.env?.VOICE_AGENT_TEST_URL || 'http://localhost:5173';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`keeps the voice-agent start action visible on ${viewport.name}`, async ({ playwright }) => {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL,
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    await page.goto('/dev/voice-agent');

    const startButton = page.getByRole('button', { name: 'Start voice session' });
    await expect(page.getByText('ITerview', { exact: true })).toBeVisible();
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText('Start conversation');
    await page.getByRole('button', { name: 'Audio settings' }).click();
    await expect(page.getByRole('combobox', { name: 'Microphone input' })).toBeVisible();

    const bounds = await startButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);

    await page.screenshot({
      path: `test-results/voice-agent-${viewport.name}.png`,
      fullPage: true,
    });

    await context.close();
  });
}
