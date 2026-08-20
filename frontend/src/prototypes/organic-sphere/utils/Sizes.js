import EventEmitter from './EventEmitter.js'

export default class Sizes extends EventEmitter {
  constructor(targetElement = null) {
    super()

    this.targetElement = targetElement
    this.viewport = {}

    this.resize = this.resize.bind(this)
    window.addEventListener('resize', this.resize)

    this.resize()
  }

  resize() {
    if (this.targetElement) {
      const bounds = this.targetElement.getBoundingClientRect()
      this.width = bounds.width || window.innerWidth
      this.height = bounds.height || window.innerHeight
    } else {
      this.width = window.innerWidth
      this.height = window.innerHeight
    }

    this.viewport.width = this.width
    this.viewport.height = this.height

    this.trigger('resize')
  }

  destroy() {
    window.removeEventListener('resize', this.resize)
  }
}
