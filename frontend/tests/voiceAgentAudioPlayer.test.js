import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceAgentAudioPlayer } from '../src/features/voice-agent/VoiceAgentAudioPlayer.js';

let context;
let frame;
class FakeContext {
  constructor(options) {
    context = this;
    this.state = 'running';
    this.currentTime = 0;
    this.sources = [];
    this.resumeCalls = 0;
    this.level = 0;
    this.sampleRate = options.sampleRate || 48_000;
  }
  createGain() {
    return { connect() {}, disconnect() {}, gain: { setTargetAtTime() {} } };
  }
  createAnalyser() {
    return { connect() {}, disconnect() {}, getFloatTimeDomainData: data => data.fill(this.level) };
  }
  createBuffer(_channels, length, rate) {
    const channel = new Float32Array(length);
    return { duration: length / rate, channel, getChannelData: () => channel };
  }
  createBufferSource() {
    const source = { connect() {}, disconnect() {}, stop() { this.stopped = true; },
      start(at) { this.at = at; } };
    this.sources.push(source);
    return source;
  }
  resume() {
    this.resumeCalls += 1;
    return new Promise((resolve, reject) => {
      this.allowResume = () => { this.state = 'running'; resolve(); };
      this.rejectResume = reject;
    });
  }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
beforeEach(() => {
  globalThis.window = { AudioContext: FakeContext };
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = null; };
});
const pcm = (sample = 1000, seconds = 0.1) => new Int16Array(Math.round(24_000 * seconds)).fill(sample).buffer;

test('uneven PCM delivery produces a continuous, ordered waveform', () => {
  const player = new VoiceAgentAudioPlayer();
  for (const [i, at] of [0, .145, .2, .335, .4, .54, .6, .735, .8, .94].entries()) {
    context.currentTime = at;
    player.queue(pcm(i + 1));
  }
  for (let i = 1; i < context.sources.length; i += 1) {
    const previous = context.sources[i - 1];
    assert.ok(Math.abs(context.sources[i].at - previous.at - previous.buffer.duration) < 1 / 24_000);
    assert.equal(context.sources[i].buffer.channel[0], (i + 1) / 0x8000);
  }
  player.dispose();
});

test('delivery stalls increase bounded headroom and retain it for later replies', () => {
  const player = new VoiceAgentAudioPlayer();
  player.queue(pcm());
  context.currentTime = .4;
  player.queue(pcm());
  const learned = player.bufferSeconds;
  assert.ok(learned > .12 && learned <= .35);
  player.finishStream();
  player.interrupt();
  context.currentTime = 1;
  player.queue(pcm());
  assert.equal(context.sources.at(-1).at, 1 + learned);
  context.currentTime = 10;
  player.queue(pcm());
  assert.equal(player.bufferSeconds, .35);
  player.dispose();
});

test('suspended playback resumes once and preserves FIFO until the real audio tail ends', async () => {
  let drained = 0;
  const player = new VoiceAgentAudioPlayer({ onDrain: () => { drained += 1; } });
  context.state = 'suspended';
  for (const sample of [1000, 2000, 3000]) player.queue(pcm(sample));
  assert.equal(context.resumeCalls, 1);
  assert.equal(player.hasPlayback, true);
  assert.equal(context.sources.length, 0);
  context.allowResume();
  await player.resumePromise;
  assert.deepEqual(context.sources.map(source => source.buffer.channel[0]), [1000, 2000, 3000].map(value => value / 0x8000));
  player.finishStream();
  assert.equal(drained, 0);
  context.sources[0].onended();
  context.sources[1].onended();
  assert.equal(player.hasPlayback, true);
  context.sources[2].onended();
  assert.equal(drained, 1);
  assert.equal(player.hasPlayback, false);
  player.dispose();
});

test('interrupting a suspended turn discards old packets while preserving a new turn', async () => {
  const player = new VoiceAgentAudioPlayer();
  context.state = 'suspended';
  player.queue(pcm(1000));
  const pending = player.resumePromise;
  player.interrupt();
  player.queue(pcm(2000));
  context.allowResume();
  await pending;
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].buffer.channel[0], 2000 / 0x8000);
  player.dispose();
  assert.equal(context.sources[0].stopped, true);
});

test('late resume completion cannot revive a disposed account/session', async () => {
  let failed = false;
  const player = new VoiceAgentAudioPlayer({ onError: () => { failed = true; } });
  context.state = 'suspended';
  player.queue(pcm());
  const pending = player.resumePromise;
  player.dispose();
  context.rejectResume(new Error('Context closed'));
  await pending;
  assert.equal(context.sources.length, 0);
  assert.equal(failed, false);
});

test('failed resume reports once and releases pending audio', async () => {
  let failures = 0;
  const player = new VoiceAgentAudioPlayer({ onError: () => { failures += 1; } });
  context.state = 'suspended';
  player.queue(pcm());
  context.rejectResume(new Error('Playback blocked'));
  await player.resumePromise;
  assert.equal(failures, 1);
  assert.equal(player.hasPlayback, false);
  assert.equal(context.resumeCalls, 1);
  player.dispose();
});

test('orb energy measures audible output rather than queued packet amplitude', () => {
  const levels = [];
  const player = new VoiceAgentAudioPlayer({ onLevel: level => levels.push(level) });
  player.queue(pcm(30_000));
  assert.deepEqual(levels, []);
  frame(100);
  assert.equal(levels.at(-1), 0);
  context.level = .2;
  frame(200);
  assert.equal(levels.at(-1), 88);
  player.interrupt();
  assert.equal(levels.at(-1), 0);
  assert.equal(frame, null);
  player.dispose();
});

test('malformed PCM fails explicitly without scheduling partial audio', () => {
  const player = new VoiceAgentAudioPlayer();
  assert.throws(() => player.queue(new ArrayBuffer(3)), /incomplete PCM/);
  assert.equal(context.sources.length, 0);
  player.dispose();
});

test('playback requests the stream rate and falls back only when that rate is unsupported', () => {
  const rates = [];
  window.AudioContext = class extends FakeContext {
    constructor(options) {
      rates.push(options.sampleRate);
      if (options.sampleRate) throw new DOMException('Unsupported sample rate', 'NotSupportedError');
      super(options);
    }
  };
  const player = new VoiceAgentAudioPlayer();
  assert.deepEqual(rates, [24_000, undefined]);
  assert.equal(context.sampleRate, 48_000);
  player.queue(pcm());
  assert.ok(Math.abs(context.sources[0].buffer.duration - .1) <= 1 / 24_000);
  player.dispose();
});

for (const rate of [44_100, 48_000]) {
  test(`fallback resampling preserves order and phase through irregular packets at ${rate} Hz`, () => {
    const whole = new VoiceAgentAudioPlayer();
    const split = new VoiceAgentAudioPlayer();
    const input = Int16Array.from({length: 4800}, (_, i) => Math.round(Math.sin(i * .323) * 23_000));
    const expected = whole.convertSamples(input, rate);
    const actual = [];
    let offset = 0;
    for (const length of [1, 19, 480, 1, 279, 2000, 20, 2000]) {
      actual.push(...split.convertSamples(input.subarray(offset, offset + length), rate));
      offset += length;
    }
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < .000001);
    split.interrupt();
    assert.equal(split.convertSamples(new Int16Array([12_000]), rate)[0], 12_000 / 0x8000);
    whole.dispose();
    split.dispose();
  });
}
