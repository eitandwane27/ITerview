import React, { useState } from 'react'
import * as THREE from 'three'

// Live tweak panel for the AI spirit orb. Everything here mutates the live
// Three.js scene in real time so you can design the look without touching
// shader code — sliders write uniforms on the fly, colors update lights, and
// the voice-reaction overrides let you pin a value and inspect it statically.
//
// The orb is a custom ShaderMaterial. Tweakable groups:
//   - Distortion (wobble), Displacement (puff) — vertex-shader space warping
//   - Fresnel (rim / hot spot) — the "white line" control
//   - Lights A (warm orange top) & B (cool blue under)
//   - Bloom post-process
//   - Render/quality: subdivision + device-pixel-ratio
const DEFAULTS = {
  uDistortionFrequency: 1.5,
  uDistortionStrength: 0.65,
  uDisplacementFrequency: 2.12,
  uDisplacementStrength: 0.152,
  uFresnelOffset: -1.609,
  uFresnelMultiplier: 3.587,
  uFresnelPower: 1.793,
  uLightAIntensity: 1.85,
  uLightAColor: '#ff3e00',
  uLightBIntensity: 1.4,
  uLightBColor: '#0063ff',
  bloomStrength: 0.8,
  bloomRadius: 0.315,
  bloomThreshold: 0.25,
  subdivision: 512,
  pixelRatio: 2,
}

function SliderField({ label, value, min, max, step, onChange }) {
  return (
    <label className="osp-fld">
      <span className="osp-fld-label">
        {label}
        <span className="osp-fld-val">{Number(value).toFixed(3)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 'any'}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="osp-fld osp-fld-row">
      <span className="osp-fld-label">{label}</span>
      <span className="osp-fld-color">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <code className="osp-fld-hex">{value}</code>
      </span>
    </label>
  )
}

// Serialize the current tweaks into a portable JSON config. Uses the real
// shader-uniform / bloom keys so the payload can be pasted directly into
// caller code (e.g. to seed the sphere or persist a design).
function describeConfig(params) {
  return {
    shader: {
      uDistortionFrequency: params.uDistortionFrequency,
      uDistortionStrength: params.uDistortionStrength,
      uDisplacementFrequency: params.uDisplacementFrequency,
      uDisplacementStrength: params.uDisplacementStrength,
      uFresnelOffset: params.uFresnelOffset,
      uFresnelMultiplier: params.uFresnelMultiplier,
      uFresnelPower: params.uFresnelPower,
    },
    lights: {
      a: { color: params.uLightAColor, intensity: params.uLightAIntensity },
      b: { color: params.uLightBColor, intensity: params.uLightBIntensity },
    },
    bloom: {
      strength: params.bloomStrength,
      radius: params.bloomRadius,
      threshold: params.bloomThreshold,
    },
    quality: {
      subdivision: params.subdivision,
      pixelRatio: params.pixelRatio,
    },
  }
}
export default function SettingsPanel({ experience }) {
  const [params, setParams] = useState(DEFAULTS)
  const [voiceDrive, setVoiceDrive] = useState(true)
  const [copied, setCopied] = useState(false)

  const exportConfig = async () => {
    try {
      const json = JSON.stringify(describeConfig(params), null, 2)
      await navigator.clipboard.writeText(json)
    } catch {
      // Clipboard can be blocked outside secure contexts. Fall back to a textarea.
      const ta = document.createElement('textarea')
      ta.value = JSON.stringify(describeConfig(params), null, 2)
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const apply = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }))
    experience?.applyUniformOverride(key, value)
  }

  const applyColor = (key, hex) => {
    apply(key, hex)
    // Resolve 'a'/'b' so Experience can update uniform + light bookkeeping.
    const resolved =
      key === 'uLightAColor' ? 'a' : key === 'uLightBColor' ? 'b' : key
    experience?.applyLightColor(resolved, hex)
  }

  const handleBloom = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }))
    experience?.setBloom({ [key]: value })
  }

  const handleSubdivision = (value) => {
    value = Math.max(16, Math.round(value))
    setParams((prev) => ({ ...prev, subdivision: value }))
    experience?.setSubdivision(value)
  }

  const handlePixelRatio = (value) => {
    value = Math.max(1, Math.min(value, 4))
    setParams((prev) => ({ ...prev, pixelRatio: value }))
    experience?.setPixelRatio(value)
  }

  const reset = () => {
    // Restore shader uniforms + light colors + bloom to the reference values.
    const bloomDefaults = {
      strength: DEFAULTS.bloomStrength,
      radius: DEFAULTS.bloomRadius,
      threshold: DEFAULTS.bloomThreshold,
    }
    experience?.resetTweaks({ ...DEFAULTS, ...bloomDefaults })
    // Restore per-frame voice reaction (release the strength overrides).
    experience?.releaseVoiceOverrides()
    experience?.setSubdivision(DEFAULTS.subdivision)
    experience?.setPixelRatio(DEFAULTS.pixelRatio)

    setParams(DEFAULTS)
    setVoiceDrive(true)
  }
