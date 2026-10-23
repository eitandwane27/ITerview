import { test, expect } from 'playwright/test';
import { voiceWorkspaceServer } from './fixtures/voiceWorkspaceServer.mjs';
let preview;
test.beforeAll(async () => {
  preview = await voiceWorkspaceServer();
});
test.afterAll(async () => {
  await preview?.close();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]) {
  test(`show-me examples drive the real workspace event flow at ${viewport.width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto(preview.baseURL);
    const start = await page.getByRole('button', { name: 'Start voice session' }).boundingBox();
    expect(start.y).toBeGreaterThanOrEqual(0);
    expect(start.y + start.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: `test-results/nikki-idle-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole('heading', { name: 'Set 2 · Technical' })).toBeVisible();
    await expect(workspace.locator('.va-workspace__score')).toContainText('76');
    await expect(workspace.getByText('Accuracy', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
    const first = await workspace.locator('.va-workspace__body > div').getAttribute('style');
    expect(first).not.toContain('NaN');
    await page.screenshot({
      path: `test-results/nikki-scores-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Show me my Set 2 feedback', exact: true }).click();
    await expect(workspace.getByText('Question 2', { exact: true })).toBeVisible();
    await expect(workspace.getByText(/An index speeds up reads/)).toBeVisible();
    await page
      .getByRole('button', {
        name: 'Show me my last two attempts for my selected role',
        exact: true,
      })
      .click();
    await expect(workspace.getByText('Attempt 3', { exact: true })).toBeVisible();
    await expect(workspace.getByText('Attempt 5', { exact: true })).toBeVisible();
    await expect(workspace.locator('.va-workspace__difference')).toContainText('+14');
    await page.getByRole('button', { name: 'Show me a STAR outline', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: 'Situation', exact: true })).toBeVisible();
    await expect(workspace.getByText('Tell Nikki this part', { exact: true })).toHaveCount(4);
    await expect(workspace.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/nikki-star-${viewport.width}.png`,
      fullPage: true,
    });
    await workspace.getByRole('button', { name: 'Close workspace' }).press('Escape');
    const stagePositions = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          const startAt = performance.now();
          function sample() {
            samples.push(document.querySelector('.va-stage').getBoundingClientRect().top);
            if (performance.now() - startAt < 400) requestAnimationFrame(sample);
            else resolve(samples);
          }
          requestAnimationFrame(sample);
        })
    );
    expect(Math.min(...stagePositions)).toBeGreaterThanOrEqual(0);
    await expect(workspace).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Show me a STAR outline', exact: true })
    ).toBeFocused();
    await page
      .getByRole('button', { name: 'Show me how to improve completeness', exact: true })
      .click();
    await expect(workspace.getByRole('button', { name: 'Start practice' })).toBeVisible();
    await workspace.getByRole('button', { name: 'Start practice' }).click();
    await expect(page.getByTestId('practice-destination')).toHaveText(
      '/interview?set=1&mode=drill&focusArea=completeness'
    );
    expect(errors).toEqual([]);
  });
}

