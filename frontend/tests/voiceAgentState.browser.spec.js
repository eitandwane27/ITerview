import { test, expect } from 'playwright/test';
import { Buffer } from 'node:buffer';
import { voiceWorkspaceServer } from './fixtures/voiceWorkspaceServer.mjs';

// Audit harness: real hook + Web Audio, synthetic microphone/provider events.
// These characterize current behavior; they do not prove live STT accuracy.
let preview;
test.beforeAll(async () => {
  preview = await voiceWorkspaceServer();
});
test.afterAll(async () => {
  await preview?.close();
});

async function connect(page) {
  let socket;
  await page.addInitScript(() => {
    window.voiceAudit = { starts: [], stops: 0, ends: 0 };
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.voiceAudit.starts.push({
        at: this.context.currentTime,
        scheduledAt: args[0],
        duration: this.buffer.duration,
      });
      this.addEventListener('ended', () => {
        window.voiceAudit.ends += 1;
      });
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      window.voiceAudit.stops += 1;
      return stop.apply(this, args);
    };
  });
  await page.routeWebSocket('**/__voice-preview-ws__', (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      if (typeof message === 'string' && JSON.parse(message).type === 'start_session') {
        ws.send(JSON.stringify({ type: 'voice_agent_ready' }));
      }
    });
  });
  await page.goto(preview.baseURL);
  await page.getByRole('button', { name: 'Start voice session' }).click();
  await expect(page.getByRole('status')).toContainText('LIVE');
  const send = (message) => socket.send(JSON.stringify(message));
  const audio = (seconds, amplitude = 2000) => {
    const pcm = Buffer.alloc(24_000 * seconds * 2);
    for (let i = 0; i < pcm.length / 2; i++) {
      pcm.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 220) / 24_000) * amplitude), i * 2);
    }
    send({ type: 'voice_agent_state', state: 'speaking' });
    socket.send(pcm);
  };
  return { send, audio };
}

test('Nikki opens the system microphone first despite a saved input and allows a manual switch', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('iterview.preferredAudioInput', 'preview');
  });
  await page.routeWebSocket('**/__voice-preview-ws__', (ws) => {
    ws.onMessage((message) => {
      if (typeof message === 'string' && JSON.parse(message).type === 'start_session') {
        ws.send(JSON.stringify({ type: 'voice_agent_ready' }));
      }
    });
  });
  await page.goto(preview.baseURL);
  await page.evaluate(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia;
    window.requestedMicrophones = [];
    navigator.mediaDevices.getUserMedia = (constraints) => {
      window.requestedMicrophones.push(constraints.audio.deviceId?.exact ?? null);
      return getUserMedia(constraints);
    };
  });
  await page.getByRole('button', { name: 'Start voice session' }).click();
  await expect(page.getByRole('status')).toContainText('LIVE');
  expect(await page.evaluate(() => window.requestedMicrophones)).toEqual([null]);

  await page.getByRole('button', { name: 'Audio settings' }).click();
  const input = page.getByRole('combobox', { name: 'Microphone input' });
  await expect(input).toHaveValue('');
  await input.selectOption('preview');
  await expect(input).toHaveValue('preview');
  await input.selectOption('');
  await expect(input).toHaveValue('');
  expect(await page.evaluate(() => window.requestedMicrophones)).toEqual([null, 'preview', null]);
  expect(await page.evaluate(() => localStorage.getItem('iterview.preferredAudioInput'))).toBe('preview');
});

test('only the opening greeting mutes the actual microphone until audible playback ends', async ({ page }) => {
  const h = await connect(page);
  const enabled = () => page.evaluate(() => window.voicePreviewTrack.enabled);
  expect(await enabled()).toBe(false);
  await expect(page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
  h.audio(1);
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(1);
  expect(await enabled()).toBe(false);
  await expect.poll(enabled).toBe(true);
  await expect(page.getByRole('button', { name: 'Mute microphone', exact: true })).toBeVisible();
  h.audio(1);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(2);
  expect(await enabled()).toBe(true);
  h.send({ type: 'voice_agent_state', state: 'listening', shouldClearPlayback: true });
  await expect.poll(() => page.evaluate(() => window.voiceAudit.stops)).toBe(1);
  expect(await enabled()).toBe(true);
});

test('manual microphone choice during the greeting overrides automatic unmute', async ({ page }) => {
  const h = await connect(page);
  h.audio(1);
  await page.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
  expect(await page.evaluate(() => window.voicePreviewTrack.enabled)).toBe(true);
  await page.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'listening');
  expect(await page.evaluate(() => window.voicePreviewTrack.enabled)).toBe(false);
  await expect(page.getByRole('button', { name: 'Unmute microphone', exact: true })).toBeVisible();
});

