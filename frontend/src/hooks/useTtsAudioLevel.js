// frontend/src/hooks/useTtsAudioLevel.js
// ─────────────────────────────────────────────────────────────────────────────
// Playback-side AnalyserNode driver that makes the AI orb feel alive.
//
// Every TTS clip handed to attach() is routed into one shared Web Audio graph
// (MediaElementAudioSourceNode → AnalyserNode → destination) and the hook
// publishes a smoothed 0–100 speech level at ~20fps — the same cadence as the
// mic meter — which MainSets feeds into the orb's `volume` prop whenever the
// interviewer is speaking.
//
// Contract:
//   attach(el)                  Tap an <audio> element right before el.play().
//   detach()                    Release the current element; the meter lingers
//                               for STOP_GRACE_MS so queued clips hand off
//                               seamlessly instead of dipping the orb to zero.
//   detach({ immediate: true }) Hard stop (pause / unmount / route change).
//
// Notes:
// - One lazily created AudioContext is reused for the whole session — browsers
//   cap the number of live contexts (~6) and TTS clips are frequent.
// - If autoplay policy leaves the context suspended, the first real user
//   gesture (pointerdown / keydown) resumes it; playback is never blocked.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

const PUBLISH_INTERVAL_MS = 50; // 20fps — matches the mic meter cadence
const STOP_GRACE_MS = 240; // bridged by the next queued clip's attach()
const LEVEL_DELTA_THRESHOLD = 2; // ignore sub-perceptual jitter

export function useTtsAudioLevel() {
  const [level, setLevel] = useState(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const meterFrameRef = useRef(0);
  const stopTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = 0;
    }
    if (isMountedRef.current) setLevel(0);
  }, []);

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || meterFrameRef.current) return;

    const samples = new Uint8Array(analyser.fftSize);
    let smoothed = 0;
    let lastPublishAt = 0;

    const tick = (now) => {
      analyser.getByteTimeDomainData(samples);

      // RMS of the time-domain signal — speech typically lands in 0.02–0.30.
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const centered = (samples[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const instant = Math.min(100, rms * 320);

      // Fast attack / gentle release so syllables read as lively motion.
      smoothed =
        instant > smoothed ? smoothed * 0.45 + instant * 0.55 : smoothed * 0.78 + instant * 0.22;

      // Publish at 20fps, mirroring the mic meter, so the full interview
      // layout never rerenders on every display frame.
      if (now - lastPublishAt >= PUBLISH_INTERVAL_MS) {
        const rounded = Math.round(smoothed);
        setLevel((previous) =>
          Math.abs(previous - rounded) >= LEVEL_DELTA_THRESHOLD ? rounded : previous
        );
        lastPublishAt = now;
      }

      meterFrameRef.current = requestAnimationFrame(tick);
    };

    meterFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const attach = useCallback(
    (audioElement) => {
      if (!audioElement) return;

      // A queued clip is taking over — cancel any pending stop so the meter
      // (and the orb) bridge the handoff without dipping to silence.
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.connect(context.destination);
        audioContextRef.current = context;
        analyserRef.current = analyser;
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        // Sticky user activation (any earlier click) lets this resolve; the
        // gesture listener below is the fallback for a cold first clip.
        context.resume().catch(() => {});
      }

      try {
        sourceRef.current?.disconnect();
      } catch {
        // Previous clip's node was already disconnected.
      }

      try {
        const source = context.createMediaElementSource(audioElement);
        source.connect(analyserRef.current);
        sourceRef.current = source;
      } catch (error) {
        // The element was already routed elsewhere — playback continues
        // untouched and the orb falls back to its state-driven speaking pose.
        console.warn('[useTtsAudioLevel] Could not tap the TTS element:', error);
        return;
      }

      startMeter();
    },
    [startMeter]
  );

  const detach = useCallback(
    ({ immediate = false } = {}) => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }

      if (immediate) {
        stopMeter();
        return;
      }

      stopTimerRef.current = window.setTimeout(() => {
        stopTimerRef.current = null;
        stopMeter();
      }, STOP_GRACE_MS);
    },
    [stopMeter]
  );

  // Autoplay-policy safety net: resume the shared context on the first real
  // gesture if a clip ever starts before any activation existed.
  useEffect(() => {
    const resumeOnGesture = () => {
      const context = audioContextRef.current;
      if (context && context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', resumeOnGesture);
    window.addEventListener('keydown', resumeOnGesture);
    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
  }, []);

  // Full teardown on unmount (meter, graph nodes, shared context).
  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);

      try {
        sourceRef.current?.disconnect();
      } catch {
        // already disconnected
      }
      try {
        analyserRef.current?.disconnect();
      } catch {
        // already disconnected
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }

      sourceRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
    },
    []
  );

  return { level, attach, detach };
}

export default useTtsAudioLevel;