test('empty accounts show honest missing results and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${preview.baseURL}?fresh=1`);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
  await expect(workspace.locator('.va-workspace__empty p')).toContainText('No saved result');
  await expect(workspace.locator('.va-workspace__score')).toHaveCount(0);
  // Brief opacity feedback remains available with reduced motion; it must
  // settle rather than leave a looping loader or spatial transition running.
  await expect
    .poll(() =>
      workspace.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running').length
      )
    )
    .toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('workspace navigation and coaching actions use the connected event flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(preview.baseURL);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
  await expect(workspace.getByRole('heading', { name: 'Score breakdown' })).toBeVisible();
  await expect(workspace.locator('.va-workspace__context')).toContainText('Backend Developer');
  await expect(workspace.locator('.va-workspace__context')).toContainText('easy');
  await expect(workspace.getByRole('region', { name: 'Coaching takeaway' })).toContainText(
    'Depth is your lowest saved dimension'
  );
  await workspace.getByRole('button', { name: 'Review question feedback', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'Question 2', exact: true })).toBeVisible();
  await expect(workspace.getByRole('button', { name: 'Feedback', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await workspace
    .getByRole('heading', { name: 'Question 2', exact: true })
    .scrollIntoViewIfNeeded();
  await workspace.screenshot({ path: 'test-results/workspace-detailed-feedback.png' });
  await page.getByRole('button', { name: 'Show captions', exact: true }).click();
  await workspace
    .getByRole('button', { name: 'Discuss this with Nikki', exact: true })
    .first()
    .click();
  await expect(workspace).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.va-status p')).toContainText(
    'Let’s talk through your saved feedback.'
  );
  await expect(workspace.getByRole('heading', { name: 'Question 2', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(workspace.getByRole('table')).toBeVisible();
  await expect(workspace.getByRole('row', { name: /Set 2 · Technical/ })).toContainText('+0.6');
  await workspace.screenshot({ path: 'test-results/workspace-detailed-comparison.png' });
  await workspace.getByRole('button', { name: 'STAR', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
  await expect(workspace.getByText('0 of 4 parts drafted')).toBeVisible();
  await workspace.getByRole('button', { name: 'Drill', exact: true }).click();
  await expect(workspace.getByText('Focus: Completeness')).toBeVisible();
  await expect(
    workspace.getByRole('button', { name: 'Start practice', exact: true })
  ).toBeVisible();
  await workspace.screenshot({ path: 'test-results/workspace-detailed-drill.png' });
});

for (const width of [390, 768, 1440]) {
  test(`research assessments explain their purpose and preserve score-only views at ${width}px`, async ({
    page,
  }) => {
    let requested = '';
    await page.routeWebSocket('**/__voice-preview-ws__', (route) => {
      const server = route.connectToServer();
      route.onMessage((message) => {
        if (typeof message === 'string') {
          const command = JSON.parse(message);
          if (command.type === 'inject_user_message') {
            server.send(JSON.stringify({ ...command, content: requested }));
            return;
          }
        }
        server.send(message);
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(preview.baseURL);
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    for (const [assessment, score] of [
      ['pre-test', '60'],
      ['post-test', '80'],
    ]) {
      requested = `Show me my ${assessment} feedback`;
      await page.getByRole('button', { name: 'Show me my Set 2 feedback', exact: true }).click();
      await expect(workspace.locator('.va-workspace__score')).toContainText(score);
      await expect(workspace.getByRole('button', { name: 'Scores', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(workspace.getByRole('button', { name: 'Feedback', exact: true })).toHaveCount(0);
      await expect(workspace.getByRole('button', { name: 'Review question feedback' })).toHaveCount(
        0
      );
      await expect(workspace.getByRole('region', { name: 'Coaching takeaway' })).toHaveCount(0);
      await expect(workspace.getByRole('region', { name: 'Question feedback' })).toHaveCount(0);
      await expect(workspace.getByText(/This assessment includes scores only/)).toBeVisible();
      await expect(workspace.getByText(/One-time research assessment/)).toBeVisible();
      const research = workspace.getByRole('region', { name: 'Research assessment purpose' });
      await expect(research).toContainText('Fresh practice restarts only Sets 1–3.');
      await expect(research).toContainText('even if the post-test is unfinished');
      await expect(workspace.locator('.va-workspace__context')).toHaveCount(0);
      await expect(workspace.locator('.va-workspace__footer')).toContainText(
        'Your saved progress stays unchanged.'
      );
      if (assessment === 'pre-test') {
        await expect(research).toContainText('also helps identify your practice focus');
        await expect(workspace.locator('.va-workspace__score')).toContainText(
          'Original pre-test score'
        );
      } else {
        await expect(research).toContainText('paired with your original pre-test');
      }
      await workspace.screenshot({ path: `test-results/research-${assessment}-${width}.png` });
      const explanation = workspace.locator('summary', {
        hasText: 'Why these assessments are taken once',
      });
      await explanation.focus();
      await explanation.press('Enter');
      await expect(
        workspace.getByRole('heading', { name: 'Interview quality · H₀₁' })
      ).toBeVisible();
      await expect(workspace.getByRole('heading', { name: 'Confidence · H₀₂' })).toBeVisible();
      await expect(workspace.locator('details')).toContainText('no significant improvement');
      await expect(workspace.locator('details')).toContainText('individual scores alone');
      await workspace.locator('details > div').scrollIntoViewIfNeeded();
      await workspace.screenshot({
        path: `test-results/research-${assessment}-details-${width}.png`,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await expect(
        workspace.getByText('No written feedback was saved for this question.')
      ).toHaveCount(0);
    }
    for (const [set, tip] of [
      [1, 'Lead with the main idea, then add a concrete example.'],
      [
        2,
        'Your explanation was clear. Add a concrete API example to connect the idea to practice.',
      ],
      [3, 'Explain your own contribution and the outcome of your actions.'],
    ]) {
      requested = `Show me my Set ${set} feedback for Backend`;
      await page.getByRole('button', { name: 'Show me my Set 2 feedback', exact: true }).click();
      await expect(workspace.getByText(tip, { exact: true })).toBeVisible();
      await expect(
        workspace.getByRole('button', { name: 'Feedback', exact: true })
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(workspace.getByText(/This assessment includes scores only/)).toHaveCount(0);
      await expect(
        workspace.getByRole('region', { name: 'Research assessment purpose' })
      ).toHaveCount(0);
    }
  });
}

test('missing research scores keep the study explanation without suggesting a replacement baseline', async ({
  page,
}) => {
  await page.routeWebSocket('**/__voice-preview-ws__', (route) => {
    const server = route.connectToServer();
    route.onMessage((message) => {
      if (typeof message !== 'string') {
        server.send(message);
        return;
      }
      const command = JSON.parse(message);
      server.send(
        command.type === 'inject_user_message'
          ? JSON.stringify({ ...command, content: 'Show me my pre-test scores' })
          : message
      );
    });
  });
  for (const state of ['fresh', 'summary']) {
    await page.goto(`${preview.baseURL}?${state}=1`);
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    await expect(
      workspace.getByRole('region', { name: 'Research assessment purpose' })
    ).toBeVisible();
    await expect(workspace.locator('.va-workspace__empty')).toContainText(
      'any saved assessment answers are kept'
    );
    await expect(workspace.locator('.va-workspace__score')).toHaveCount(0);
    await expect(workspace.locator('.va-workspace__empty')).not.toContainText(
      'Complete some practice'
    );
  }
});

for (const width of [390, 1440]) {
  for (const reduced of [false, true]) {
    test(`workspace motion preserves layout and tab selection at ${width}px, reduced=${reduced}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.goto(preview.baseURL);
      // Observe the whole entrance, including its first frame, rather than only
      // testing final layout after the animation has finished.
      await page.evaluate(() => {
        window.workspaceMotion = [];
        window.workspaceMotionFinished = new Promise((resolve) => {
          let start;
          function sample() {
            const panel = document.querySelector('.va-workspace');
            if (panel) {
              start ??= performance.now();
              const stage = document.querySelector('.va-stage').getBoundingClientRect();
              const bounds = panel.getBoundingClientRect();
              const transform = new DOMMatrix(getComputedStyle(panel).transform);
              window.workspaceMotion.push({
                horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                overlap:
                  Math.min(stage.right, bounds.right) - Math.max(stage.left, bounds.left) > 1 &&
                  Math.min(stage.bottom, bounds.bottom) - Math.max(stage.top, bounds.top) > 1,
                x: transform.m41,
              });
            }
            if (start === undefined || performance.now() - start < 600)
              requestAnimationFrame(sample);
            else resolve();
          }
          requestAnimationFrame(sample);
        });
      });
      await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
      const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
      await expect(workspace.locator('.va-workspace__score')).toContainText('76');
      await page.evaluate(() => window.workspaceMotionFinished);
      const samples = await page.evaluate(() => window.workspaceMotion);
      expect(samples.length).toBeGreaterThan(2);
      expect(samples.some((sample) => sample.horizontalOverflow || sample.overlap)).toBe(false);
      if (reduced) expect(samples.every((sample) => sample.x === 0)).toBe(true);
      else expect(samples.some((sample) => sample.x > 0.1)).toBe(true);
      await workspace.getByRole('button', { name: 'Feedback', exact: true }).click();
      await expect(
        workspace.getByRole('heading', { name: 'Question 2', exact: true })
      ).toBeVisible();
      await expect
        .poll(() =>
          workspace.locator('.va-workspace__view-indicator').evaluate((indicator) => {
            const pill = indicator.getBoundingClientRect();
            const button = indicator.closest('button').getBoundingClientRect();
            return Math.abs(pill.x - button.x) < 1 && Math.abs(pill.width - button.width) < 1;
          })
        )
        .toBe(true);
      await expect(
        workspace.getByRole('button', { name: 'Feedback', exact: true })
      ).toHaveAttribute('aria-pressed', 'true');
      await workspace.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/workspace-motion-${width}-${reduced ? 'reduced' : 'full'}.png`,
        fullPage: true,
      });
      await page.evaluate(() => {
        window.workspaceExit = new Promise((resolve) => {
          const collisions = [];
          function sample() {
            const panel = document.querySelector('.va-workspace');
            if (!panel) {
              resolve(collisions);
              return;
            }
            const a = panel.getBoundingClientRect();
            const b = document.querySelector('.va-stage').getBoundingClientRect();
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            )
              collisions.push('exiting workspace overlaps the orb stage');
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
      });
      await workspace.getByRole('button', { name: 'Close workspace' }).click();
      await expect(workspace).toHaveCount(0);
      expect(await page.evaluate(() => window.workspaceExit)).toEqual([]);
      await expect(
        page.getByRole('button', { name: 'Show me my technical scores', exact: true })
      ).toBeFocused();
    });
  }
}

test('initial loading and updates are visible inside the workspace', async ({ page }) => {
  await page.goto(`${preview.baseURL}?slow=1`);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
  await expect(workspace).toHaveAttribute('aria-busy', 'true');
  await expect(workspace.getByRole('status')).toContainText('Putting your workspace together');
  await expect(workspace.locator('.va-workspace__skeleton')).toBeVisible();
  await expect(workspace.locator('.va-workspace__score')).toContainText('76');
  await workspace.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(workspace.getByRole('status')).toContainText('Updating your workspace');
  await expect(workspace.locator('.va-workspace__score')).toContainText('76');
  await expect(workspace.getByRole('button', { name: 'Compare', exact: true })).toBeDisabled();
  await expect(workspace.getByRole('heading', { name: 'Question 2', exact: true })).toBeVisible();
  await expect(workspace).toHaveAttribute('aria-busy', 'false');
});

test('dismissing a loading workspace prevents a late response from reopening it', async ({
  page,
}) => {
  await page.goto(`${preview.baseURL}?slow=1`);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
  await expect(workspace).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: 'Mute microphone', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Show captions', exact: true }).click();
  await workspace.getByRole('button', { name: 'Close workspace', exact: true }).click();
  await expect(page.locator('.va-status p')).toContainText('Here it is.');
  await expect(workspace).toHaveCount(0);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  await expect(workspace.locator('.va-workspace__score')).toContainText('76');
});

for (const scenario of ['error', 'updateError']) {
  test(`workspace ${scenario} can be retried without ending voice`, async ({ page }) => {
    await page.goto(`${preview.baseURL}?${scenario}=1`);
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    if (scenario === 'updateError') {
      await expect(workspace.locator('.va-workspace__score')).toContainText('76');
      await workspace.getByRole('button', { name: 'Feedback', exact: true }).click();
    }
    await expect(workspace.getByRole('alert')).toContainText('That view could not be displayed');
    await expect(page.getByRole('button', { name: 'Mute microphone', exact: true })).toBeVisible();
    if (scenario === 'updateError')
      await expect(workspace.locator('.va-workspace__score')).toContainText('76');
    await workspace.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(workspace.getByRole('alert')).toHaveCount(0);
    await expect(workspace.locator('.va-workspace__score')).toContainText('76');
    if (scenario === 'updateError')
      await expect(
        workspace.getByRole('heading', { name: 'Question 2', exact: true })
      ).toBeVisible();
  });
}

test('archived summaries explain absent detail without inventing a breakdown', async ({ page }) => {
  await page.goto(`${preview.baseURL}?summary=1`);
  await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
  const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
  await expect(workspace.locator('.va-workspace__context')).toContainText('Archived attempt 5');
  await expect(workspace.locator('.va-workspace__score')).toContainText('76');
  await expect(workspace.getByText(/A detailed metric breakdown isn’t included/)).toBeVisible();
  await expect(workspace.locator('.va-workspace__track')).toHaveCount(0);
  await workspace.getByRole('button', { name: 'Feedback', exact: true }).click();
  await expect(workspace.getByText(/Question-level feedback isn’t available/)).toBeVisible();
});

for (const scenario of ['clarify', 'updateClarify']) {
  test(`${scenario}: incomplete tool calls ask a question without an error or guessed view`, async ({
    page,
  }) => {
    await page.goto(`${preview.baseURL}?${scenario}=1`);
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    if (scenario === 'updateClarify') {
      await expect(workspace.locator('.va-workspace__score')).toContainText('76');
      await workspace.getByRole('button', { name: 'Feedback', exact: true }).click();
    }
    await expect(page.locator('.va-status p')).toContainText(
      scenario === 'updateClarify'
        ? 'Which practice set would you like feedback on'
        : 'Which assessment would you like to see'
    );
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mute microphone', exact: true })).toBeEnabled();
    if (scenario === 'updateClarify') {
      await expect(workspace.getByRole('button', { name: 'Scores', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(workspace).toHaveAttribute('aria-busy', 'false');
    } else {
      await expect(workspace).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Show me my Set 2 feedback', exact: true }).click();
    await expect(workspace.getByRole('heading', { name: 'Question 2', exact: true })).toBeVisible();
    await expect(page.locator('.va-status p')).not.toContainText('Which ');
    await expect(workspace.getByRole('button', { name: 'Feedback', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
}

// Exercise the actual component and socket fixture, including both sides of the
// stacking breakpoint and short/zoom-equivalent CSS viewports.
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 1001, height: 480 },
]) {
  test(`enlarged assessment text stays readable and navigation resets scroll at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    let requested = 'Show me my pre-test scores';
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.routeWebSocket('**/__voice-preview-ws__', (route) => {
      const server = route.connectToServer();
      route.onMessage((message) => {
        if (typeof message !== 'string') return server.send(message);
        const command = JSON.parse(message);
        server.send(
          command.type === 'inject_user_message'
            ? JSON.stringify({ ...command, content: requested })
            : message
        );
      });
    });
    await page.goto(preview.baseURL);
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    await expect(
      workspace.getByRole('heading', { name: 'Starting check', exact: true })
    ).toBeVisible();
    // Text-only enlargement stresses pixel-sized controls independently of a
    // smaller CSS viewport. Compute sizes first so inherited text doubles once.
    await workspace.evaluate((panel) => {
      const elements = [...panel.querySelectorAll('*')].filter((el) =>
        [...el.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        )
      );
      const sizes = elements.map((el) => parseFloat(getComputedStyle(el).fontSize));
      elements.forEach((el, i) => {
        el.style.fontSize = `${sizes[i] * 2}px`;
      });
    });
    await workspace.locator('summary').click();
    const finalParagraph = workspace.locator('details p').last();
    await finalParagraph.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const layout = await workspace.evaluate((panel) => {
      const footer = panel.querySelector('.va-workspace__footer');
      const body = panel.querySelector('.va-workspace__body');
      const paragraph = panel.querySelector('details p:last-child');
      return {
        scrolls: panel.scrollHeight > panel.clientHeight,
        bodyScrolls: body.scrollHeight > body.clientHeight + 1,
        footerAfterBody:
          footer.getBoundingClientRect().top >= body.getBoundingClientRect().bottom - 1,
        paragraphAboveFooter:
          paragraph.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top + 1,
        noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
      };
    });
    expect(layout).toEqual({
      scrolls: true,
      bodyScrolls: false,
      footerAfterBody: true,
      paragraphAboveFooter: true,
      noHorizontalOverflow: true,
    });
    await workspace.locator('.va-workspace__footer').scrollIntoViewIfNeeded();
    await expect(workspace.locator('.va-workspace__footer')).toBeInViewport();
    requested = 'Show me my post-test scores';
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    await expect(
      workspace.getByRole('heading', { name: 'Progress check', exact: true })
    ).toBeVisible();
    await expect.poll(() => workspace.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(workspace.locator('.va-workspace__body')).toHaveJSProperty('scrollTop', 0);
    await workspace.getByRole('button', { name: 'Close workspace', exact: true }).click();
    await expect(workspace).toHaveCount(0);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 760, height: 640 },
  { width: 768, height: 1024 },
  { width: 1000, height: 700 },
  { width: 1001, height: 650 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test(`voice layout has no collisions at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(preview.baseURL);

    async function assertLayout() {
      const problems = await page.evaluate(() => {
        const issues = [];
        const rect = (el) => el.getBoundingClientRect();
        const stage = document.querySelector('.va-stage');
        const children = [...stage.children];
        const topbar = document.querySelector('.va-topbar');
        const headerItems = [...topbar.children];
        for (let i = 0; i < headerItems.length - 1; i++) {
          if (rect(headerItems[i]).right > rect(headerItems[i + 1]).left + 1) {
            issues.push('header controls overlap');
          }
        }
        if (rect(stage).top < rect(topbar).bottom - 1) issues.push('stage overlaps header');
        for (let i = 0; i < children.length; i++) {
          const a = rect(children[i]);
          for (const sibling of children.slice(i + 1)) {
            const b = rect(sibling);
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            )
              issues.push(`${children[i].className} overlaps ${sibling.className}`);
          }
        }
        for (const selector of [
          '.voice-agent-playground',
          '.va-stage',
          '.va-session-controls__toolbar',
          '.va-workspace',
          '.va-workspace__body',
        ]) {
          const el = document.querySelector(selector);
          if (el && el.scrollWidth > el.clientWidth + 1)
            issues.push(`${selector} overflows horizontally`);
        }
        const orb = rect(document.querySelector('.ix-orb-container'));
        const field = rect(document.querySelector('.va-orb-field'));
        const stageStyle = getComputedStyle(stage);
        const stageContentWidth =
          stage.clientWidth -
          parseFloat(stageStyle.paddingLeft) -
          parseFloat(stageStyle.paddingRight);
        if (orb.width < Math.min(280, stageContentWidth) - 1)
          issues.push('trademark orb is too small');
        if (orb.top < field.top - 1 || orb.bottom > field.bottom + 1)
          issues.push('orb escapes its row');
        const workspace = document.querySelector('.va-workspace');
        if (workspace) {
          const panel = rect(workspace);
          const header = rect(workspace.querySelector('.va-workspace__header'));
          const body = rect(workspace.querySelector('.va-workspace__body'));
          const footer = rect(workspace.querySelector('.va-workspace__footer'));
          if (header.bottom > body.top + 1 || body.bottom > footer.top + 1)
            issues.push('workspace regions overlap');
          if (
            panel.bottom > rect(stage).top &&
            panel.top < rect(stage).bottom &&
            panel.left < rect(stage).right
          ) {
            issues.push('workspace overlaps voice stage');
          }
        }
        return issues;
      });
      expect(problems).toEqual([]);
    }

    await assertLayout();
    await page.getByRole('button', { name: 'Audio settings', exact: true }).click();
    await assertLayout();
    await page.getByRole('button', { name: 'Show me my technical scores', exact: true }).click();
    const workspace = page.getByRole('complementary', { name: 'Nikki workspace' });
    await expect(workspace).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeEnabled();
    await expect(page.locator('.voice-agent-playground')).toHaveAttribute(
      'data-state',
      'listening'
    );
    const liveText = page.locator('.va-live-pill strong');
    await liveText.evaluate((el) => {
      el.textContent = 'CONNECTING';
    });
    await assertLayout();
    await liveText.evaluate((el) => {
      el.textContent = 'LIVE';
    });
    await page.getByRole('button', { name: 'Audio settings', exact: true }).click();
    await page.getByRole('button', { name: 'Show captions' }).click();
    await page.getByRole('combobox', { name: 'Microphone input' }).selectOption('preview');
    // Stress dynamic copy without coupling these geometry checks to a provider.
    await page.locator('.va-status p').evaluate((el) => {
      el.textContent =
        'Let’s work through this answer together. Explain your approach, the trade-offs you considered, and what you learned from the result. '.repeat(
          3
        );
    });
    await assertLayout();
    const picker = page.getByRole('combobox', { name: 'Microphone input' });
    await picker.scrollIntoViewIfNeeded();
    await expect(picker).toBeInViewport();
    await workspace.getByRole('button', { name: 'Close workspace' }).scrollIntoViewIfNeeded();
    await expect(workspace.getByRole('button', { name: 'Close workspace' })).toBeInViewport();
    await page.locator('.voice-agent-playground').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results/voice-layout-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await workspace.getByRole('button', { name: 'Close workspace' }).click();
    await expect(workspace).toHaveCount(0);
    await assertLayout();
  });
}
