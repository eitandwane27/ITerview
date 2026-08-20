import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter {
  constructor() {
    super()

    this.start = window.performance?.now ? window.performance.now() : Date.now()
    this.current = this.start
    this.elapsed = 0
    this.delta = 16
    this.playing = true

    this.tick = this.tick.bind(this)
    this.ticker = window.requestAnimationFrame(this.tick)
  }

  play() {
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  tick() {
    this.ticker = window.requestAnimationFrame(this.tick)

    const current = window.performance?.now ? window.performance.now() : Date.now()
    this.delta = current - this.current
    this.elapsed += this.playing ? this.delta : 0
    this.current = current

    if (this.delta > 60) {
      this.delta = 60
    }

    if (this.playing) {
      this.trigger('tick')
    }
  }

  stop() {
    window.cancelAnimationFrame(this.ticker)
  }
}
