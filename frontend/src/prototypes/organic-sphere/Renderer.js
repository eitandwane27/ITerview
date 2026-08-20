import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.config = this.experience.config
    this.time = this.experience.time
    this.sizes = this.experience.sizes
    this.scene = this.experience.scene
    this.camera = this.experience.camera
    this.targetElement = this.experience.targetElement

    this.usePostprocess = true

    // Full-resolution bloom by default to match the reference look. It can be
    // tuned down via the `bloomScale` option if a build needs extra headroom;
    // AdaptiveQuality separately manages DPR/geometry for weak GPUs.
    this.bloomScale = this.config.bloomScale ?? 1.0

    this.setInstance()
    this.setPostProcess()
  }

  setInstance() {
    // Exact match to the reference (organic-sphere.vercel.app): near-black
    // `#010101` canvas.
    this.clearColor = '#010101'

    this.instance = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.instance.domElement.style.position = 'absolute'
    this.instance.domElement.style.top = '0'
    this.instance.domElement.style.left = '0'
    this.instance.domElement.style.width = '100%'
    this.instance.domElement.style.height = '100%'
    this.instance.domElement.style.outline = 'none'

    this.instance.setClearColor(this.clearColor, 1)
    this.instance.setSize(this.config.width, this.config.height)
    this.instance.setPixelRatio(this.config.pixelRatio)

    if (this.targetElement) {
      this.targetElement.appendChild(this.instance.domElement)
    }
  }

  setPostProcess() {
    this.postProcess = {}

    // Render pass
    this.postProcess.renderPass = new RenderPass(this.scene, this.camera.instance)

    // Unreal Bloom pass — exact match to the reference: strength 0.8,
    // radius 0.315, threshold 0, purple `#7f00ff` tint at 0.15.
    this.postProcess.unrealBloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.round(this.config.width * this.bloomScale),
        Math.round(this.config.height * this.bloomScale)
      ),
      0.8,   // strength
      0.315, // radius
      0.25   // threshold — raised from 0 to stop bloom amplifying the thin
             // per-vertex fresnel facet lines into white streaks. Only the
             // brightest pixels (the orb's hot rim) now bloom.
    )
    this.postProcess.unrealBloomPass.enabled = true

    this.postProcess.unrealBloomPass.tintColor = {
      value: '#7f00ff',
      instance: new THREE.Color('#7f00ff'),
    }

    if (this.postProcess.unrealBloomPass.compositeMaterial) {
      this.postProcess.unrealBloomPass.compositeMaterial.uniforms.uTintColor = {
        value: this.postProcess.unrealBloomPass.tintColor.instance,
      }
      this.postProcess.unrealBloomPass.compositeMaterial.uniforms.uTintStrength = {
        value: 0.15,
      }

      this.postProcess.unrealBloomPass.compositeMaterial.fragmentShader = `
varying vec2 vUv;
uniform sampler2D blurTexture1;
uniform sampler2D blurTexture2;
uniform sampler2D blurTexture3;
uniform sampler2D blurTexture4;
uniform sampler2D blurTexture5;
uniform float bloomStrength;
uniform float bloomRadius;
uniform float bloomFactors[NUM_MIPS];
uniform vec3 bloomTintColors[NUM_MIPS];
uniform vec3 uTintColor;
uniform float uTintStrength;

float lerpBloomFactor(const in float factor) {
    float mirrorFactor = 1.2 - factor;
    return mix(factor, mirrorFactor, bloomRadius);
}

void main() {
    vec4 color = bloomStrength * (
        lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
        lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
        lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
        lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
        lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv)
    );

    color.rgb = mix(color.rgb, uTintColor, uTintStrength);
    gl_FragColor = color;
}
      `
    }

    // Effect Composer — MSAA replicates the reference. The original picked a
    // multisample render target when DPR < 2 (plain target when DPR >= 2, since
    // high-DPI already supersamples). three r185 does this via `samples` on a
    // WebGLRenderTarget; default sRGB output is already three's default, so no
    // explicit encoding is needed (RGBFormat/sRGBEncoding were removed).
    const multisample = this.config.pixelRatio < 2 ? Math.max(1, Math.floor(this.config.samples || 4)) : 0
    this.renderTarget = new THREE.WebGLRenderTarget(
      this.config.width,
      this.config.height,
      {
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        samples: multisample,
      }
    )

    this.postProcess.composer = new EffectComposer(this.instance, this.renderTarget)
    this.postProcess.composer.setSize(this.config.width, this.config.height)
    this.postProcess.composer.setPixelRatio(this.config.pixelRatio)

    this.postProcess.composer.addPass(this.postProcess.renderPass)
    this.postProcess.composer.addPass(this.postProcess.unrealBloomPass)
  }

  setPixelRatio(value) {
    this.config.pixelRatio = value

    if (this.instance) {
      this.instance.setPixelRatio(value)
    }

    if (this.postProcess?.composer) {
      this.postProcess.composer.setPixelRatio(value)
      this.postProcess.composer.setSize(this.config.width, this.config.height)
    }
  }

  // Live-update UnrealBloomPass params from the SettingsPanel (threshold etc.).
  setBloom(values) {
    if (!this.postProcess?.unrealBloomPass) return
    const b = this.postProcess.unrealBloomPass
    if (typeof values.strength === 'number') b.strength = values.strength
    if (typeof values.radius === 'number') b.radius = values.radius
    if (typeof values.threshold === 'number') b.threshold = values.threshold
  }

  resize() {
    this.instance.setSize(this.config.width, this.config.height)
    this.instance.setPixelRatio(this.config.pixelRatio)

    if (this.postProcess?.composer) {
      this.postProcess.composer.setSize(this.config.width, this.config.height)
      this.postProcess.composer.setPixelRatio(this.config.pixelRatio)
    }

    if (this.postProcess?.unrealBloomPass) {
      this.postProcess.unrealBloomPass.resolution.set(
        Math.round(this.config.width * this.bloomScale),
        Math.round(this.config.height * this.bloomScale)
      )
    }
  }

  update() {
    if (this.usePostprocess && this.postProcess?.composer) {
      this.postProcess.composer.render()
    } else if (this.instance && this.scene && this.camera?.instance) {
      this.instance.render(this.scene, this.camera.instance)
    }
  }

  destroy() {
    if (this.postProcess?.composer) {
      if (this.postProcess.composer.renderTarget1) this.postProcess.composer.renderTarget1.dispose()
      if (this.postProcess.composer.renderTarget2) this.postProcess.composer.renderTarget2.dispose()
    }

    if (this.postProcess?.unrealBloomPass) {
      this.postProcess.unrealBloomPass.dispose()
    }

    if (this.renderTarget) {
      this.renderTarget.dispose()
    }

    if (this.instance) {
      this.instance.renderLists?.dispose()
      this.instance.dispose()

      if (this.instance.domElement && this.instance.domElement.parentNode) {
        this.instance.domElement.parentNode.removeChild(this.instance.domElement)
      }
    }
  }
}
