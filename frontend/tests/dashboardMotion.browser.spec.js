import { test, expect } from 'playwright/test';
import { dashboardMotionServer } from './fixtures/dashboardMotionServer.mjs';
let preview;
test.beforeAll(async () => { preview = await dashboardMotionServer(); });
test.afterAll(async () => { await preview?.server.close(); });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`navigation, disclosures and dialogs remain usable at ${viewport.width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize(viewport);
    await page.goto(preview.baseURL);
    await expect(page.locator('#role-select')).toHaveValue('frontend');
    for (const name of ['History', 'AI Coach', 'Practice Again', 'My Progress', 'Interview Prep', 'History']) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
    await expect(page.locator('.db-nav-indicator')).toHaveCount(1);
    const older = page.locator('#db-history-older');
    const toggle = page.getByRole('button', { name: 'Show 3 older sessions' });
    await expect(older).toHaveAttribute('inert', '');
    await toggle.click();
    await expect(older).toHaveAttribute('aria-hidden', 'false');
    await expect(older).not.toHaveAttribute('inert');
    await page.getByRole('button', { name: 'Show fewer sessions' }).click();
    await expect(older).toHaveAttribute('inert', '');
    await page.getByRole('tab', { name: 'History', exact: true }).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'My Progress', exact: true })).toBeFocused();
    const avatar = page.getByRole('button', { name: 'Open profile settings' }).filter({ visible: true });
    await avatar.click();
    await expect(page.getByRole('dialog', { name: 'Profile Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Close profile settings' }).press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Interview Prep', exact: true }).click();
    await expect.poll(() => page.locator('.db-nav-indicator').evaluate(el => {
      const highlight = el.getBoundingClientRect();
      const selected = el.closest('button').getBoundingClientRect();
      return Math.abs(highlight.top - selected.top) + Math.abs(highlight.left - selected.left);
    })).toBeLessThan(0.5);
    await page.screenshot({ path: `test-results/dashboard-motion-${viewport.width}.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('reduced motion keeps reveals instant and native dialog dismissal functional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${preview.baseURL}?fresh=1`);
  const role = page.getByRole('combobox', { name: 'Target role' });
  await role.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await role.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  expect(await page.getByRole('tabpanel').evaluate(el => el.getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true })).toBeFocused();
});
