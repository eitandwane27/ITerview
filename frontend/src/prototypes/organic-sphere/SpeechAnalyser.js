// SpeechAnalyser.js
// ─────────────────────────────────────────────────────────────────────────────
// The AI orb's "voice sense". The orb is the spirit of the LLM's
// text-to-speech output — it never captures audio itself. Two sources drive it:
//
//   1. attach(analyserNode) — an analyser node owned by the audio pipeline
//      (the TTS output graph, or any shared WebAudio session). We only read
//      it; the owner is responsible for its lifecycle and cleanup.
//
//   2. setSimulated(true) — procedural speech-cadence levels so the blueprint
//      can be previewed and tuned before the real TTS voice is wired in.
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_COUNT = 8

export default class SpeechAnalyser {
  constructor(options = {}) {
    this.attached = false // true when driven by an externally-owned analyser
    this.simulated = false // true when generating procedural speech levels
    this.speaking = false // the orb's live-state flag (drives the cyan signal)
    this.volume = 0
    this.levels = new Array(LEVEL_COUNT).fill(0)
    this.analyserNode = null
    this.floatTimeDomainData = null
    this.byteFrequencyData = null

    if (options.simulate) {
      this.setSimulated(true)
    }
  }

  // Drive the orb from an analyser node that someone else already owns
  // (e.g. the TTS output pipeline). No new streams, no new AudioContext.
  attach(analyserNode, options = {}) {
    if (!analyserNode) return

    this.detach()

    this.analyserNode = analyserNode
    const fftSize = options.fftSize || analyserNode.fftSize || 256
    this.floatTimeDomainData = new Float32Array(fftSize)
    this.byteFrequencyData = new Uint8Array(fftSize)

    this.simulated = false
    this.attached = true
  }

  detach() {
    this.analyserNode = null
    this.floatTimeDomainData = null
    this.byteFrequencyData = null
    this.attached = false
    this.speaking = false
    this.volume = 0
    this.levels.fill(0)
  }

  setSimulated(active) {
    this.simulated = Boolean(active)
    if (this.simulated) {
      this.detach()
      this.simulated = true
    }
  }

  getLevels() {
    if (!this.attached || !this.analyserNode) return this.levels

    const bufferLength = this.analyserNode.fftSize
    const levelBins = Math.floor(bufferLength / LEVEL_COUNT)

    for (let i = 0; i < LEVEL_COUNT; i++) {
      let sum = 0

      for (let j = 0; j < levelBins; j++) {
        sum += this.byteFrequencyData[i * levelBins + j]
      }

      this.levels[i] = sum / levelBins / 256
    }

    return this.levels
  }

  getVolume() {
    if (!this.attached || !this.floatTimeDomainData) return 0

    let sumSquares = 0.0
    for (let i = 0; i < this.floatTimeDomainData.length; i++) {
      const amplitude = this.floatTimeDomainData[i]
      sumSquares += amplitude * amplitude
    }

    return Math.sqrt(sumSquares / this.floatTimeDomainData.length)
  }

  // Procedural stand-in for the LLM's TTS voice: a phrase envelope (talk →
  // pause) gating syllable-rate bursts, with energy tilted to the low bins
  // the way speech spectra are.
  updateSimulated() {
    const t = performance.now() / 1000

    const phrase = Math.sin(t * 0.55) * 0.5 + 0.5
    const gate = phrase > 0.22 ? 1 : 0.06
    const syllable = 0.55 + 0.45 * Math.sin(t * 9.5 + Math.sin(t * 3.7) * 2.1)

    const level = gate * syllable

    for (let i = 0; i < LEVEL_COUNT; i++) {
      const bandTilt = 1 - i / 14
      const jitter = 0.55 + 0.45 * Math.sin(t * (6 + i * 2.3) + i * 1.7)
      this.levels[i] = Math.min(1, Math.max(0, level * bandTilt * jitter))
    }

    this.volume = Math.min(1, level * 0.75)
    this.speaking = true
  }

  update() {
    if (this.simulated) {
      this.updateSimulated()
      return
    }

    if (!this.attached || !this.analyserNode) {
      this.speaking = false
      return
    }

    this.analyserNode.getByteFrequencyData(this.byteFrequencyData)
    this.analyserNode.getFloatTimeDomainData(this.floatTimeDomainData)

    this.volume = this.getVolume()
    this.levels = this.getLevels()
    this.speaking = this.volume > 0.015
  }

  destroy() {
    // We never own audio nodes — the pipeline owner handles their teardown.
    this.detach()
    this.simulated = false
  }
}
