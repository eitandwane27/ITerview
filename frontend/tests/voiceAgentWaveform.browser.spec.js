import { test, expect } from 'playwright/test';
import { voiceWorkspaceServer } from './fixtures/voiceWorkspaceServer.mjs';

let preview;
test.beforeAll(async () => { preview = await voiceWorkspaceServer(); });
test.afterAll(async () => { await preview?.close(); });

// Compare real rendered samples, not just scheduled start times. Separate native
// resamplers for 20 ms packets can click even when every start time is contiguous.
for (const outputRate of [24_000, 44_100, 48_000]) {
  test(`PCM packet boundaries preserve the waveform at ${outputRate} Hz`, async ({ page }) => {
    await page.goto(preview.baseURL);
    const difference = await page.evaluate(async rate => {
      const { VoiceAgentAudioPlayer } = await import('/src/features/voice-agent/VoiceAgentAudioPlayer.js');
      const Context = window.AudioContext;
      const render = async split => {
        const context = new OfflineAudioContext(1, Math.ceil(rate * 1.4), rate);
        window.AudioContext = function () { return context; };
        const player = new VoiceAgentAudioPlayer();
        const chunkLength = split ? 480 : 24_000;
        for (let offset = 0; offset < 24_000; offset += chunkLength) {
          const samples = new Int16Array(chunkLength);
          for (let i = 0; i < samples.length; i++) {
            samples[i] = Math.round(Math.sin(2 * Math.PI * 1234 * (i + offset) / 24_000) * 23_000);
          }
          player.schedule(samples.buffer);
        }
        player.stopMeter();
        return (await context.startRendering()).getChannelData(0);
      };
      try {
        const whole = await render(false);
        const chunks = await render(true);
        let max = 0;
        for (let i = Math.ceil(rate * .13); i < rate * 1.1; i++) {
          max = Math.max(max, Math.abs(whole[i] - chunks[i]));
        }
        return max;
      } finally { window.AudioContext = Context; }
    }, outputRate);
    expect(difference).toBeLessThan(.00001);
  });
}
