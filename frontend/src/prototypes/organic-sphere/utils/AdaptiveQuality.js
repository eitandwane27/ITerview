// AdaptiveQuality.js
// ─────────────────────────────────────────────────────────────────────────────
// Continuously tunes render quality to hold a near-60fps frame budget:
//
//  1. Pixel-ratio stepping  — smooth, hitch-free knob that reduces fill-rate
//     cost (bloom overdraw) when the GPU is under load, and creeps back up
//     toward the sharpest cap once headroom returns. Uses hysteresis so it
//     doesn't ping-pong.
//
//  2. Geometry tier drop    — one-time, discrete fallback. If pixel ratio has
//     bottomed out and we're STILL slow, that means the bottleneck is the
//     vertex shader (2x perlin4d x 3 neighbours per vertex on a 512-subdiv
//     sphere — resolution-independent). We rebuild the sphere at a coarser
//     subdivision, which cuts that cost ~quadratically.
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY_TIERS = [512, 384, 320, 256]

export default class AdaptiveQuality {
  constructor(experience, options = {}) {
    this.experience = experience
    this.time = experience.time
    this.config = experience.config

    this.maxPixelRatio =
      options.maxPixelRatio !== undefined ? options.maxPixelRatio : 1.75
    this.minPixelRatio =
      options.minPixelRatio !== undefined ? options.minPixelRatio : 0.75

    // FPS sampling
    this.fpsFrameCount = 40
    this.fpsValues = []
    this.lastFrameTime = null

    // Thresholds
    this.lowFpsThreshold = options.lowFpsThreshold || 50
    this.highFpsThreshold = options.highFpsThreshold || 57.5

    // Stepping (hysteresis)
    this.dropFramesRequired = options.dropFramesRequired || 8
    this.raiseFramesRequired = options.raiseFramesRequired || 45
    this.dropStep = options.dropStep || 0.125
    this.raiseStep = options.raiseStep || 0.02

    this.dropCount = 0
    this.raiseCount = 0

    this.onTick = this.onTick.bind(this)
    this.time.on('tick', this.onTick)
  }

  onTick() {
    const now = performance.now()

    if (this.lastFrameTime === null) {
      this.lastFrameTime = now
      return
    }

    const delta = now - this.lastFrameTime
    this.lastFrameTime = now
    if (delta <= 0) return

    this.fpsValues.push(1000 / delta)
    while (this.fpsValues.length > this.fpsFrameCount) this.fpsValues.shift()
    if (this.fpsValues.length < this.fpsFrameCount) return

    const fps = this.fpsValues.reduce((a, b) => a + b, 0) / this.fpsValues.length

    if (fps < this.lowFpsThreshold) {
      // Too slow → take a step down (or drop a geometry tier at the floor)
      this.raiseCount = 0
      this.dropCount++
      if (this.dropCount >= this.dropFramesRequired) {
        this.dropCount = 0
        if (this.config.pixelRatio - this.dropStep >= this.minPixelRatio - 0.0001) {
          this.experience.setPixelRatio(this.config.pixelRatio - this.dropStep)
        } else {
          this.dropGeometryTier()
        }
      }
    } else if (fps > this.highFpsThreshold) {
      // Headroom → creep back up toward the sharpest cap
      this.dropCount = 0
      this.raiseCount++
      if (this.raiseCount >= this.raiseFramesRequired) {
        this.raiseCount = 0
        if (this.config.pixelRatio + this.raiseStep <= this.maxPixelRatio + 0.0001) {
          this.experience.setPixelRatio(this.config.pixelRatio + this.raiseStep)
        }
      }
    } else {
      this.dropCount = 0
      this.raiseCount = 0
    }
  }

  dropGeometryTier() {
    const current = this.config.subdivision || 512
    const index = QUALITY_TIERS.indexOf(current)
    if (index === -1) return // unknown baseline — don't touch
    const next = QUALITY_TIERS[index + 1]
    if (next === undefined) return // already at the coarsest tier
    this.experience.setSubdivision(next)
  }

  destroy() {
    this.time.off('tick', this.onTick)
  }
}
