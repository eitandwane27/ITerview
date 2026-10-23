import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';

let preview;
test.beforeAll(async () => { preview = await dashboardMotionServer({ entry: 'nikkiOpening.jsx' }); });
test.afterAll(async () => { await preview?.server.close(); });

const openButton = (page) => page.getByRole('button', { name: 'Open AI Voice Agent', exact: true });

test('opening covers the real destination render and presents Nikki before revealing it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(preview.baseURL);
  await page.evaluate(() => {
    window.nikkiExpressions = [];
    const observer = new MutationObserver(() => {
      const state = document.querySelector('.nikki-opening .ix-orb-container')?.dataset.state;
      if (state && window.nikkiExpressions.at(-1) !== state) window.nikkiExpressions.push(state);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
  });
  const start = Date.now();
  await openButton(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(page.locator('.va-stage .ix-orb-container')).toHaveAttribute('data-renderer', /active|fallback/);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('Nikki’s ready');
  await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(Date.now() - start).toBeGreaterThanOrEqual(1950);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeFocused();
  await expect(page.locator('.va-stage .ix-orb-container')).toHaveCount(1);
  expect(await page.evaluate(() => window.nikkiExpressions)).toEqual(['booting', 'listening', 'thinking', 'complete']);
  expect(errors).toEqual([]);
});

test('Cancel and Escape restore dashboard focus and prevent delayed navigation', async ({ page }) => {
  await page.goto(preview.baseURL);
  await openButton(page).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(openButton(page)).toBeFocused();
  await page.waitForTimeout(1600);
  await expect(page.locator('.voice-agent-playground')).toHaveCount(0);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await openButton(page).click();
  await page.clock.runFor(1750);
  await expect(page.locator('.va-stage')).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(openButton(page)).toBeVisible();
  await page.clock.runFor(100);
  await expect(openButton(page)).toBeFocused();
  await expect(page.locator('.voice-agent-playground')).toHaveCount(0);
});

test('WebGL fallback and reduced motion still finish opening on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto(preview.baseURL);
  await openButton(page).click();
  await expect(page.getByRole('dialog').locator('.ix-orb-container')).toHaveAttribute('data-renderer', 'fallback');
  expect(await page.locator('.nikki-opening__character').evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await page.locator('.nikki-opening__progress span').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.va-stage .ix-orb-container')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.getByRole('button', { name: 'Start voice session' })).toBeVisible();
});

test('slow destination stays covered past the minimum until its actual orb is ready', async ({ page }) => {
  await page.goto(`${preview.baseURL}?slow=1`);
  await openButton(page).click();
  const progressbar = page.getByRole('progressbar');
  const initialProgress = Number(await progressbar.getAttribute('aria-valuenow'));
  expect(initialProgress).toBeLessThan(25);
  await expect.poll(async () => Number(await progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(initialProgress);
  await expect(page.locator('.nikki-opening')).toHaveAttribute('data-phase', 'covering');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.va-stage')).toHaveCount(0);
  await expect(progressbar).toHaveAttribute('aria-valuenow', '90');
  expect(await progressbar.locator('span').evaluate(el => getComputedStyle(el).transform)).toBe('matrix(0.9, 0, 0, 1, 0, 0)');
  await expect(progressbar).toHaveAttribute('aria-valuenow', '100', { timeout: 6000 });
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('.va-stage .ix-orb-container')).toHaveAttribute('data-renderer', /active|fallback/);
});

test('a stalled opening offers a way back without revealing an unready screen', async ({ page }) => {
  await page.goto(`${preview.baseURL}?timeout=1`);
  await page.clock.install();
  await openButton(page).click();
  await page.clock.fastForward(12_100);
  await expect(page.getByRole('heading', { name: 'Nikki needs a moment' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(openButton(page)).toBeFocused();
});

for (const width of [1440, 768, 390]) {
  test(`opening composition fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(preview.baseURL);
    await page.clock.install();
    await openButton(page).click();
    await page.clock.runFor(1050);
    await page.screenshot({ path: `test-results/nikki-opening-${width}.png` });
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(16);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 16);
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
