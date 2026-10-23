import { useEffect, useId, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import AIOrb from '../../components/AIOrb';
import './NikkiOpening.css';

const EXPRESSIONS = {
  waking: 'booting',
  noticing: 'listening',
  curious: 'thinking',
  covering: 'thinking',
  ready: 'complete',
  leaving: 'complete',
  error: 'error',
};

export default function NikkiOpening({ phase, durationMs = 2000, onCancel }) {
  const titleId = useId();
  const detailId = useId();
  const cancelRef = useRef(null);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const ready = phase === 'ready' || phase === 'leaving';
  const error = phase === 'error';
  const progress = ready ? 100 : preparationProgress;

  useEffect(() => { cancelRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    if (ready || error) return;
    const startedAt = performance.now();
    // This is preparation progress, not downloaded bytes. Reserve the final
    // portion for the destination renderer's actual first-frame confirmation.
    const timer = setInterval(() => {
      const next = Math.min(90, Math.floor((performance.now() - startedAt) / durationMs * 90));
      setPreparationProgress(next);
      if (next === 90) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [durationMs, ready, error]);

  return (
    <div className="nikki-opening" data-phase={phase}>
      <div className="nikki-opening__scrim" aria-hidden="true" />
      <section
        className="nikki-opening__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
          // Cancel is the only interactive element in this dialog.
          if (event.key === 'Tab') { event.preventDefault(); cancelRef.current?.focus(); }
        }}
      >
        <div className="nikki-opening__character" aria-hidden="true">
          <AIOrb
            className="nikki-opening__orb"
            expressionState={EXPRESSIONS[phase]}
            expressiveMotion
            followPointer={!ready && !error}
          />
        </div>
        <div className="nikki-opening__copy" role="status" aria-live="polite" aria-atomic="true">
          <div className="nikki-opening__message" key={error ? 'error' : ready ? 'ready' : 'opening'}>
            <h2 id={titleId}>{error ? 'Nikki needs a moment' : ready ? 'Nikki’s ready' : 'Opening Nikki…'}</h2>
            <p id={detailId}>
              {error ? 'Please go back and try opening Nikki again.' : ready
                ? 'Let’s make room for a good conversation.'
                : 'Getting your conversation space ready.'}
            </p>
          </div>
        </div>
        <div
          className="nikki-opening__progress"
          role="progressbar"
          aria-label="Opening Nikki"
          aria-valuetext={error ? 'Unable to open Nikki' : ready ? 'Conversation space ready' : progress === 90 ? 'Finishing preparation' : `Preparing conversation space, ${progress}%`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          hidden={error}
        ><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
        <footer className="nikki-opening__footer">
          <span><ShieldCheck size={17} aria-hidden="true" />Saved progress stays unchanged.</span>
          <button ref={cancelRef} type="button" onClick={onCancel}>{error ? 'Go back' : 'Cancel'}</button>
        </footer>
      </section>
    </div>
  );
}
