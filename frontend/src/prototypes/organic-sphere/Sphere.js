import * as THREE from 'three'
import { sphereVertexShader, sphereFragmentShader } from './shaders/sphereShaders.js'

export default class Sphere {
  constructor(experience) {
    this.experience = experience
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.analyser = this.experience.analyser

    this.timeFrequency = 0.0003
    this.elapsedTime = 0

    this.setVariations()
    this.setGeometry()
    this.setLights()
    this.setOffset()
    this.setMaterial()
    this.setMesh()

    // Live UI overrides. The shader tweaks panel writes here so per-frame
    // values (like the voice-driven strengths) aren't clobbered by update().
    this.uniformOverrides = {}
  }

  // — Live override API (used by the SettingsPanel) —

  // Record + immediately apply a UI override. Writes the uniform directly so
  // static params (frequencies, fresnel) update instantly.
  setUniformOverride(key, value) {
    this.uniformOverrides[key] = value
    if (this.material?.uniforms?.[key]) {
      this.material.uniforms[key].value = value
    }
  }

  // Stop overriding a single uniform (restores voice/local computation).
  removeUniformOverride(key) {
    delete this.uniformOverrides[key]
  }

  // Stop overriding everything the UI controlled.
  clearUniformOverrides() {
    this.uniformOverrides = {}
  }

  // Apply a resolved light color (setUniformOverride writes the uniform value
  // correctly for THREE.Color too, since setUniformOverride stores the value and
  // assigns it to the uniform). Keep the light bookkeeping in sync as well.
  setLightColor(resolvedKey, color) {
    const light = this.lights?.[resolvedKey]
    if (!light && resolvedKey !== 'a' && resolvedKey !== 'b') return

    // Map panel keys to the real uniform names.
    const uniformKey = resolvedKey === 'a' ? 'uLightAColor' : resolvedKey === 'b' ? 'uLightBColor' : resolvedKey
    this.setUniformOverride(uniformKey, color)

    if (light) {
      light.color.value = `#${new THREE.Color(color).getHexString()}`
      light.color.instance = color
    }
  }

  // Restore every referenced default (used by SettingsPanel Reset).
  resetTweaks(defaults) {
    this.clearUniformOverrides()

    if (!this.material?.uniforms) return
    const u = this.material.uniforms
    for (const key of [
      'uDistortionFrequency', 'uDistortionStrength',
      'uDisplacementFrequency', 'uDisplacementStrength',
      'uFresnelOffset', 'uFresnelMultiplier', 'uFresnelPower',
      'uLightAIntensity', 'uLightBIntensity',
    ]) {
      if (key in defaults && u[key]) u[key].value = defaults[key]
    }

    const a = new THREE.Color(defaults.uLightAColor)
    const b = new THREE.Color(defaults.uLightBColor)
    if (u.uLightAColor) u.uLightAColor.value = a
    if (u.uLightBColor) u.uLightBColor.value = b
    if (this.lights?.a?.color) {
      this.lights.a.color.value = defaults.uLightAColor
      this.lights.a.color.instance = a
    }
    if (this.lights?.b?.color) {
      this.lights.b.color.value = defaults.uLightBColor
      this.lights.b.color.instance = b
    }
  }

  setVariations() {
    this.variations = {}

    // Volume variation
    this.variations.volume = {}
    this.variations.volume.target = 0
    this.variations.volume.current = 0
    this.variations.volume.upEasing = 0.03
    this.variations.volume.downEasing = 0.002
    this.variations.volume.getValue = () => {
      const level0 = this.analyser?.levels?.[0] || 0
      const level1 = this.analyser?.levels?.[1] || 0
      const level2 = this.analyser?.levels?.[2] || 0
      return Math.max(level0, level1, level2) * 0.3
    }
    this.variations.volume.getDefault = () => 0.152

    // Low level variation
    this.variations.lowLevel = {}
    this.variations.lowLevel.target = 0
    this.variations.lowLevel.current = 0
    this.variations.lowLevel.upEasing = 0.005
    this.variations.lowLevel.downEasing = 0.002
    this.variations.lowLevel.getValue = () => {
      let value = this.analyser?.levels?.[0] || 0
      value *= 0.003
      value += 0.0001
      return Math.max(0, value)
    }
    this.variations.lowLevel.getDefault = () => 0.0003

    // Medium level variation
    this.variations.mediumLevel = {}
    this.variations.mediumLevel.target = 0
    this.variations.mediumLevel.current = 0
    this.variations.mediumLevel.upEasing = 0.008
    this.variations.mediumLevel.downEasing = 0.004
    this.variations.mediumLevel.getValue = () => {
      let value = this.analyser?.levels?.[1] || 0
      value *= 2
      value += 3.587
      return Math.max(3.587, value)
    }
    this.variations.mediumLevel.getDefault = () => 3.587

    // High level variation
    this.variations.highLevel = {}
    this.variations.highLevel.target = 0
    this.variations.highLevel.current = 0
    this.variations.highLevel.upEasing = 0.02
    this.variations.highLevel.downEasing = 0.001
    this.variations.highLevel.getValue = () => {
      let value = this.analyser?.levels?.[2] || 0
      value *= 5
      value += 0.5
      return Math.max(0.5, value)
    }
    this.variations.highLevel.getDefault = () => 0.65
  }

