import { useLayoutEffect, useRef } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import './NikkiCompanion.css';
import { NIKKI_CURSOR_MOTION } from './nikkiNavigationMotion';

export default function NikkiCompanion({ session, operation, cursor, onStop, onEnd, onReturn }) {
  const dockRef = useRef(null);
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const bodyStyle = document.body.style;
    const previous = bodyStyle.getPropertyValue('--nikki-companion-clearance');
    // A modal's opening transform temporarily changes fixed-child coordinates.
    // Measure CSS size + bottom inset, avoiding a shrinking-modal feedback loop.
    const measure = () => bodyStyle.setProperty('--nikki-companion-clearance', `${Math.ceil(dock.offsetHeight + (parseFloat(getComputedStyle(dock).bottom) || 0) + 16)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      if (previous) bodyStyle.setProperty('--nikki-companion-clearance', previous);
      else bodyStyle.removeProperty('--nikki-companion-clearance');
    };
  }, []);
  const reduced = useReducedMotion();
  if (session.quotaExhausted) {
    return (
      <aside ref={dockRef} className="nikki-companion" data-nikki-controls aria-label="Nikki companion">
        <div className="nikki-companion__identity">
          <div className="nikki-companion__copy" role="status">{session.errorMessage}</div>
          <button type="button" className="nikki-companion__return" onClick={onEnd}>Dismiss</button>
        </div>
      </aside>
    );
  }
  const working = operation?.phase === 'opening';
  const state = !session.micEnabled ? 'Microphone muted' : session.agentState === 'speaking' ? 'Nikki is speaking' : session.agentState === 'thinking' ? 'Nikki is thinking' : 'Nikki is listening';
  return (
    <>
      <aside ref={dockRef} className="nikki-companion" data-nikki-controls data-working={working} aria-label="Nikki companion">
        <div className="nikki-companion__identity">
          <span className="nikki-companion__orb" data-state={session.agentState} aria-hidden="true"><i /><i /></span>
          <div className="nikki-companion__copy" role="status" aria-live="polite" aria-atomic="true">
            <strong>{session.micEnabled && ['opening', 'signing_out', 'error', 'stopped'].includes(operation?.phase) ? operation.title : state}</strong>
            <span>{operation?.detail || 'Your conversation stays connected here.'}</span>
          </div>
          {working && <button type="button" className="nikki-companion__stop" onClick={onStop}>Stop</button>}
        </div>
        <div className="nikki-companion__controls">
          <button type="button" data-nikki-return onClick={onReturn} disabled={(working && operation?.destination !== 'playground') || operation?.phase === 'signing_out'} className="nikki-companion__return">
            Return to Nikki <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <div className="nikki-companion__audio">
            <button type="button" onClick={session.toggleMic} aria-label={session.micEnabled ? 'Mute Nikki microphone' : 'Unmute Nikki microphone'} aria-pressed={!session.micEnabled} title={session.micEnabled ? 'Mute microphone' : 'Unmute microphone'}>
              {session.micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button type="button" onClick={session.toggleAudio} aria-label={session.audioEnabled ? 'Mute Nikki audio' : 'Unmute Nikki audio'} aria-pressed={!session.audioEnabled} title={session.audioEnabled ? 'Mute Nikki audio' : 'Unmute Nikki audio'}>
              {session.audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button type="button" onClick={onEnd} className="nikki-companion__end" aria-label="End Nikki conversation" title="End conversation"><PhoneOff size={18} /></button>
          </div>
        </div>
        {session.captionsEnabled && session.caption && <p className="nikki-companion__caption">{session.caption}</p>}
      </aside>
      {cursor && <Motion.div
        className="nikki-cursor"
        aria-hidden="true"
        initial={false}
        animate={{ x: cursor.x, y: cursor.y }}
        transition={{ duration: reduced ? 0 : NIKKI_CURSOR_MOTION.travelMs / 1000, ease: NIKKI_CURSOR_MOTION.ease }}
        data-pressed={cursor.pressed}
        data-waiting={cursor.waiting || undefined}
        data-label-left={cursor.x > window.innerWidth - 100}
      >
        <svg width="27" height="32" viewBox="0 0 27 32"><path d="M4 3V25L9.5 19.5L14 29L18 27L13.5 18H22L4 3Z" fill="#111111" stroke="white" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        <span>Nikki</span>
      </Motion.div>}
    </>
  );
}
