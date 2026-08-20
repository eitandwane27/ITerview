import * as THREE from 'three'
import Time from './utils/Time.js'
import Sizes from './utils/Sizes.js'
import AdaptiveQuality from './utils/AdaptiveQuality.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import SpeechAnalyser from './SpeechAnalyser.js'
import Sphere from './Sphere.js'

export default class Experience {
  constructor(targetElement, options = {}) {
    this.targetElement = targetElement
    this.options = options
    this.destroyed = false

    if (!this.targetElement) {
      console.warn('AI orb Experience: Missing targetElement container')
      return
    }

    this.time = new Time()
    this.sizes = new Sizes(this.targetElement)

    this.setConfig()
    this.setScene()
    this.setCamera()
    this.setRenderer()
    this.setSpeechAnalyser()
    this.setSphere()

    if (this.config.adaptive) {
      this.adaptiveQuality = new AdaptiveQuality(this, options)
    }

    this.onResize = () => {
      if (this.destroyed) return
      this.resize()
    }
    this.sizes.on('resize', this.onResize)

    this.onTick = () => {
      if (this.destroyed) return
      this.update()
    }
    this.time.on('tick', this.onTick)
  }

  setConfig() {
    const options = this.options || {}

    // Match the reference (organic-sphere.vercel.app): cap at DPR 2, MSAA on
    // (below DPR 2), full-resolution bloom. AdaptiveQuality acts as a runtime
    // safety net — it steps DPR (and geometry) DOWN only if the GPU actually
    // misses the frame budget, then creeps back up. High quality is now the
    // default, not the exception.
    const maxPixelRatio =
      options.maxPixelRatio !== undefined ? options.maxPixelRatio : 2

    this.config = {}
    this.config.pixelRatio = Math.min(
      Math.max(window.devicePixelRatio || 1, 1),
      maxPixelRatio
    )
    this.config.maxPixelRatio = maxPixelRatio
    this.config.subdivision = options.subdivision || 512
    this.config.samples = options.samples !== undefined ? options.samples : 4
    this.config.bloomScale =
      options.bloomScale !== undefined ? options.bloomScale : 1.0
    this.config.adaptive = options.adaptive !== false

    const bounds = this.targetElement.getBoundingClientRect()
    this.config.width = bounds.width || window.innerWidth
    this.config.height = bounds.height || window.innerHeight
  }

  setScene() {
    this.scene = new THREE.Scene()
  }

  setCamera() {
    this.camera = new Camera(this)
  }

  setRenderer() {
    this.renderer = new Renderer(this)
  }

  setSpeechAnalyser() {
    // The orb is the spirit of the AI's text-to-speech voice — it never
    // captures audio. `simulateSpeech` runs a procedural voice so the
    // blueprint can be previewed until the real TTS analyser is attached.
    this.analyser = new SpeechAnalyser({ simulate: this.options.simulateSpeech === true })
  }

  // Drive the orb from an analyser node owned by the audio pipeline (the TTS
  // output graph). Kept under its historical name for existing callers.
  setExternalAnalyser(analyserNode) {
    if (this.analyser) this.analyser.attach(analyserNode)
  }

  // — Live tweak API (used by SettingsPanel) —
  // Encapsulates mutation in the classes so the React layer only calls methods
  // (satisfies the react-hooks/immutability rule) while the Three.js objects
  // get updated in place.

  // Forward a single shader uniform override to the sphere.
  applyUniformOverride(key, value) {
    if (this.sphere) this.sphere.setUniformOverride(key, value)
  }

  // Stop overriding the three voice-driven uniforms (let the AI drive again).
  releaseVoiceOverrides() {
    if (this.sphere) {
      this.sphere.removeUniformOverride('uDisplacementStrength')
      this.sphere.removeUniformOverride('uDistortionStrength')
      this.sphere.removeUniformOverride('uFresnelMultiplier')
    }
  }

  // Apply a light color (uniform + light bookkeeping) by resolved key.
  applyLightColor(resolvedKey, hex) {
    if (!this.sphere) return
    const color = new THREE.Color(hex)
    this.sphere.setLightColor(resolvedKey, color)
  }

  // Apply bloom post-process values to the renderer's pass.
  setBloom(values) {
    if (this.renderer) this.renderer.setBloom(values)
  }

  // Clear every tweak the panel owns, restoring shader/light/bloom defaults.
  resetTweaks(defaults) {
    if (this.sphere) this.sphere.resetTweaks(defaults)
    if (this.renderer) this.renderer.setBloom(defaults)
  }

  // Stop reacting to an external analyser (e.g. when TTS playback ends).
  clearExternalAnalyser() {
    if (this.analyser) this.analyser.detach()
  }

  // Toggle the procedural TTS stand-in (blueprint fallback).
  setSimulatedSpeaking(active) {
    if (!this.analyser) return
    this.analyser.setSimulated(active)
  }

  setSphere() {
    this.sphere = new Sphere(this)
  }

  update() {
    if (this.camera) this.camera.update()
    if (this.analyser) this.analyser.update()
    if (this.sphere) this.sphere.update()
    if (this.renderer) this.renderer.update()
  }

  resize() {
    const bounds = this.targetElement.getBoundingClientRect()
    this.config.width = bounds.width || window.innerWidth
    this.config.height = bounds.height || window.innerHeight

    // NOTE: pixelRatio is intentionally NOT recomputed on resize so a runtime
    // AdaptiveQuality step-down (or step-up) isn't clobbered by the resize.

    if (this.camera) this.camera.resize()
    if (this.renderer) this.renderer.resize()
  }

  setPixelRatio(value) {
    this.config.pixelRatio = value
    if (this.renderer) this.renderer.setPixelRatio(value)
  }

  setSubdivision(value) {
    this.config.subdivision = value
    if (this.sphere) this.sphere.setSubdivision(value)
  }

  setPaused(paused) {
    if (!this.time) return
    if (paused) this.time.pause()
    else this.time.play()
  }

  destroy() {
    this.destroyed = true

    if (this.time) {
      this.time.stop()
      this.time.off('tick')
    }

    if (this.adaptiveQuality) {
      this.adaptiveQuality.destroy()
      this.adaptiveQuality = null
    }

    if (this.sizes) {
      this.sizes.off('resize')
      this.sizes.destroy()
    }

    if (this.sphere) {
      this.sphere.destroy()
    }

    if (this.camera) {
      this.camera.destroy()
    }

    if (this.renderer) {
      this.renderer.destroy()
    }

    if (this.analyser) {
      this.analyser.destroy()
      this.analyser = null
    }
    if (this.scene) {
      this.scene.clear()
    }
  }
}
