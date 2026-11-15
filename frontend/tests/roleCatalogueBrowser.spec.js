import { expect, test } from 'playwright/test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { savedQuestions } from './fixtures/savedQuestions';

const require = createRequire(import.meta.url);
const { getRoleCatalogue } = require('../../backend/services/chatbotKnowledgeService');
const catalogue = [
  ...getRoleCatalogue(),
  { id: 'qa-test', label: 'QA Test Engineer', topics: ['Testing'] },
];
async function chooseSetupOption(page, id, value) {
  const trigger = page.locator('#' + id);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const menu = page.locator('[role="listbox"]');
  await menu.locator('[role="option"][data-value="' + value + '"]').click();
}

let server;
let baseURL;

test.beforeAll(async () => {
  // Test-only authentication module. No Firebase account, database, or AI calls.
  const authModule = '\0role-catalogue-test-auth';
  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'role-catalogue-test-harness',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'firebase/auth' || id === '../firebase') return authModule;
        },
        load(id) {
          if (id !== authModule) return;
          return `
          const user = { uid: 'registry-browser-user', displayName: 'Test User', email: 'test@spcba.edu.ph', emailVerified: true, getIdToken: async () => 'test-token', reload: async () => {} };
          const listeners = new Set();
          window.__signOutTest = { calls: 0, fail: false, wait: false, release: null };
          export const auth = { currentUser: user, authStateReady: async () => {} };
          export function onAuthStateChanged(_auth, callback) {
            listeners.add(callback);
            queueMicrotask(() => { if (listeners.has(callback)) callback(auth.currentUser); });
            return () => listeners.delete(callback);
          }
          export async function updateProfile(target, values) { Object.assign(target, values); }
          export async function signOut() {
            const state = window.__signOutTest;
            state.calls++;
            if (state.wait) await new Promise(resolve => { state.release = resolve; });
            if (state.fail) throw new Error('Test sign-out failure');
            auth.currentUser = null;
            for (const callback of listeners) callback(null);
          }
          const unsupportedAuth = async () => { throw new Error('Unexpected test auth operation'); };
          export const signInWithEmailAndPassword = unsupportedAuth;
          export const createUserWithEmailAndPassword = unsupportedAuth;
          export const sendPasswordResetEmail = unsupportedAuth;
          export const sendEmailVerification = unsupportedAuth;
        `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__role-test__', async (req, res, next) => {
            try {
              const html = await vite.transformIndexHtml(
                '/__role-test__',
                `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/${req.url.includes('signout') ? 'roleSignOut' : 'roleDashboard'}.jsx"></script></body></html>`
              );
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
  });
  await server.listen();
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});

test.afterAll(async () => {
  await server?.close();
});

