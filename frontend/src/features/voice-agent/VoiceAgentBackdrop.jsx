import { memo } from 'react';
import backgroundSrc from '../../assets/voice-agent-environment.png';

const AMBIENT_PARTICLES = [
  { x: 18.4, y: 9.2, size: 5, driftX: 5, driftY: -4, duration: 8.8, delay: -3.1 },
  { x: 27.6, y: 23.4, size: 8, driftX: -4, driftY: -6, duration: 10.4, delay: -7.2 },
  { x: 35.1, y: 25.4, size: 3, driftX: 6, driftY: -3, duration: 7.6, delay: -1.8 },
  { x: 10.1, y: 38.4, size: 4, driftX: 4, driftY: -5, duration: 9.7, delay: -5.6 },
  { x: 72.1, y: 14.7, size: 7, driftX: -5, driftY: -4, duration: 11.2, delay: -4.4 },
  { x: 85.4, y: 29.7, size: 3, driftX: 4, driftY: -4, duration: 8.1, delay: -6.3 },
  { x: 89.2, y: 24.6, size: 6, driftX: -4, driftY: -5, duration: 10.8, delay: -2.7 },
  { x: 93.6, y: 37.5, size: 4, driftX: 5, driftY: -3, duration: 9.1, delay: -7.8 },
];

function VoiceAgentBackdrop() {
  return (
    <div className="va-backdrop" aria-hidden="true">
      <img className="va-backdrop__reference" src={backgroundSrc} alt="" draggable="false" />
      <img className="va-backdrop__flow" src={backgroundSrc} alt="" draggable="false" />

      <div className="va-particle-field">
        {AMBIENT_PARTICLES.map((particle) => (
          <span
            key={`${particle.x}-${particle.y}`}
            className="va-particle"
            style={{
              '--va-particle-x': `${particle.x}%`,
              '--va-particle-y': `${particle.y}%`,
              '--va-particle-size': `${particle.size}px`,
              '--va-particle-drift-x': `${particle.driftX}px`,
              '--va-particle-drift-y': `${particle.driftY}px`,
              '--va-particle-duration': `${particle.duration}s`,
              '--va-particle-delay': `${particle.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(VoiceAgentBackdrop);
