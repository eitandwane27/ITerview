// Runs the real Firebase client against intercepted responses. No real accounts,
// email messages, database writes, or provider calls are made by this test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const projectId = 'mock-school-project';
const root = process.env.AUTH_TEST_BASE_URL || 'http://127.0.0.1:5179';
process.chdir(path.resolve(__dirname, '../..'));

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    async function scenario({ email = 'student@spcba.edu.ph', failSend = false, verified = false, mode = 'register', acceptTerms = true, failSync = false, stallSync = false, holdDashboard = false, dashboardError = false, invalidPassword = false, reducedMotion = 'no-preference', viewport = { width: 1280, height: 900 } } = {}) {
      const context = await browser.newContext({ viewport, reducedMotion });
      const state = { email, verified, signups: 0, sent: 0, syncs: 0, failSend, failSync, stallSync, holdDashboard, dashboardError, dashboardReleases: [], lookups: 0, tokenRefreshes: 0, loads: {} };
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const token = () => {
        const now = Math.floor(Date.now() / 1000);
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        return `${encode({ alg: 'RS256', kid: 'synthetic-test-key' })}.${encode({ iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: 'browser-school-test', user_id: 'browser-school-test', iat: now, exp: now + 3600, auth_time: now, email: state.email, email_verified: state.verified, firebase: { sign_in_provider: 'password', identities: { email: [state.email] } } })}.synthetic-test-signature`;
      };
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.hostname === 'identitytoolkit.googleapis.com') {
          if (url.pathname.endsWith('accounts:signUp') || url.pathname.endsWith('accounts:signInWithPassword')) {
            if (invalidPassword) return json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400);
            if (url.pathname.endsWith('accounts:signUp')) state.signups++;
            state.email = route.request().postDataJSON().email;
            return json({ localId: 'browser-school-test', email: state.email, idToken: token(), refreshToken: 'synthetic-refresh', expiresIn: '3600' });
          }
          if (url.pathname.endsWith('accounts:lookup')) {
            state.lookups++;
            return json({ users: [{ localId: 'browser-school-test', email: state.email, emailVerified: state.verified, passwordHash: 'synthetic', providerUserInfo: [{ providerId: 'password', email: state.email, rawId: state.email }], createdAt: '1600000000000', lastLoginAt: '1600000000000' }] });
          }
          if (url.pathname.endsWith('accounts:sendOobCode')) {
            if (state.failSend) return json({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }, 400);
            state.sent++;
            return json({ email: state.email });
          }
          return json({});
        }
        if (url.hostname === 'securetoken.googleapis.com') {
          state.tokenRefreshes++;
          return json({ access_token: token(), id_token: token(), expires_in: '3600', refresh_token: 'synthetic-refresh', user_id: 'browser-school-test', project_id: projectId, token_type: 'Bearer' });
        }
        if (url.pathname.startsWith('/api/users')) {
          if (!state.verified || !route.request().headers().authorization) return json({ message: 'Verify your school email before continuing.' }, 403);
          if (url.pathname.endsWith('/login')) {
            state.syncs++;
            if (state.stallSync) return;
            // Keep the sync pending while both sign-in callbacks run.
            await new Promise(resolve => setTimeout(resolve, 200));
            if (state.failSync) return json({ message: 'Test backend unavailable. Please try again.' }, 503);
            return json({ user: { firebaseUid: 'browser-school-test', email: state.email } });
          }
          state.loads[url.pathname] = (state.loads[url.pathname] || 0) + 1;
          if (state.holdDashboard) await new Promise(resolve => state.dashboardReleases.push(resolve));
          if (state.dashboardError) return json({ message: 'Test dashboard unavailable.' }, 503);
          return json({ user: { firebaseUid: 'browser-school-test', email: state.email, role: 'frontend', confidenceScore: null }, active: false, hasActiveSession: false, journey: { nextStep: 'likert-pre' } });
        }
        if (url.pathname === '/api/recommendations/roles') return json({ roles: [{ id: 'frontend', label: 'Frontend Developer', setSupport: {} }] });
        if (url.hostname !== '127.0.0.1') return route.abort();
        return route.continue();
      });
      await page.goto(root + '/' + mode);
      await page.waitForTimeout(800);
      if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
      await page.getByLabel('School email address').fill(email);
      await page.getByLabel('Password', { exact: true }).fill('SyntheticPassword123!');
      if (mode === 'register') await page.getByLabel('Confirm password', { exact: true }).fill('SyntheticPassword123!');
      if (mode === 'register' && acceptTerms) await page.getByRole('checkbox').check();
      return { page, context, state, errors };
    }

    const login = await scenario({ verified: true, mode: 'login' });
    const loginStarted = Date.now();
    await login.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await login.page.waitForURL('**/dashboard');
    await login.page.getByRole('heading', { name: 'Find your starting point' }).waitFor();
    assert.equal(await login.page.getByTestId('sign-in-transition').count(), 0);
    assert.ok(Date.now() - loginStarted >= 3000, 'Fast sign-in should leave time for live progress and the success beat');
    assert.equal(await login.page.evaluate(() => document.documentElement.style.overflow), '');
    assert.equal(await login.page.locator('[inert]').count(), 0, 'Dashboard must be usable after the reveal');
    assert.equal(login.state.syncs, 1, 'Sign-in must share one backend sync');
    assert.equal(login.state.tokenRefreshes, 0, 'Fresh sign-in must reuse its Firebase token');
    assert.equal(login.state.lookups, 1, 'Only Firebase sign-in itself should look up the account');
    assert.deepEqual(login.state.loads, {
      '/api/users/results-summary': 1,
      '/api/users/active-practice-session': 1,
      '/api/users/browser-school-test': 1,
    }, 'Dashboard must load each resource once');
    assert.deepEqual(login.errors, []);
    await login.context.close();
    console.log('PASS verified sign-in shares one sync, reuses fresh credentials and loads dashboard once');

    const loadingDashboard = await scenario({ verified: true, mode: 'login', holdDashboard: true });
    await loadingDashboard.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await loadingDashboard.page.waitForURL('**/dashboard');
    await loadingDashboard.page.locator('[data-testid="sign-in-transition"][data-phase="dashboard"]').waitFor();
    const bar = loadingDashboard.page.getByRole('progressbar', { name: 'Sign-in progress' });
    assert.equal(await bar.getAttribute('aria-valuenow'), null, 'Pending progress must not claim a percentage');
    const sweep = loadingDashboard.page.locator('.sit-progress__sweep');
    const initialTransform = await sweep.evaluate(element => getComputedStyle(element).transform);
    await loadingDashboard.page.waitForTimeout(180);
    assert.notEqual(await sweep.evaluate(element => getComputedStyle(element).transform), initialTransform, 'Progress must keep moving while data is pending');
    assert.equal(await loadingDashboard.page.locator('[inert]').count(), 1);
    loadingDashboard.state.holdDashboard = false;
    loadingDashboard.state.dashboardReleases.forEach(release => release());
    await loadingDashboard.page.getByTestId('sign-in-transition').waitFor({ state: 'detached' });
    await loadingDashboard.page.getByRole('heading', { name: 'Find your starting point' }).waitFor();
    assert.deepEqual(loadingDashboard.errors, []);
    await loadingDashboard.context.close();
    console.log('PASS progress stays animated until dashboard data arrives and then releases the page');

    const badPassword = await scenario({ verified: true, mode: 'login', invalidPassword: true });
    await badPassword.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await badPassword.page.getByRole('alert').filter({ hasText: 'Invalid email or password' }).waitFor();
    assert.equal(await badPassword.page.getByTestId('sign-in-transition').count(), 0);
    assert.equal(await badPassword.page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true);
    await badPassword.context.close();
    console.log('PASS incorrect credentials return to the usable sign-in form');

    const unverifiedLogin = await scenario({ mode: 'login' });
    await unverifiedLogin.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await unverifiedLogin.page.waitForURL('**/verify-email');
    await unverifiedLogin.page.getByRole('heading', { name: 'Verify your school email' }).waitFor();
    assert.equal(await unverifiedLogin.page.getByTestId('sign-in-transition').count(), 0);
    assert.equal(unverifiedLogin.state.syncs, 0);
    await unverifiedLogin.context.close();
    console.log('PASS unverified sign-in exits the animation and preserves the verification gate');

    const unavailableDashboard = await scenario({ verified: true, mode: 'login', dashboardError: true });
    await unavailableDashboard.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await unavailableDashboard.page.waitForURL('**/dashboard');
    await unavailableDashboard.page.getByTestId('sign-in-transition').waitFor({ state: 'detached' });
    await unavailableDashboard.page.getByRole('button', { name: 'Retry' }).first().waitFor();
    assert.equal(await unavailableDashboard.page.locator('[inert]').count(), 0);
    await unavailableDashboard.context.close();
    console.log('PASS dashboard errors dismiss the transition and expose retry');

    const reduced = await scenario({ verified: true, mode: 'login', holdDashboard: true, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await reduced.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await reduced.page.waitForURL('**/dashboard');
    await reduced.page.getByTestId('sign-in-transition').waitFor();
    assert.equal(await reduced.page.locator('.sit-mascot-float').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await reduced.page.locator('.sit-progress__sweep').evaluate(element => getComputedStyle(element).display), 'none');
    assert.equal(await reduced.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    reduced.state.holdDashboard = false;
    reduced.state.dashboardReleases.forEach(release => release());
    await reduced.page.getByTestId('sign-in-transition').waitFor({ state: 'detached' });
    await reduced.context.close();
    console.log('PASS mobile reduced-motion users get a stable, usable transition');

    const failedLogin = await scenario({ verified: true, mode: 'login', failSync: true });
    await failedLogin.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await failedLogin.page.getByRole('alert').filter({ hasText: 'Test backend unavailable' }).waitFor();
    assert.ok(failedLogin.page.url().endsWith('/login'));
    assert.deepEqual(failedLogin.state.loads, {}, 'Failed access checks must not mount the dashboard');
    failedLogin.state.failSync = false;
    await failedLogin.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await failedLogin.page.waitForURL('**/dashboard');
    await failedLogin.page.getByRole('heading', { name: 'Find your starting point' }).waitFor();
    assert.deepEqual(failedLogin.errors, []);
    await failedLogin.context.close();
    console.log('PASS failed backend sync blocks access and can be retried');

    const stalledLogin = await scenario({ verified: true, mode: 'login', stallSync: true });
    await stalledLogin.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await stalledLogin.page.getByRole('alert').filter({ hasText: 'The server is taking too long' }).waitFor();
    assert.equal(stalledLogin.state.syncs, 1);
    assert.deepEqual(stalledLogin.state.loads, {});
    stalledLogin.state.stallSync = false;
    await stalledLogin.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await stalledLogin.page.waitForURL('**/dashboard');
    assert.equal(stalledLogin.state.syncs, 2);
    assert.deepEqual(stalledLogin.errors, []);
    await stalledLogin.context.close();
    console.log('PASS stalled login sync times out with a retryable error');

    const invalid = await scenario({ email: 'student@spcba.edu.ph.fake.com' });
    await invalid.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await invalid.page.getByRole('alert').filter({ hasText: 'Please use your @spcba.edu.ph school email.' }).waitFor();
    assert.equal(invalid.state.signups, 0);
    assert.equal(await invalid.page.getByRole('button', { name: /Continue with (Google|GitHub)/ }).count(), 0);
    await invalid.context.close();
    console.log('PASS invalid domain rejected before signup; social providers removed');

    const modal = await scenario();
    await modal.page.goto(root + '/landing');
    await modal.page.getByRole('banner').getByRole('button', { name: 'Start practicing free', exact: true }).click();
    const signupDialog = modal.page.getByRole('dialog');
    await modal.page.waitForFunction(() => document.activeElement?.id === 'am-email');
    await signupDialog.getByLabel('School email address').fill('student@spcba.edu.ph');
    await signupDialog.getByLabel('Password', { exact: true }).fill('SyntheticPassword123!');
    await signupDialog.getByLabel('Confirm password', { exact: true }).fill('SyntheticPassword123!');
    const [modalTerms] = await Promise.all([
      modal.context.waitForEvent('page'),
      signupDialog.getByRole('link', { name: 'Terms and Conditions', exact: true }).click(),
    ]);
    await modalTerms.getByRole('heading', { name: 'Terms and Conditions', exact: true }).waitFor();
    assert.equal(await signupDialog.isVisible(), true, 'Opening terms must leave the modal open');
    assert.equal(await signupDialog.getByLabel('Password', { exact: true }).inputValue(), 'SyntheticPassword123!');
    assert.equal(await signupDialog.getByRole('checkbox').isChecked(), false, 'Clicking the terms link must not toggle the checkbox');
    await modalTerms.close();
    await modal.page.screenshot({ path: 'output/auth-terms-modal-desktop.png' });
    await modal.page.setViewportSize({ width: 390, height: 844 });
    await modal.page.screenshot({ path: 'output/auth-terms-modal-mobile.png' });
    await modal.page.setViewportSize({ width: 1280, height: 900 });
    await signupDialog.getByRole('checkbox').check();
    await signupDialog.getByRole('button', { name: 'Close modal' }).click();
    await modal.page.getByRole('banner').getByRole('button', { name: 'Start practicing free', exact: true }).click();
    assert.equal(await signupDialog.getByRole('checkbox').isChecked(), false, 'Reopening the modal must reset acceptance');
    await modal.context.close();
    console.log('PASS modal terms link preserves form entries without dismissing or accepting the modal');

    const flow = await scenario({ acceptTerms: false });
    const agreement = flow.page.getByRole('checkbox', { name: 'I have read and agree to the Terms and Conditions', exact: true });
    assert.equal(await agreement.isChecked(), false);
    await flow.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await flow.page.getByRole('alert').filter({ hasText: 'Please read and accept the Terms and Conditions' }).waitFor();
    assert.equal(flow.state.signups, 0, 'Unchecked terms must block Firebase signup');
    assert.equal(await agreement.evaluate(element => element === document.activeElement), true);
    const termsLink = flow.page.getByRole('link', { name: 'Terms and Conditions', exact: true });
    assert.equal(await termsLink.getAttribute('target'), '_blank');
    assert.equal(await termsLink.getAttribute('rel'), 'noopener noreferrer');
    await termsLink.focus();
    const [termsPage] = await Promise.all([
      flow.context.waitForEvent('page'),
      termsLink.press('Enter'),
    ]);
    await termsPage.waitForURL('**/terms-and-conditions');
    await termsPage.getByRole('heading', { name: 'Terms and Conditions', exact: true }).waitFor();
    await termsPage.getByRole('heading', { name: 'Responsible use' }).waitFor();
    assert.equal(await termsPage.evaluate(() => window.opener === null), true);
    assert.ok(flow.page.url().endsWith('/register'));
    assert.equal(await flow.page.getByLabel('School email address').inputValue(), 'student@spcba.edu.ph');
    assert.equal(await flow.page.getByLabel('Password', { exact: true }).inputValue(), 'SyntheticPassword123!');
    assert.equal(await flow.page.getByLabel('Confirm password', { exact: true }).inputValue(), 'SyntheticPassword123!');
    assert.equal(await agreement.isChecked(), false, 'Reading terms must not accept them');
    await termsPage.screenshot({ path: 'output/terms-page-desktop.png', fullPage: true });
    await flow.page.screenshot({ path: 'output/auth-terms-desktop.png', fullPage: true });
    await termsPage.setViewportSize({ width: 390, height: 844 });
    await termsPage.screenshot({ path: 'output/terms-page-mobile.png', fullPage: true });
    assert.equal(await termsPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await termsPage.reload();
    await termsPage.getByRole('heading', { name: 'Terms and Conditions', exact: true }).waitFor();
    await termsPage.close();
    await flow.page.setViewportSize({ width: 390, height: 844 });
    await flow.page.screenshot({ path: 'output/auth-terms-mobile.png', fullPage: true });
    assert.equal(await flow.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await agreement.check();
    assert.equal(await flow.page.locator('#am-terms-error').count(), 0);
    await flow.page.getByRole('button', { name: 'Sign in →', exact: true }).click();
    assert.equal(await flow.page.getByRole('checkbox').count(), 0, 'Sign-in must not require terms');
    await flow.page.getByRole('button', { name: 'Create one →', exact: true }).click();
    assert.equal(await agreement.isChecked(), false, 'Switching modes must reset acceptance');
    await flow.page.getByLabel('Password', { exact: true }).fill('SyntheticPassword123!');
    await flow.page.getByLabel('Confirm password', { exact: true }).fill('SyntheticPassword123!');
    await agreement.check();
    console.log('PASS terms open in a separate tab, preserve all signup inputs, support keyboards and mobile, and require explicit acceptance');
    await flow.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await flow.page.waitForURL('**/verify-email');
    await flow.page.getByRole('heading', { name: 'Verify your school email' }).waitFor();
    assert.equal(flow.state.sent, 1);
    assert.equal(flow.state.syncs, 0);
    await flow.page.screenshot({ path: 'output/verify-email-desktop.png', fullPage: true });
    await flow.page.getByRole('button', { name: 'I’ve verified my email' }).click();
    await flow.page.getByRole('alert').filter({ hasText: 'Your email is still unverified.' }).waitFor();
    await flow.page.goto(root + '/dashboard');
    await flow.page.waitForURL('**/verify-email');
    await flow.page.getByRole('heading', { name: 'Verify your school email' }).waitFor();
    assert.equal(flow.state.syncs, 0);
    assert.equal(await flow.page.getByRole('button', { name: /Resend email in/ }).isDisabled(), true);
    await flow.page.getByRole('button', { name: 'I’ve verified my email' }).click();
    await flow.page.getByRole('alert').filter({ hasText: 'Your email is still unverified.' }).waitFor();
    flow.state.verified = true;
    await flow.page.getByRole('button', { name: 'I’ve verified my email' }).click();
    await flow.page.waitForURL('**/dashboard');
    assert.ok(flow.state.syncs >= 1);
    assert.ok(flow.state.tokenRefreshes >= 1, 'Explicit verification must refresh token claims');
    await flow.page.reload();
    await flow.page.getByText('Checking your school account…').waitFor({ state: 'hidden' });
    assert.ok(flow.page.url().endsWith('/dashboard'));
    assert.deepEqual(flow.errors, []);
    await flow.context.close();
    console.log('PASS signup -> verification, unverified block, refresh, cooldown, verified access and token-bearing API sync');

    const retry = await scenario({ failSend: true, viewport: { width: 390, height: 844 } });
    await retry.page.getByRole('button', { name: 'Create account', exact: true }).click();
    await retry.page.waitForURL('**/verify-email');
    await retry.page.getByRole('alert').filter({ hasText: 'Your account was created' }).waitFor();
    assert.equal(retry.state.syncs, 0);
    retry.state.failSend = false;
    await retry.page.getByRole('button', { name: 'Resend verification email', exact: true }).click();
    await retry.page.getByRole('status').filter({ hasText: 'Verification email sent.' }).waitFor();
    assert.equal(retry.state.sent, 1);
    await retry.page.screenshot({ path: 'output/verify-email-mobile.png', fullPage: true });
    assert.equal(await retry.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await retry.page.getByRole('button', { name: 'Sign out to use another account' }).click();
    await retry.page.waitForURL('**/login');
    assert.deepEqual(retry.errors, []);
    await retry.context.close();
    console.log('PASS send failure recovery, resend, mobile layout and sign out');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