async function mockApi(
  page,
  {
    roles = catalogue,
    role = 'frontend',
    completed = true,
    active = {},
    catalogueHandler,
    saveStatus = 200,
    onSave = () => {},
  } = {}
) {
  let library = structuredClone(savedQuestions);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (url.pathname === '/api/practice-again/questions') return json({ questions: library });
    if (url.pathname.startsWith('/api/practice-again/questions/')) {
      const id = url.pathname.split('/')[4];
      const question = savedQuestions.find(item => item.id === id);
      if (route.request().method() === 'DELETE') library = library.filter(item => item.id !== id);
      else library = [...library.filter(item => item.id !== id), question];
      return json({ question });
    }
    if (url.pathname === '/api/recommendations/roles') {
      if (catalogueHandler) return catalogueHandler(route);
      return json({ roles });
    }
    if (url.pathname === '/api/users/role') {
      onSave(route.request().postDataJSON());
      return json({ message: 'Test profile response' }, saveStatus);
    }
    if (url.pathname === '/api/users/login') return json({});
    if (url.pathname === '/api/users/results-summary') {
      return json({
        practiceHistory: [
          {
            role: 'qa-test',
            attemptNumber: 1,
            completedAt: '2026-09-01T12:00:00Z',
            overallScorePercentage: 80,
          },
        ],
        threeCBreakdown: { clarity: 4, correctness: 4, completeness: 4 },
        preTestScore: 80,
      });
    }
    if (url.pathname === '/api/users/active-practice-session') return json(active);
    if (url.pathname === '/api/users/registry-browser-user') {
      return json({
        user: { role, displayName: 'Test User', focusArea: 'auto', unlockedDifficulty: 'easy' },
        hasCompletedDiagnostic: completed,
      });
    }
    return json({ message: 'Unexpected test API request' }, 404);
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  for (const registeredRole of getRoleCatalogue().filter((role) =>
    ['qa-engineer', 'cyber-security', 'network-engineer', 'game-developer', 'ui-ux-developer', 'android', 'ios', 'devops', 'data-analyst', 'ai-engineer', 'it-support'].includes(role.id)
  )) {
    test(`profile edits preserve registered ${registeredRole.label} setup on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      let saved;
      await mockApi(page, {
        role: registeredRole.id,
        onSave: (body) => {
          saved = body;
        },
      });
      await page.goto(`${baseURL}/__role-test__`);
      await expect(page.locator('#role-select')).toHaveAttribute('data-value', registeredRole.id);
      await expect(page.locator('#role-select')).toContainText(
        registeredRole.label
      );
      await page
        .getByRole('button', { name: 'Open profile settings' })
        .filter({ visible: true })
        .click();
      await expect(page.locator('#modal-role')).toHaveCount(0);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(saved).not.toHaveProperty('role');
      expect(saved).not.toHaveProperty('focusArea');
      await expect(page.locator('#role-select')).toHaveAttribute('data-value', registeredRole.id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
    });
  }

  test(`interview prep owns role choices independently of profile on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    let saved;
    await mockApi(page, {
      onSave: (body) => {
        saved = body;
      },
    });
    await page.goto(`${baseURL}/__role-test__`);
    const select = page.locator('#role-select');
    await expect(select).toBeEnabled();
    await select.click();
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
      ...catalogue.map((role) => role.label),
    ]);
    await chooseSetupOption(page, 'role-select', 'qa-test');
    await page
      .getByRole('button', { name: 'Open profile settings' })
      .filter({ visible: true })
      .click();
    await expect(page.locator('#modal-role, #modal-focus')).toHaveCount(0);
    await expect(page.getByRole('definition')).toHaveText('test@spcba.edu.ph');
    await page.getByRole('textbox', { name: 'Display name' }).fill('Updated name');
    await page.getByRole('radio', { name: 'Robot avatar' }).check();
    const voice = page.getByRole('combobox', { name: 'Interviewer voice' });
    const dialog = page.getByRole('dialog', { name: 'Profile Settings' });
    const voiceMenu = dialog.getByRole('listbox', { name: 'Interviewer voice' });
    await expect(voice).toHaveText('Luna (Default)');
    await voice.click();
    const feminine = voiceMenu.getByRole('group', { name: 'Feminine' });
    const masculine = voiceMenu.getByRole('group', { name: 'Masculine' });
    await expect(feminine.getByRole('option')).toHaveCount(17);
    await expect(masculine.getByRole('option')).toHaveCount(9);
    const selectedVoice = feminine.getByRole('option', { selected: true });
    await expect(selectedVoice).toHaveText('Luna (Default)');
    await expect(selectedVoice).toBeInViewport({ ratio: 1 });
    await expect.poll(() => voiceMenu.evaluate(list => {
      const bounds = list.getBoundingClientRect();
      const dialogBounds = list.closest('dialog').getBoundingClientRect();
      return list.clientHeight <= 236 && list.scrollHeight > list.clientHeight &&
        bounds.top >= dialogBounds.top && bounds.bottom <= dialogBounds.bottom;
    })).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath('profile-voice-menu.png'), animations: 'disabled' });
    await voice.press('Escape');
    await expect(voiceMenu).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(voice).toBeFocused();
    await voice.click();
    await voiceMenu.getByRole('option', { name: 'Andromeda' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'qa-test');
    expect(saved).toEqual({ firebaseUid: 'registry-browser-user', displayName: 'Updated name', avatar: 'robot', interviewerVoice: 'aura-2-andromeda-en' });
    await page.getByRole('button', { name: 'Open profile settings' }).filter({ visible: true }).click();
    await expect(page.getByRole('textbox', { name: 'Display name' })).toHaveValue('Updated name');
    await expect(page.getByRole('radio', { name: 'Robot avatar' })).toBeChecked();
    await expect(voice).toHaveText('Andromeda');
    await voice.click();
    await voiceMenu.getByRole('option', { name: 'Zeus' }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Open profile settings' }).filter({ visible: true }).click();
    await expect(voice).toHaveText('Andromeda');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await chooseSetupOption(page, 'role-select', 'backend');
    await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'backend');
    await page.screenshot({
      path: `test-results/role-catalogue-${viewport.name}.png`,
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'QA Test Engineer', exact: true })
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  });

  test(`onboarding role menu keeps its scroll position on hover on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page, { role: '', completed: false });
    await page.goto(`${baseURL}/__role-test__`);
    const select = page.getByRole('combobox', { name: 'Target role' });
    const menu = page.getByRole('listbox', { name: 'Target role' });
    await expect(select).toBeEnabled();
    await select.click();
    await expect(menu).toBeVisible();
    await menu.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));

    // Hover the exposed portion of clipped rows without Playwright scrolling them into view.
    for (const scrollTop of [22, 110]) {
      await menu.evaluate((element, top) => { element.scrollTop = top; }, scrollTop);
      for (const edge of ['bottom', 'top']) {
        const target = await menu.evaluate((element, edge) => {
          const bounds = element.getBoundingClientRect();
          const top = bounds.top + element.clientTop;
          const bottom = top + element.clientHeight;
          const option = [...element.querySelectorAll('[role="option"]')].find((option) => {
            const rect = option.getBoundingClientRect();
            return edge === 'top' ? rect.top < top && rect.bottom > top :
              rect.top < bottom && rect.bottom > bottom;
          });
          const rect = option.getBoundingClientRect();
          return {
            id: option.id,
            x: rect.left + 24,
            y: (Math.max(top, rect.top) + Math.min(bottom, rect.bottom)) / 2,
          };
        }, edge);
        await page.mouse.move(target.x, target.y);
        await expect(menu.locator('[data-active="true"]')).toHaveAttribute('id', target.id);
        expect(await menu.evaluate((element) => element.scrollTop)).toBe(scrollTop);
      }
    }

    // Switching back to keys must reveal a clipped active row, even if it is already highlighted.
    await menu.evaluate((element) => { element.scrollTop = 22; });
    const bounds = await menu.boundingBox();
    await page.mouse.move(bounds.x + 24, bounds.y + 4);
    await expect(page.getByRole('option', { name: 'Frontend Developer', exact: true })).toHaveAttribute('data-active', 'true');
    await select.press('Home');
    await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(6);
    await select.press('End');
    await expect(page.getByRole('option', { name: 'QA Test Engineer', exact: true })).toHaveAttribute('data-active', 'true');
    expect(await menu.evaluate((element) => {
      const active = element.querySelector('[data-active="true"]');
      return active.offsetTop >= element.scrollTop &&
        active.offsetTop + active.offsetHeight <= element.scrollTop + element.clientHeight;
    })).toBe(true);
  });

  test(`onboarding role menu stays anchored and supports keyboard selection on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page, { role: '', completed: false });
    await page.goto(`${baseURL}/__role-test__`);
    const select = page.getByRole('combobox', { name: 'Target role' });
    const menu = page.getByRole('listbox', { name: 'Target role' });
    const controls = page.locator('.db-onboarding__controls');
    await expect(select).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const before = await controls.boundingBox();
    await select.click();
    await expect(menu).toBeVisible();
    await expect(select).toBeFocused();
    expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).toBe('db-role-menu-reveal');
    await menu.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const menuBox = await menu.boundingBox();
    const triggerBox = await select.boundingBox();
    expect(Math.abs(menuBox.width - triggerBox.width)).toBeLessThan(1);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `test-results/onboarding-role-menu-${viewport.name}.png`, fullPage: true });

    await page.getByRole('option', { name: 'Frontend Developer', exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(select).toHaveText('Frontend Developer');
    await expect(select).toBeFocused();
    await expect(page.locator('.db-onboarding__cta')).toBeEnabled();
    expect(await controls.boundingBox()).toEqual(before);

    await select.press('ArrowDown');
    await expect(menu).toBeVisible();
    await expect(page.getByRole('option', { name: 'Frontend Developer', exact: true })).toHaveAttribute('aria-selected', 'true');
    await select.press('End');
    await expect(page.getByRole('option', { name: 'QA Test Engineer', exact: true })).toHaveAttribute('data-active', 'true');
    await expect(page.getByRole('option', { name: 'QA Test Engineer', exact: true })).toBeInViewport();
    await select.press('Home');
    await select.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Backend Developer', exact: true })).toHaveAttribute('data-active', 'true');
    await select.press('Escape');
    await expect(menu).toBeHidden();
    await expect(select).toHaveText('Frontend Developer');

    await select.pressSequentially('back');
    await expect(page.getByRole('option', { name: 'Backend Developer', exact: true })).toHaveAttribute('data-active', 'true');
    await select.press('Enter');
    await expect(select).toHaveText('Backend Developer');
    await select.press('Space');
    await expect(menu).toBeVisible();
    await select.press('Tab');
    await expect(menu).toBeHidden();
    await expect(page.locator('.db-onboarding__cta')).toBeFocused();
    expect(await controls.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`sign-out confirmation can be cancelled and routes to the landing page on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page, { completed: viewport.name === 'desktop' });
    await page.goto(`${baseURL}/__role-test__?signout`);
    const trigger = page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true });
    const dialog = page.getByRole('dialog', { name: 'Sign out of ITerview?' });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(page.getByTestId('test-location')).toHaveText('/dashboard');
    expect(await page.evaluate(() => window.__signOutTest.calls)).toBe(0);
    expect(await dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe('db-signout-enter');
    await dialog.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(16);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 16);
    await page.screenshot({ path: `test-results/signout-confirmation-${viewport.name}.png`, fullPage: true });
    const exit = await dialog.evaluate((element) => {
      element.querySelector('.db-signout-modal__button--cancel').click();
      return new Promise((resolve) => requestAnimationFrame(() => resolve({
        animation: getComputedStyle(element).animationName,
        modal: element.matches(':modal'),
        disabled: element.querySelector('.db-signout-modal__button--confirm').disabled,
      })));
    });
    expect(exit).toEqual({ animation: 'db-signout-exit', modal: true, disabled: true });
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Close confirmation' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(4, 4);
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => window.__signOutTest.calls)).toBe(0);

    await trigger.click();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('test-location')).toHaveText('/landing');
    await expect(page.locator('.lp-root')).toBeVisible();
    expect(await page.evaluate(() => window.__signOutTest.calls)).toBe(1);
    await expect(page.locator('.db-root')).toHaveCount(0);
  });
}

test('sign-out failure can be retried and pending sign-out cannot be dismissed or submitted twice', async ({ page }) => {
  await mockApi(page);
  await page.goto(`${baseURL}/__role-test__?signout`);
  await page.evaluate(() => { window.__signOutTest.fail = true; });
  await page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out of ITerview?' });
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Couldn’t sign out. Please try again.');
  await expect(page.getByTestId('test-location')).toHaveText('/dashboard');
  await page.evaluate(() => { Object.assign(window.__signOutTest, { fail: false, wait: true }); });
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.__signOutTest.calls)).toBe(2);
  await page.evaluate(() => window.__signOutTest.release());
  await expect(page.getByTestId('test-location')).toHaveText('/landing');
  await expect(page.locator('.lp-root')).toBeVisible();
});

test('sign-out confirmation respects reduced motion and keeps keyboard focus inside the dialog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.goto(`${baseURL}/__role-test__?signout`);
  const trigger = page.getByRole('button', { name: 'Sign Out', exact: true }).filter({ visible: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sign out of ITerview?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  expect(await dialog.evaluate((element) => getComputedStyle(element).animationDuration)).toBe('0.001s');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Close confirmation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.__signOutTest.calls)).toBe(0);
});

test('new-user dropdown waits for the catalogue before enabling setup', async ({ page }) => {
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  await mockApi(page, {
    role: '',
    completed: false,
    catalogueHandler: async (route) => {
      await wait;
      return route.fulfill({ json: { roles: catalogue } });
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toBeDisabled();
  await expect(page.locator('.db-onboarding__cta')).toBeDisabled();
  await expect(page.getByText('Loading target roles…', { exact: true })).toBeVisible();
  release();
  await expect(page.locator('#role-select')).toBeEnabled();
  await page.getByRole('combobox', { name: 'Target role' }).click();
  await page.getByRole('option', { name: 'QA Test Engineer', exact: true }).click();
  await expect(page.locator('.db-onboarding__cta')).toBeEnabled();
});

test('onboarding role menu respects reduced motion and closes on outside clicks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, { role: '', completed: false });
  await page.goto(`${baseURL}/__role-test__`);
  const select = page.getByRole('combobox', { name: 'Target role' });
  await expect(select).toBeEnabled();
  await select.click();
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('heading', { name: 'Find your starting point' }).click();
  await expect(menu).toBeHidden();
  await expect(select).toHaveText('Select a role...');
});

test('onboarding preserves unavailable saved roles and prevents selecting them', async ({ page }) => {
  await mockApi(page, { role: 'retired-role', completed: false });
  await page.goto(`${baseURL}/__role-test__`);
  const select = page.getByRole('combobox', { name: 'Target role' });
  await expect(select).toHaveText('Retired Role (unavailable)');
  await expect(select).toHaveAttribute('aria-invalid', 'true');
  await select.click();
  const unavailable = page.getByRole('option', { name: 'Retired Role (unavailable)' });
  await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  await unavailable.click({ force: true });
  await expect(select).toHaveText('Retired Role (unavailable)');
  await expect(page.locator('.db-onboarding__cta')).toBeDisabled();
  await page.getByRole('option', { name: 'Backend Developer', exact: true }).click();
  await expect(select).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.db-onboarding__cta')).toBeEnabled();
});

test('dashboard shares its catalogue with Practice Again and retries a failed load', async ({ page }) => {
  let attempts = 0;
  const retryCatalogue = catalogue.map(role => role.id === 'frontend'
    ? { ...role, label: 'Frontend catalogue label' } : role);
  await mockApi(page, {
    catalogueHandler: (route) => {
      attempts++;
      return route.fulfill(
        attempts === 1 ? { status: 503, json: {} } : { json: { roles: retryCatalogue } }
      );
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.getByRole('button', { name: 'Retry loading roles' })).toBeVisible();
  await expect(page.locator('#role-select')).toBeDisabled();
  await expect(page.locator('#btn-start-pretest')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry loading roles' }).click();
  await expect(page.locator('#role-select')).toBeEnabled();
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
  expect(attempts).toBe(2);
  await page.getByRole('tab', { name: 'Practice Again', exact: true }).click();
  await expect(page.locator('#tabpanel-practice-again')).toBeVisible();
  await expect(page.locator('#tabpanel-practice-again')).toContainText('Frontend catalogue label');
  expect(attempts).toBe(2);
});

test('an unavailable saved role is preserved but cannot launch new practice', async ({ page }) => {
  await mockApi(page, { roles: catalogue.filter((role) => role.id !== 'frontend') });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'frontend');
  await page.locator('#role-select').click();
  await expect(page.locator('[role="option"][data-value="frontend"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#btn-start-pretest')).toBeDisabled();
  await expect(page.getByText(/Your saved target role is unavailable/)).toBeVisible();
  await chooseSetupOption(page, 'role-select', 'qa-test');
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
});

test('dashboard preserves the prepared launch marker when entering another practice run', async ({ page }) => {
  await mockApi(page, { active: { nextStage: 'complete' } });
  let socket;
  let launchId;
  await page.routeWebSocket(/\/ws\/set1/, ws => {
    socket = ws;
    launchId = new URL(ws.url()).searchParams.get('launch');
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
  await page.locator('#btn-start-pretest').click();
  await page.getByRole('button', { name: 'Start Practice Studio' }).click();
  await expect.poll(() => launchId).toMatch(/^[a-z0-9-]{36}$/);
  socket.send(JSON.stringify({ type: 'generation_complete', role: 'frontend' }));
  await page.getByRole('button', { name: 'Enter Studio' }).click();
  await expect(page.getByTestId('test-location')).toContainText(`launch=${launchId}`);
});

for (const mode of ['diagnostic', 'practice']) {
  test(`start fresh stays unlocked after refresh and prepares a new ${mode} run`, async ({ page }) => {
    await mockApi(page);
    let active = {
      hasActiveSession: true, hasResumableSession: true, nextStage: 'mainsets',
      activeSet: 2, answersCount: 2, totalQuestions: 5, mode,
    };
    const resetState = mode === 'diagnostic'
      ? { hasActiveSession: false, hasResumableSession: false, nextStage: 'mainsets',
          activeSet: 1, answersCount: 0, totalQuestions: 5, sessionId: null, mode }
      : { hasActiveSession: false, hasResumableSession: false, nextStage: 'complete' };
    await page.route('**/api/users/active-practice-session?*', route => route.fulfill({ json: active }));
    await page.route('**/api/users/reset-practice-session', route => {
      expect(route.request().postDataJSON()).toEqual({ firebaseUid: 'registry-browser-user' });
      active = resetState;
      return route.fulfill({ json: { activeSession: active } });
    });
    let socket;
    let socketUrl;
    await page.routeWebSocket(/\/ws\/set1/, ws => { socket = ws; socketUrl = new URL(ws.url()); });
    await page.goto(`${baseURL}/__role-test__`);
    await expect(page.locator('#role-select')).toBeDisabled();
    await page.getByRole('button', { name: 'Start Fresh Session', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, discard session', exact: true }).click();
    await expect(page.locator('#role-select')).toBeEnabled();
    await expect(page.locator('.db-resume-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#role-select')).toBeEnabled();
    await expect(page.locator('.db-resume-banner')).toHaveCount(0);
    await chooseSetupOption(page, 'role-select', 'backend');
    await page.locator('#btn-start-pretest').click();
    await expect(page.getByTestId('test-location')).toHaveText('/dashboard');
    await page.getByRole('button', { name: 'Start Practice Studio' }).click();
    await expect.poll(() => socketUrl?.searchParams.get('mode')).toBe(mode);
    const launchId = socketUrl.searchParams.get('launch');
    expect(launchId).toMatch(/^[a-z0-9-]{36}$/);
    socket.send(JSON.stringify({ type: 'generation_complete', role: 'backend' }));
    await page.getByRole('button', { name: 'Enter Studio' }).click();
    await expect(page.getByTestId('test-location')).toContainText(`/interview?set=1&mode=${mode}`);
    await expect(page.getByTestId('test-location')).toContainText(`launch=${launchId}`);
  });
}

test('failed discard keeps the saved session available', async ({ page }) => {
  await mockApi(page, { active: { hasActiveSession: true, hasResumableSession: true,
    nextStage: 'mainsets', activeSet: 1, answersCount: 2, mode: 'practice' } });
  await page.route('**/api/users/reset-practice-session', route => route.fulfill({ status: 500, json: {} }));
  await page.goto(`${baseURL}/__role-test__`);
  await page.getByRole('button', { name: 'Start Fresh Session', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, discard session', exact: true }).click();
  await expect(page.getByText("Couldn't discard the session. Check your connection and try again.")).toBeVisible();
  await expect(page.locator('#role-select')).toBeDisabled();
  await page.reload();
  await expect(page.locator('.db-resume-banner')).toBeVisible();
});

for (const width of [1440, 768, 390, 320]) {
  test(`saved-question role and set filters stay aligned at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    if (width === 320) await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.goto(`${baseURL}/__role-test__`);
    await page.getByRole('tab', { name: 'Practice Again', exact: true }).click();
    const screen = page.locator('.pa-screen');
    const role = screen.getByRole('combobox', { name: 'Filter saved questions by role' });
    const sets = screen.getByRole('group', { name: 'Interview set' });
    await expect(screen.locator('.pa-question')).toHaveCount(8);
    await expect(role.locator('option')).toHaveText([
      'All roles (8)', 'Backend Developer (2)', 'Frontend Developer (4)', 'Fullstack Developer (2)',
    ]);
    await page.addStyleTag({ url: `${baseURL}/fonts/fonts.css` });
    await page.evaluate(() => document.fonts.ready);
    await screen.screenshot({ path: `test-results/saved-questions-${width}.png` });
    const geometry = await sets.locator('button').evaluateAll(buttons => buttons.map(button => {
      const bounds = button.getBoundingClientRect();
      return { x: bounds.x, right: bounds.right, height: bounds.height };
    }));
    expect(geometry.every(button => button.height >= 44 && button.x >= 0 && button.right <= width)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await role.selectOption('backend');
    await expect(screen.locator('.pa-question')).toHaveCount(2);
    await expect(sets.getByRole('button', { name: 'All sets, 2 questions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await sets.getByRole('button', { name: 'Set 3, 1 question', exact: true }).click();
    await expect(screen.locator('.pa-question')).toHaveCount(1);
    await expect(screen.locator('.pa-question__role')).toHaveText('Backend Developer');
    await expect(screen.locator('.pa-library__footer')).toContainText('Backend Developer');
    await screen.getByRole('button', { name: /^Practice: Tell me about a time/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Practice again', exact: true });
    await expect(dialog.locator('.pa-dialog__meta')).toContainText('Backend Developer');
    await expect(dialog.locator('.pa-dialog__meta')).toContainText('Set 3 · Behavioral');
    const close = dialog.getByRole('button', { name: 'Close practice dialog', exact: true });
    await expect(close).toBeFocused();
    await expect(dialog.getByText('One question · Voice practice', { exact: true })).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
    const layout = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const question = element.querySelector('.pa-dialog__question').getBoundingClientRect();
      const coaching = element.querySelector('.pa-dialog__coaching').getBoundingClientRect();
      return { x: bounds.x, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
        scrollOverflow: element.scrollWidth > element.clientWidth,
        sideBySide: Math.abs(question.top - coaching.top) < 1 };
    });
    expect(layout.x).toBeGreaterThanOrEqual(15);
    expect(layout.right).toBeLessThanOrEqual(width - 15);
    expect(layout.top).toBeGreaterThanOrEqual(19);
    expect(layout.bottom).toBeLessThanOrEqual((width < 500 ? 844 : 1000) - 19);
    expect(layout.scrollOverflow).toBe(false);
    expect(layout.sideBySide).toBe(width > 640);
    await page.screenshot({ path: `test-results/practice-dialog-${width}.png` });
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Start practice', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(screen.getByRole('button', { name: /^Practice: Tell me about a time/ })).toBeFocused();
    await role.selectOption('frontend');
    await expect(screen.getByRole('heading', { name: 'No matching questions' })).toBeVisible();
    await screen.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(role).toHaveValue('all');
    await expect(screen.locator('.pa-question')).toHaveCount(8);
    await screen.getByRole('searchbox').fill('Fullstack Developer');
    await expect(screen.locator('.pa-question')).toHaveCount(2);
    await expect(screen.locator('.pa-question__role')).toHaveText(['Fullstack Developer', 'Fullstack Developer']);
  });
}

test('removing a role’s last saved question preserves its filter and supports Undo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.goto(`${baseURL}/__role-test__`);
  await page.getByRole('tab', { name: 'Practice Again', exact: true }).click();
  const screen = page.locator('.pa-screen');
  const role = screen.getByRole('combobox', { name: 'Filter saved questions by role' });
  await role.selectOption('backend');
  await screen.getByRole('button', { name: /^Remove saved question:/ }).first().click();
  await expect(screen.locator('.pa-question')).toHaveCount(1);
  await screen.getByRole('button', { name: /^Remove saved question:/ }).first().click();
  await expect(screen.getByRole('heading', { name: 'No matching questions' })).toBeVisible();
  await expect(role).toHaveValue('backend');
  await expect(role.locator('option:checked')).toHaveText('Backend Developer (0)');
  await screen.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(screen.locator('.pa-question')).toHaveCount(1);
  await expect(role.locator('option:checked')).toHaveText('Backend Developer (1)');
});

test('existing practice can resume during a catalogue outage without saving a role', async ({
  page,
}) => {
  let saves = 0;
  await mockApi(page, {
    active: {
      hasActiveSession: true,
      hasResumableSession: true,
      nextStage: 'mainsets',
      activeSet: 2,
      mode: 'practice',
    },
    catalogueHandler: (route) => route.fulfill({ status: 503, json: {} }),
    onSave: () => {
      saves++;
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#btn-start-pretest')).toBeEnabled();
  await page.locator('#btn-start-pretest').click();
  await expect(page.getByTestId('test-location')).toContainText('/interview?set=2');
  expect(saves).toBe(0);
});

test('a rejected role save keeps onboarding on the dashboard', async ({ page }) => {
  await mockApi(page, { completed: false, active: { nextStage: 'likert-pre' }, saveStatus: 400 });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toBeEnabled();
  await page.locator('.db-onboarding__cta').click();
  await expect(page.getByText('Couldn’t save your target role. Please try again.')).toBeVisible();
  await expect(page.getByTestId('test-location')).toHaveText('/dashboard');
});

test('profile edits preserve active session settings', async ({ page }) => {
  let saved;
  await mockApi(page, {
    role: 'backend',
    active: { hasActiveSession: true, nextStage: 'mainsets', activeSet: 2, answersCount: 1, role: 'backend' },
    onSave: body => { saved = body; },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.locator('#role-select')).toBeDisabled();
  await page.getByRole('button', { name: 'Open profile settings' }).filter({ visible: true }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('New name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saved).not.toHaveProperty('role');
  expect(saved).not.toHaveProperty('focusArea');
  expect(saved).not.toHaveProperty('difficulty');
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'backend');
  await expect(page.locator('#role-select')).toBeDisabled();
});

test('failed profile save keeps edits available for retry', async ({ page }) => {
  await mockApi(page, { saveStatus: 500 });
  await page.goto(`${baseURL}/__role-test__`);
  await page.getByRole('button', { name: 'Open profile settings' }).filter({ visible: true }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Retry name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Please try again');
  await expect(page.getByRole('textbox', { name: 'Display name' })).toHaveValue('Retry name');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'frontend');
});

test('profile-only edits during an outage preserve the saved role', async ({ page }) => {
  let saved;
  await mockApi(page, {
    catalogueHandler: (route) => route.fulfill({ status: 503, json: {} }),
    onSave: (body) => {
      saved = body;
    },
  });
  await page.goto(`${baseURL}/__role-test__`);
  await expect(page.getByRole('button', { name: 'Retry loading roles' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Open profile settings' })
    .filter({ visible: true })
    .click();
  await expect(page.locator('#modal-role, #modal-focus')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Display name' }).fill('Updated test name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saved.displayName).toBe('Updated test name');
  expect(saved).not.toHaveProperty('role');
  await expect(page.locator('#role-select')).toHaveAttribute('data-value', 'frontend');
});

for (const [currentTier, nextTier] of [
  ['easy', 'medium'],
  ['medium', 'hard'],
]) {
  test(`dashboard enables newly unlocked ${nextTier} on the first load`, async ({ page }) => {
    await mockApi(page);
    let tier = currentTier;
    let summaryRequests = 0;
    const profileTiers = [];
    let release;
    const summaryGate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route('**/api/users/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/users/results-summary') {
        summaryRequests++;
        await summaryGate;
        // Simulate the backend persisting the upgrade before responding.
        tier = nextTier;
        return route.fulfill({
          json: {
            unlocked: true,
            unlockThreshold: 75,
            nextDifficulty: nextTier,
            preTestScore: 80,
            threeCBreakdown: { clarity: 4, correctness: 4, completeness: 4 },
          },
        });
      }
      if (pathname === '/api/users/registry-browser-user') {
        profileTiers.push(tier);
        return route.fulfill({
          json: {
            user: {
              role: 'frontend',
              displayName: 'Test User',
              focusArea: 'auto',
              unlockedDifficulty: tier,
            },
            hasCompletedDiagnostic: true,
          },
        });
      }
      return route.fallback();
    });
    await page.goto(`${baseURL}/__role-test__`);
    await expect.poll(() => summaryRequests).toBeGreaterThan(0);
    expect(profileTiers).toEqual([]);
    release();
    const difficulty = page.locator('#difficulty-select');
    await expect(difficulty).toBeEnabled();
    await difficulty.click();
    await expect(page.locator(`[role="option"][data-value="${nextTier}"]`)).not.toHaveAttribute('aria-disabled', 'true');
    if (nextTier === 'medium')
      await expect(page.locator('[role="option"][data-value="hard"]')).toHaveAttribute('aria-disabled', 'true');
    await chooseSetupOption(page, 'difficulty-select', nextTier);
    await expect(difficulty).toHaveAttribute('data-value', nextTier);
    expect(profileTiers.length).toBeGreaterThan(0);
    expect(profileTiers.every((value) => value === nextTier)).toBe(true);
  });
}
