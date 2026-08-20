import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.config = this.experience.config
    this.targetElement = this.experience.targetElement
    this.scene = this.experience.scene

    this.setInstance()
    this.setControls()
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      25,
      this.config.width / this.config.height,
      0.1,
      15
    )
    this.instance.position.set(0, 0, 7)
    this.instance.rotation.reorder('YXZ')

    this.scene.add(this.instance)
  }

  // Orbit controls are a dev-only inspection tool — opt-in via the `controls`
  // option so the shipped orb stays a still, centered presence.
  setControls() {
    this.controls = null

    if (!this.targetElement || this.experience.options?.controls !== true) {
      return
    }

    this.controls = new OrbitControls(this.instance, this.targetElement)
    this.controls.enabled = true
    this.controls.screenSpacePanning = true
    this.controls.zoomSpeed = 0.25
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.update()
  }

  resize() {
    this.instance.aspect = this.config.width / this.config.height
    this.instance.updateProjectionMatrix()
  }

  update() {
    if (this.controls) {
      this.controls.update()
    }
  }

  destroy() {
    if (this.controls) {
      this.controls.dispose()
      this.controls = null
    }

    if (this.instance && this.scene) {
      this.scene.remove(this.instance)
    }
  }
}
