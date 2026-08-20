import React, { useEffect, useRef, memo } from 'react'
import Experience from './Experience.js'

function OrganicSphereCanvas({
  className = '',
  style = {},
  simulateSpeech = false,
  controls = false,
  subdivision = 512,
  maxPixelRatio = 2,
  adaptive = true,
  samples = 4,
  bloomScale = 1,
  onExperienceReady,
}) {
  const containerRef = useRef(null)
  const experienceRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const experience = new Experience(containerRef.current, {
      simulateSpeech,
      controls,
      subdivision,
      maxPixelRatio,
      adaptive,
      samples,
      bloomScale,
    })
    experienceRef.current = experience

    if (onExperienceReady) {
      onExperienceReady(experience)
    }

    return () => {
      if (experienceRef.current) {
        experienceRef.current.destroy()
        experienceRef.current = null
      }
    }
  }, [simulateSpeech, controls, subdivision, maxPixelRatio, adaptive, samples, bloomScale, onExperienceReady])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#010101',
        ...style,
      }}
    />
  )
}

export default memo(OrganicSphereCanvas)