  setLights() {
    this.lights = {}

    // Light A — exact match to the reference (organic-sphere.vercel.app):
    // warm orange top-light, intensity 1.85, at Spherical(1, 0.615, 2.049).
    this.lights.a = {
      intensity: 1.85,
      color: {
        value: '#ff3e00',
        instance: new THREE.Color('#ff3e00'),
      },
      spherical: new THREE.Spherical(1, 0.615, 2.049),
    }

    // Light B — exact match to the reference: cool blue under-light,
    // intensity 1.4, at Spherical(1, 2.561, -1.844). It stays static, exactly
    // as in the original (the shader's fresnel does the sculpting).
    this.lights.b = {
      intensity: 1.4,
      color: {
        value: '#0063ff',
        instance: new THREE.Color('#0063ff'),
      },
      spherical: new THREE.Spherical(1, 2.561, -1.844),
    }
  }

  setOffset() {
    this.offset = {}
    this.offset.spherical = new THREE.Spherical(
      1,
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2
    )
    this.offset.direction = new THREE.Vector3()
    this.offset.direction.setFromSpherical(this.offset.spherical)
  }

  setGeometry() {
    const subdivision =
      this.experience?.config?.subdivision ||
      this.experience?.options?.subdivision ||
      512
    this.geometry = new THREE.SphereGeometry(1, subdivision, subdivision)
    this.geometry.computeTangents()
  }

  setSubdivision(value) {
    const previous = this.geometry?.parameters?.widthSegments
    if (previous === value) return

    if (this.geometry) {
      this.geometry.dispose()
    }

    if (this.experience?.config) {
      this.experience.config.subdivision = value
    }

    this.setGeometry()

    // The mesh keeps a reference to the geometry object it was built with —
    // point it at the rebuilt geometry explicitly.
    if (this.mesh) {
      this.mesh.geometry = this.geometry
    }

    // Keep the shader's tangent-step distances in sync with the new geometry
    if (this.material?.uniforms?.uSubdivision) {
      this.material.uniforms.uSubdivision.value.set(value, value)
    }
  }

  setMaterial() {
    const lightAPos = new THREE.Vector3().setFromSpherical(this.lights.a.spherical)
    const lightBPos = new THREE.Vector3().setFromSpherical(this.lights.b.spherical)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uLightAColor: { value: this.lights.a.color.instance },
        uLightAPosition: { value: lightAPos },
        uLightAIntensity: { value: this.lights.a.intensity },

        uLightBColor: { value: this.lights.b.color.instance },
        uLightBPosition: { value: lightBPos },
        uLightBIntensity: { value: this.lights.b.intensity },

        uSubdivision: {
          value: new THREE.Vector2(
            this.geometry.parameters.widthSegments,
            this.geometry.parameters.heightSegments
          ),
        },

        uOffset: { value: new THREE.Vector3() },

        uDistortionFrequency: { value: 1.5 },
        uDistortionStrength: { value: 0.65 },
        uDisplacementFrequency: { value: 2.12 },
        uDisplacementStrength: { value: 0.152 },

        uFresnelOffset: { value: -1.609 },
        uFresnelMultiplier: { value: 3.587 },
        uFresnelPower: { value: 1.793 },

        uTime: { value: 0 },
      },
      defines: {
        USE_TANGENT: '',
      },
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
    })
  }

  setMesh() {
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  update() {
    // Update variations — live voice values only while the AI is speaking;
    // otherwise fall back to the gentle idle defaults (the reference orb's
    // analog of `microphone.ready`). Exact easing/defaults from the original.
    const isSpeaking = this.analyser?.speaking
    for (const variationName in this.variations) {
      const variation = this.variations[variationName]
      variation.target = isSpeaking ? variation.getValue() : variation.getDefault()

      const easing = variation.target > variation.current ? variation.upEasing : variation.downEasing
      variation.current += (variation.target - variation.current) * easing * this.time.delta
    }

    // Time calculations
    this.timeFrequency = this.variations.lowLevel.current
    this.elapsedTime = this.time.delta * this.timeFrequency

    // Update material uniforms — identical to the reference. Light intensities
    // are static; only displacement/distortion/fresnel are driven by voice.
    // A SettingsPanel override (if present) wins over the voice computation so
    // users can pin a value and inspect the result live on the orb.
    const uniform = (key, computed) =>
      key in this.uniformOverrides ? this.uniformOverrides[key] : computed

    if (this.material?.uniforms) {
      this.material.uniforms.uDisplacementStrength.value = uniform('uDisplacementStrength', this.variations.volume.current)
      this.material.uniforms.uDistortionStrength.value = uniform('uDistortionStrength', this.variations.highLevel.current)
      this.material.uniforms.uFresnelMultiplier.value = uniform('uFresnelMultiplier', this.variations.mediumLevel.current)

      // Offset
      const offsetTime = this.elapsedTime * 0.3
      this.offset.spherical.phi =
        ((Math.sin(offsetTime * 0.001) * Math.sin(offsetTime * 0.00321)) * 0.5 + 0.5) * Math.PI
      this.offset.spherical.theta =
        ((Math.sin(offsetTime * 0.0001) * Math.sin(offsetTime * 0.000321)) * 0.5 + 0.5) * Math.PI * 2
      this.offset.direction.setFromSpherical(this.offset.spherical)
      this.offset.direction.multiplyScalar(this.timeFrequency * 2)

      this.material.uniforms.uOffset.value.add(this.offset.direction)

      // Time advance
      this.material.uniforms.uTime.value += this.elapsedTime
    }
  }

  destroy() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh)
    }

    if (this.geometry) {
      this.geometry.dispose()
    }

    if (this.material) {
      this.material.dispose()
    }
  }
}