test('streamed speech stays contiguous when audio packets arrive unevenly', async ({ page }) => {
  const h = await connect(page);
  // Finish the fixture's cold module/GPU initialization before measuring packet
  // jitter. A main-thread stall longer than the buffer is a separate recovery case.
  await page.waitForLoadState('networkidle');
  // Measure network jitter independently of headless software-GPU timing.
  // Route continuity is covered separately with the full orb mounted.
  await page.addStyleTag({ content: '.va-orb-field { display: none !important; }' });
  h.audio(0.1);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.ends)).toBe(1);
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'listening');
  await page.evaluate(() => { window.voiceAudit = { starts: [], stops: 0, ends: 0 }; });
  // 100 ms of PCM per packet, delivered in alternating late/early pairs.
  // A 25 ms cushion leaves audible holes despite a healthy average bitrate.
  const arrivals = [0, 145, 200, 335, 400, 540, 600, 735, 800, 940];
  await Promise.all(arrivals.map((delay) => new Promise((resolve) => {
    setTimeout(() => { h.audio(0.1); resolve(); }, delay);
  })));
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(arrivals.length);
  const starts = await page.evaluate(() => window.voiceAudit.starts);
  const gaps = starts.slice(1).map((chunk, index) =>
    chunk.scheduledAt - (starts[index].scheduledAt + starts[index].duration)
  );
  expect(Math.max(...gaps)).toBeLessThan(1 / 24_000);
  expect(starts[0].scheduledAt - starts[0].at).toBeLessThanOrEqual(0.15);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.ends)).toBe(arrivals.length);
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'listening');
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(0);
});

test('a real delivery stall re-buffers and then resumes continuous speech', async ({ page }) => {
  const warnings = [];
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  const h = await connect(page);
  h.audio(0.1);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.ends)).toBe(1);
  h.audio(0.1);
  h.audio(0.1);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(3);
  const starts = await page.evaluate(() => window.voiceAudit.starts);
  expect(starts[1].scheduledAt - starts[1].at).toBeGreaterThan(0.1);
  expect(starts[1].scheduledAt - starts[1].at).toBeLessThanOrEqual(0.35 + 1 / 24_000);
  expect(starts[2].scheduledAt).toBeCloseTo(starts[1].scheduledAt + starts[1].duration, 5);
  expect(warnings.some(message => message.includes('Speech playback buffer ran dry'))).toBe(true);
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'listening');
});

test('orb follows audible speech instead of a silent packet queued ahead of it', async ({ page }) => {
  const h = await connect(page);
  const energy = () => page.locator('.va-stage').evaluate(element =>
    Number(element.style.getPropertyValue('--va-energy'))
  );
  h.audio(1, 24_000);
  await expect.poll(energy).toBeGreaterThan(.8);
  h.audio(1, 0);
  await page.waitForTimeout(100);
  expect(await energy()).toBeGreaterThan(.8);
  await expect.poll(energy).toBe(0);
});

test('ending a session stops every buffered speech chunk', async ({ page }) => {
  const h = await connect(page);
  h.audio(2);
  h.audio(2);
  h.audio(2);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(3);
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.getByTestId('practice-destination')).toBeVisible();
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(3);
});

test('audio-done waits for audible playback rather than cutting a queued sentence', async ({
  page,
}) => {
  const h = await connect(page);
  h.audio(2);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(1);
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'speaking');
  await expect.poll(() => page.evaluate(() => window.voiceAudit.ends)).toBe(1);
  await expect(page.locator('.voice-agent-playground')).toHaveAttribute('data-state', 'listening');
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(0);
});

test('a speech-start signal without a transcript cuts audio and leaves generic listening', async ({
  page,
}) => {
  const h = await connect(page);
  h.audio(4);
  h.audio(1);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(2);
  // Exact output of the real controller's UserStartedSpeaking branch.
  h.send({ type: 'voice_agent_event', event: { type: 'UserStartedSpeaking' } });
  h.send({ type: 'voice_agent_state', state: 'listening', shouldClearPlayback: true });
  await expect(page.getByRole('heading', { name: 'Listening to you' })).toBeVisible();
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(2);
  await expect(page.getByRole('heading', { name: 'I’m listening', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('LIVE');
  await page.screenshot({ path: 'test-results/voice-state-interruption.png', fullPage: true });
});

test('thinking can replace the orb speaking state while previous audio remains audible', async ({
  page,
}) => {
  const h = await connect(page);
  h.audio(4);
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(1);
  h.send({ type: 'voice_agent_state', state: 'listening', waitForPlayback: true });
  h.send({ type: 'voice_agent_state', state: 'thinking' });
  await expect(page.getByRole('heading', { name: 'Thinking with you' })).toBeVisible();
  expect(await page.evaluate(() => window.voiceAudit.ends)).toBe(0);
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(0);
});
