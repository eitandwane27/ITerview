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
  const audio = (seconds) => {
    const pcm = Buffer.alloc(24_000 * seconds * 2);
    for (let i = 0; i < pcm.length / 2; i++) {
      pcm.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 220) / 24_000) * 2000), i * 2);
    }
    send({ type: 'voice_agent_state', state: 'speaking' });
    socket.send(pcm);
  };
  return { send, audio };
}

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
  await expect.poll(() => page.evaluate(() => window.voiceAudit.starts.length)).toBe(1);
  // Exact output of the real controller's UserStartedSpeaking branch.
  h.send({ type: 'voice_agent_event', event: { type: 'UserStartedSpeaking' } });
  h.send({ type: 'voice_agent_state', state: 'listening', shouldClearPlayback: true });
  await expect(page.getByRole('heading', { name: 'Listening to you' })).toBeVisible();
  expect(await page.evaluate(() => window.voiceAudit.stops)).toBe(1);
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