return (
    <div className="osp-panel">
      <div className="osp-panel-head">
        <span className="osp-panel-title">Orb tweaks</span>
        <div className="osp-panel-actions">
          <button className="osp-reset" onClick={exportConfig}>
            {copied ? 'Copied ✓' : 'Export'}
          </button>
          <button className="osp-reset osp-reset-danger" onClick={reset}>Reset</button>
        </div>
      </div>

      <section className="osp-group">
        <h4>Voice reaction</h4>
        <label className="osp-toggle">
          <input
            type="checkbox"
            checked={voiceDrive}
            onChange={(e) => {
              const on = e.target.checked
              setVoiceDrive(on)
              if (on) {
                experience?.releaseVoiceOverrides()
              }
            }}
          />
          <span>Let the AI voice animate the orb</span>
        </label>
      </section>

      <section className="osp-group">
        <h4>Displacement (puff)</h4>
        <SliderField label="Frequency" value={params.uDisplacementFrequency} min={0} max={8} onChange={(v) => apply('uDisplacementFrequency', v)} />
        <SliderField label="Strength" value={params.uDisplacementStrength} min={0} max={1} onChange={(v) => apply('uDisplacementStrength', v)} />
      </section>

      <section className="osp-group">
        <h4>Distortion (wobble)</h4>
        <SliderField label="Frequency" value={params.uDistortionFrequency} min={0} max={8} onChange={(v) => apply('uDistortionFrequency', v)} />
        <SliderField label="Strength" value={params.uDistortionStrength} min={0} max={1} onChange={(v) => apply('uDistortionStrength', v)} />
      </section>

      <section className="osp-group">
        <h4>Fresnel (rim / white line)</h4>
        <SliderField label="Offset" value={params.uFresnelOffset} min={-2} max={2} onChange={(v) => apply('uFresnelOffset', v)} />
        <SliderField label="Multiplier" value={params.uFresnelMultiplier} min={0} max={8} onChange={(v) => apply('uFresnelMultiplier', v)} />
        <SliderField label="Power" value={params.uFresnelPower} min={0.5} max={4} onChange={(v) => apply('uFresnelPower', v)} />
        <p className="osp-hint">White rim kicks in above ~0.9 fresnel — lower <em>Power</em> if you see facet lines.</p>
      </section>

      <section className="osp-group">
        <h4>Light A (warm top)</h4>
        <ColorField label="Color" value={params.uLightAColor} onChange={(v) => applyColor('uLightAColor', v)} />
        <SliderField label="Intensity" value={params.uLightAIntensity} min={0} max={5} onChange={(v) => apply('uLightAIntensity', v)} />
      </section>

      <section className="osp-group">
        <h4>Light B (cool under)</h4>
        <ColorField label="Color" value={params.uLightBColor} onChange={(v) => applyColor('uLightBColor', v)} />
        <SliderField label="Intensity" value={params.uLightBIntensity} min={0} max={5} onChange={(v) => apply('uLightBIntensity', v)} />
      </section>

      <section className="osp-group">
        <h4>Bloom</h4>
        <SliderField label="Strength" value={params.bloomStrength} min={0} max={2} onChange={(v) => handleBloom('strength', v)} />
        <SliderField label="Radius" value={params.bloomRadius} min={0} max={1} onChange={(v) => handleBloom('radius', v)} />
        <SliderField label="Threshold" value={params.bloomThreshold} min={0} max={1} onChange={(v) => handleBloom('threshold', v)} />
        <p className="osp-hint">Higher threshold means only the brightest pixels bloom.</p>
      </section>

      <section className="osp-group">
        <h4>Quality</h4>
        <SliderField label="Subdivision" value={params.subdivision} min={16} max={1024} step={16} onChange={handleSubdivision} />
        <SliderField label="Pixel ratio" value={params.pixelRatio} min={1} max={4} step={0.25} onChange={handlePixelRatio} />
      </section>
    </div>
  )
}