import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import {
  motion as Motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import atlasSrc from '../assets/mascot-mentor-atlas.png';
import { EASE } from './motion/motion';
import './MentorMascot.css';

// A single cached atlas supplies the four independently moving parts. The
// silhouette clips remove its white matte while keeping the white fox fur.
const PARTS = {
  head: {
    crop: [0, 0, 680, 700],
    outline:
      'M65 525 Q112 514 137 465 L150 391 C94 328 56 220 75 163 Q87 132 114 141 L282 241 Q347 216 397 220 C424 164 458 98 486 78 Q505 64 522 87 C565 147 590 239 580 347 Q617 386 650 397 Q652 428 626 452 C630 498 611 542 565 575 C493 626 401 640 314 633 C208 634 134 608 91 570 Z',
  },
  body: {
    crop: [690, 230, 530, 470],
    outline:
      'M110 96 Q153 45 190 59 Q255 78 284 64 Q347 42 397 84 L437 119 Q477 156 474 207 L452 253 L456 361 Q452 398 425 409 Q254 450 83 410 Q58 399 62 365 L59 278 Q28 248 42 206 Q51 163 81 131 Z',
  },
  paw: {
    crop: [190, 770, 350, 430],
    outline:
      'M55 195 C42 139 57 77 89 60 C131 30 228 30 255 67 Q281 123 285 194 L271 252 Q294 290 289 343 Q289 379 263 384 Q245 397 220 381 Q202 411 178 399 Q157 420 136 396 Q108 407 94 378 Q61 390 55 354 Q34 313 45 278 Z',
  },
  arm: {
    crop: [660, 800, 555, 330],
    outline:
      'M65 57 Q80 44 102 57 L202 98 Q271 87 311 103 L349 113 Q394 87 437 89 Q480 86 502 114 Q518 137 493 157 Q498 178 482 191 Q479 215 461 224 Q461 254 432 266 L389 263 Q363 281 333 265 Q278 284 234 275 Q136 279 54 254 Q37 246 40 210 Q35 119 65 57 Z',
  },
};

function Sprite({ part }) {
  const clipId = useId();
  const { crop, outline } = PARTS[part];
  const [x, y, width, height] = crop;

  return (
    <svg
      className="lp-mentor-sprite"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
      </defs>
      <image
        href={atlasSrc}
        x={-x}
        y={-y}
        width="1254"
        height="1254"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

function subscribeToVisibility(onChange) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const getPageVisibility = () => document.visibilityState === 'visible';
const getServerVisibility = () => true;

export default function MentorMascot({ layer, sceneRef, activeDimension, entered }) {
  const anchorRef = useRef(null);
  const reduce = useReducedMotion();
  const inView = useInView(sceneRef, { amount: 0.15 });
  const pageVisible = useSyncExternalStore(
    subscribeToVisibility,
    getPageVisibility,
    getServerVisibility
  );
  const moving = inView && pageVisible && !reduce;
  const idle = moving && !activeDimension;
  const nod =
    activeDimension === 'completeness' ? 3.5 : activeDimension === 'correctness' ? 2 : 2.75;
  const rawAngle = useMotionValue(34);
  const rawLength = useMotionValue(0.72);
  const springAngle = useSpring(rawAngle, { stiffness: 230, damping: 28 });
  const springLength = useSpring(rawLength, { stiffness: 230, damping: 28 });
  const angle = reduce ? rawAngle : springAngle;
  const length = reduce ? rawLength : springLength;
  const tipX = useTransform(length, (value) => value * 191 - 4);
  // Cancel most of the stick rotation at the wrist. The sleeve stays beside
  // the torso even when a narrow screen requires a steep pointing angle.
  const armRotation = useTransform(angle, (value) => -value + (value - 34) * 0.18);

  useEffect(() => {
    if (layer !== 'front') return;
    const scene = sceneRef.current;
    const anchor = anchorRef.current;
    if (!scene || !anchor) return;

    const pointAtAnswer = () => {
      const question = scene.querySelector('.lp-bench-question');
      // A dimension can lose its point to an ABSENCE (Completeness has nothing
      // to underline), so the target is not always a <mark>: any element opts in
      // with data-mentor-target. Prefer that declared target, then fall back to
      // the first phrase carrying the dimension's color.
      const target = activeDimension
        ? (scene.querySelector(`[data-mentor-target][data-dimension="${activeDimension}"]`) ??
          scene.querySelector(`mark[data-dimension="${activeDimension}"]`))
        : question;
      if (!question || !target) return;

      // A wrapped phrase can have several line boxes. Aim at its first line,
      // rather than the bounding rectangle spanning unrelated transcript text.
      const targetRect = target.getClientRects()[0];
      if (!targetRect) return;
      const grip = anchor.getBoundingClientRect();
      const targetX = targetRect.left + Math.min(targetRect.width * 0.45, 145);
      const targetY = targetRect.top - 12;
      const dx = Math.max(20, targetX - grip.left);
      const dy = Math.max(25, targetY - grip.top);
      const degrees = Math.max(22, Math.min(72, (Math.atan2(dy, dx) * 180) / Math.PI));
      const radians = (degrees * Math.PI) / 180;
      // The stick points toward the phrase but ends in the generous gap above
      // the question, so no animated artwork ever obscures the answer.
      const clearLength =
        (question.getBoundingClientRect().top - grip.top - 20) / Math.sin(radians);
      const maxLength = scene.clientWidth < 600 ? 112 : 168;
      rawAngle.set(degrees);
      rawLength.set(Math.max(48, Math.min(maxLength, clearLength)) / 200);
    };

    pointAtAnswer();
    const observer = new ResizeObserver(pointAtAnswer);
    observer.observe(scene);
    const question = scene.querySelector('.lp-bench-question');
    if (question) observer.observe(question);
    let mounted = true;
    document.fonts?.ready.then(() => {
      if (mounted) pointAtAnswer();
    });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [activeDimension, layer, sceneRef, rawAngle, rawLength]);

  const entrance = reduce
    ? { y: 0, opacity: 1 }
    : entered
      ? { y: 0, opacity: 1 }
      : { y: 42, opacity: 0.35 };

  return (
    <Motion.div
      className={`lp-mentor lp-mentor--${layer}`}
      data-dimension={activeDimension || 'idle'}
      data-motion={moving ? 'playing' : 'paused'}
      initial={false}
      animate={entrance}
      transition={{ duration: reduce ? 0 : 0.72, ease: EASE, delay: layer === 'front' ? 0.1 : 0 }}
      aria-hidden="true"
    >
      {layer === 'back' ? (
        <>
          <div className="lp-mentor-body">
            <Sprite part="body" />
          </div>
          <Motion.div
            className="lp-mentor-head"
            initial={false}
            animate={
              idle
                ? { y: [0, -2, 0], rotate: [0, -1.2, 0] }
                : moving && activeDimension
                  ? { y: [0, nod, 0], rotate: [0, nod, -1, 0] }
                  : { y: 0, rotate: 0 }
            }
            transition={
              idle
                ? { duration: 3.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }
                : { duration: moving ? 0.52 : 0, ease: EASE }
            }
          >
            <Sprite part="head" />
          </Motion.div>
        </>
      ) : (
        <>
          <div className="lp-mentor-resting-paw">
            <Sprite part="paw" />
          </div>
          <span className="lp-mentor-anchor" ref={anchorRef} />
          <Motion.div className="lp-mentor-teach" style={{ rotate: angle }}>
            <Motion.span className="lp-mentor-stick" style={{ scaleX: length }} />
            <Motion.span className="lp-mentor-stick-tip" style={{ x: tipX }} />
            <Motion.div className="lp-mentor-pointing-arm" style={{ rotate: armRotation }}>
              <Sprite part="arm" />
            </Motion.div>
          </Motion.div>
        </>
      )}
    </Motion.div>
  );
}
