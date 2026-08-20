import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import OrganicSphereCanvas from './OrganicSphereCanvas'
import SettingsPanel from './SettingsPanel'
import './OrganicSpherePlayground.css'

// Dev playground for the AI spirit orb — the faceless face of the LLM's
// text-to-speech voice (see DESIGN.md: "The AI orb").
//
// Hardcoded TTS test: POST /api/tts/speak (Deepgram) -> MP3 blob -> decoded
// and played through a WebAudio AnalyserNode -> fed to the orb via
// experience.setExternalAnalyser(...) so the sphere reacts to the AI's actual
// voice output (the same wiring MainSets uses for its session analyser).
const TTS_TEXT =
  'Welcome to your mock interview. Take a moment to think, and answer with confidence.'
const TTS_VOICE = 'aura-2-luna-en'

export default function OrganicSpherePlayground() {
  const [experience, setExperience] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(
    new URLSearchParams(window.location.search).has('tweak')
  )

  const barRefs = useRef([])
  const speakingRef = useRef(false)
  const statsTextRef = useRef(null)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const abortRef = useRef(null)

  const isDebug = new URLSearchParams(window.location.search).has('debug')

  const handleExperienceReady = useCallback((expInstance) => {
    setExperience(expInstance)
  }, [])

  // Debug stats readout (FPS / pixel ratio / subdivision) — only with ?debug.
  useEffect(() => {
    if (!isDebug) return

    let animId
    let frames = 0
    let lastUpdate = performance.now()

    const loop = (now) => {
      frames++
      if (now - lastUpdate >= 500) {
        const fps = Math.round((frames * 1000) / (now - lastUpdate))
        const dpr = experience?.config?.pixelRatio?.toFixed(2) ?? '—'
        const subdiv = experience?.config?.subdivision ?? '—'
        if (statsTextRef.current) {
          statsTextRef.current.textContent = `FPS ${fps} · DPR ${dpr} · SUB ${subdiv}`
        }
        frames = 0
        lastUpdate = now
      }
      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isDebug, experience])

  // 5-bar white waveform + live-state chip — read straight from the speech
  // analyser (zero React re-renders per frame). The orb only animates while
  // the AI's voice is actually playing.
  useEffect(() => {
    if (!experience) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let animId
    const monitor = () => {
      const analyser = experience.analyser
      const isSpeaking = Boolean(analyser?.speaking)

      if (isSpeaking !== speakingRef.current) {
        speakingRef.current = isSpeaking
        setSpeaking(isSpeaking)
      }

      if (reducedMotion) {
        for (let i = 0; i < 5; i++) {
          const barEl = barRefs.current[i]
          if (barEl) barEl.style.transform = 'scaleY(0.5)'
        }
      } else {
        const now = performance.now()
        for (let i = 0; i < 5; i++) {
          const barEl = barRefs.current[i]
          if (!barEl) continue

          if (isSpeaking && analyser.levels) {
            const level = analyser.levels[i] || 0
            const scaleY = Math.min(1.7, Math.max(0.16, level * 2.4))
            barEl.style.transform = `scaleY(${scaleY.toFixed(3)})`
            barEl.style.opacity = '0.95'
          } else {
            const breath = Math.max(0.12, 0.22 + Math.sin(now * 0.0016 + i * 0.9) * 0.08)
            barEl.style.transform = `scaleY(${breath.toFixed(3)})`
            barEl.style.opacity = '0.45'
          }
        }
      }

      animId = requestAnimationFrame(monitor)
    }

    animId = requestAnimationFrame(monitor)
    return () => cancelAnimationFrame(animId)
  }, [experience])
const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  const stopVoice = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
        sourceRef.current.disconnect()
      } catch {
        // source already stopped
      }
      sourceRef.current = null
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        // ignore
      }
      analyserRef.current = null
    }

    experience?.clearExternalAnalyser?.()
    setIsLoading(false)
  }, [experience])

  const playVoice = useCallback(async () => {
    if (!experience) return
    if (isLoading || speakingRef.current) {
      stopVoice()
      return
    }

    setError('')
    setIsLoading(true)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const res = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: TTS_TEXT, voice: TTS_VOICE }),
        signal: abortController.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'TTS request failed')
      }

      const blob = await res.blob()
      if (abortController.signal.aborted) return

      const arrayBuffer = await blob.arrayBuffer()
      const audioCtx = ensureAudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      if (abortController.signal.aborted) return

      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      source.connect(analyser)
      analyser.connect(audioCtx.destination)

      // Feed the analyser into the orb so it reacts to the AI's voice output.
      experience.setExternalAnalyser(analyser)

      sourceRef.current = source
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null
        }
        if (analyserRef.current === analyser) {
          try {
            analyserRef.current.disconnect()
          } catch {
            // ignore
          }
          analyserRef.current = null
        }
        experience.clearExternalAnalyser?.()
        setIsLoading(false)
      }

      setIsLoading(false)
      source.start()
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Orb] TTS error:', err.message)
        setError(err.message || 'Could not play the AI voice.')
      }
      experience.clearExternalAnalyser?.()
      setIsLoading(false)
    }
  }, [experience, isLoading, stopVoice, ensureAudioContext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      if (sourceRef.current) {
        try {
          sourceRef.current.stop()
        } catch {
          // ignore
        }
        sourceRef.current = null
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect()
        } catch {
          // ignore
        }
        analyserRef.current = null
      }
    }
  }, [])

  const chipLabel = isLoading ? 'Loading Voice' : speaking ? 'AI Speaking' : 'AI Standby'

  return (
    <div className="osp-stage">
      {/* 3D WebGL canvas — the AI spirit */}
      <OrganicSphereCanvas
        controls={isDebug}
        onExperienceReady={handleExperienceReady}
      />

      {/* Top chrome */}
      <div className="osp-top">
        <Link to="/dashboard" className="osp-back-pill">
          <ArrowLeft className="osp-back-icon" />
          <span>Dashboard</span>
        </Link>

        {isDebug && (
          <div ref={statsTextRef} className="osp-stats-pill">
            FPS — · DPR — · SUB —
          </div>
        )}

        <button
          className="osp-settings-toggle"
          onClick={() => setShowSettings((v) => !v)}
          aria-pressed={showSettings}
        >
          {showSettings ? 'Hide tweaks' : 'Tweaks'}
        </button>
      </div>

      {/* Live design panel — slide out from the right when open */}
      {showSettings && experience && <SettingsPanel experience={experience} />}

      {/* Orb assembly overlays the sphere: cyan pulse ring + 5-bar waveform */}
      <div
        className={`osp-orb ${speaking ? 'is-speaking' : ''}`}
        aria-hidden="true"
      >
        <span className="osp-ring" />
        <div className="osp-waveform">
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              ref={(el) => (barRefs.current[index] = el)}
              className="osp-bar"
            />
          ))}
        </div>
      </div>

      {/* Bottom dock: status chip + voice control */}
      <div className="osp-bottom">
        <div className={`osp-status-chip ${speaking ? 'is-speaking' : ''}`}>
          <span className="osp-status-dot" />
          <span>{chipLabel}</span>
        </div>

        <button
          onClick={playVoice}
          disabled={isLoading && !speaking}
          className={`osp-voice-btn ${speaking ? 'is-speaking' : ''} ${
            isLoading && !speaking ? 'is-loading' : ''
          }`}
        >
          {isLoading && !speaking
            ? 'Loading voice…'
            : speaking
              ? 'Stop voice'
              : 'Hear the AI'}
        </button>

        {error && <p className="osp-error">{error}</p>}

        <p className="osp-note">
          Test wiring: hardcoded text rendered by Deepgram, played through the
          orb&rsquo;s analyser so its voice drives the sphere.
        </p>
      </div>
    </div>
  )
}