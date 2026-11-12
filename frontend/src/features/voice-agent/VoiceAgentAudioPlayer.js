// Session-owned PCM playback. Follows Deepgram's AgentPlayer model: schedule on
// the audio clock, analyse actual output, and interrupt the entire queued turn.
// Keep this separate from React renders and the route that displays Nikki.
export class VoiceAgentAudioPlayer {
  constructor({ onLevel, onDrain, onError, sampleRate = 24_000 } = {}) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('This browser does not support live voice playback.');
    // Match the stream so the browser resamples the continuous output, rather
    // than resetting its resampler at every 20 ms AudioBuffer boundary.
    try { this.context = new Context({ latencyHint: 'interactive', sampleRate }); }
    catch (error) {
      if (error.name !== 'NotSupportedError') throw error;
      this.context = new Context({ latencyHint: 'interactive' });
    }
    this.sampleRate = sampleRate;
    this.onLevel = onLevel;
    this.onDrain = onDrain;
    this.onError = onError;
    this.gain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levelSamples = new Float32Array(this.analyser.fftSize);
    this.gain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.sources = new Set();
    this.pending = [];
    this.nextTime = 0;
    this.bufferSeconds = 0.12;
    this.generation = 0;
    this.streaming = false;
    this.disposed = false;
    this.resumePromise = null;
    this.meterFrame = null;
    this.lastMeterAt = 0;
    this.resamplePosition = 0;
    this.previousSample = 0;
  }

  get hasPlayback() {
    return this.pending.length > 0 || this.sources.size > 0;
  }

  get remainingSeconds() {
    return Math.max(0, this.nextTime - this.context.currentTime);
  }

  resume() {
    if (this.disposed) return Promise.resolve();
    if (this.resumePromise) return this.resumePromise;
    if (this.context.state === 'running') return Promise.resolve();
    // A single resume owns the FIFO. Individual packet promises must never
    // reorder PCM or revive a disposed session after a route/account change.
    const generation = this.generation;
    const attempt = this.context.resume().then(() => {
      if (this.disposed || generation !== this.generation) return;
      const chunks = this.pending.splice(0);
      for (const data of chunks) this.schedule(data);
    }).catch(error => {
      if (!this.disposed && generation === this.generation) {
        this.pending.length = 0;
        this.onError?.(error);
      }
    }).finally(() => {
      if (this.resumePromise !== attempt) return;
      this.resumePromise = null;
      // New audio can arrive while an interrupted resume is settling.
      if (!this.disposed && this.pending.length) this.flush();
    });
    this.resumePromise = attempt;
    return attempt;
  }

  queue(data) {
    if (this.disposed || !data.byteLength) return;
    if (data.byteLength % 2) throw new Error('The voice service returned incomplete PCM audio.');
    this.pending.push(data);
    this.flush();
  }

  flush() {
    if (this.disposed) return;
    if (this.resumePromise || this.context.state !== 'running') {
      this.resume();
      return;
    }
    const chunks = this.pending.splice(0);
    for (const data of chunks) this.schedule(data);
  }

  schedule(data) {
    const samples = new Int16Array(data);
    const outputRate = this.context.sampleRate;
    const channel = this.convertSamples(samples, outputRate);
    if (!channel.length) return;
    const buffer = this.context.createBuffer(1, channel.length, outputRate);
    buffer.getChannelData(0).set(channel);
    const now = this.context.currentTime;
    if (this.streaming && this.nextTime < now) {
      // Retain learned headroom across replies. Cartesia can deliver the next
      // sentence late even when individual PCM packets are only 20 ms long.
      this.bufferSeconds = Math.min(0.35, this.bufferSeconds + (now - this.nextTime) + 0.04);
      console.warn('[VoiceAgent] Speech playback buffer ran dry', {
        gapMs: Math.round((now - this.nextTime) * 1000),
        bufferMs: Math.round(this.bufferSeconds * 1000),
      });
    }
    // Buffer once after an idle period/underrun; never add silence per packet.
    const start = this.nextTime > now ? this.nextTime : now + this.bufferSeconds;
    this.nextTime = start + buffer.duration;
    this.streaming = true;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    this.sources.add(source);
    const generation = this.generation;
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      if (this.disposed || generation !== this.generation || this.hasPlayback) return;
      this.stopMeter();
      this.onDrain?.();
    };
    source.start(start);
    this.startMeter();
  }

  convertSamples(samples, outputRate) {
    if (outputRate === this.sampleRate) return Float32Array.from(samples, value => value / 0x8000);
    // Some devices cannot open a 24 kHz context. Keep interpolation phase and
    // the boundary sample across packets instead of resampling each separately.
    const step = this.sampleRate / outputRate;
    const result = new Float32Array(Math.max(0, Math.ceil((samples.length - this.resamplePosition) / step)));
    let count = 0;
    while (this.resamplePosition <= samples.length - 1) {
      const left = Math.floor(this.resamplePosition);
      const fraction = this.resamplePosition - left;
      const a = left < 0 ? this.previousSample : samples[left];
      const b = fraction ? samples[left + 1] : a;
      result[count++] = (a + (b - a) * fraction) / 0x8000;
      this.resamplePosition += step;
    }
    this.resamplePosition -= samples.length;
    this.previousSample = samples.at(-1);
    return result.subarray(0, count);
  }

  finishStream() {
    // The server finished sending; queued sound must continue to its real end.
    this.streaming = false;
  }

  setVolume(value) {
    if (this.disposed) return;
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.015);
  }

  startMeter() {
    if (this.meterFrame !== null) return;
    const read = time => {
      this.meterFrame = null;
      if (this.disposed || !this.hasPlayback) return;
      if (time - this.lastMeterAt >= 50) {
        this.analyser.getFloatTimeDomainData(this.levelSamples);
        let squares = 0;
        for (const value of this.levelSamples) squares += value * value;
        const rms = Math.sqrt(squares / this.levelSamples.length);
        this.onLevel?.(Math.min(100, Math.round(rms * 440)));
        this.lastMeterAt = time;
      }
      this.meterFrame = requestAnimationFrame(read);
    };
    this.meterFrame = requestAnimationFrame(read);
  }

  stopMeter() {
    if (this.meterFrame !== null) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = null;
    this.onLevel?.(0);
  }

  interrupt() {
    this.generation += 1;
    this.pending.length = 0;
    this.streaming = false;
    this.nextTime = 0;
    this.resamplePosition = 0;
    this.previousSample = 0;
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* A source may already have ended. */ }
      source.disconnect();
    }
    this.sources.clear();
    this.stopMeter();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.interrupt();
    this.gain.disconnect();
    this.analyser.disconnect();
    if (this.context.state !== 'closed') this.context.close().catch(() => {});
  }
}
