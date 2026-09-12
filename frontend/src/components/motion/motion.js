// frontend/src/components/motion/motion.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared motion constants for the ITerview landing page.
// `EASE` mirrors the design-token easing `--ease` (cubic-bezier(0.16, 1, 0.3, 1))
// so every Framer Motion animation speaks the same language as the CSS.
// ─────────────────────────────────────────────────────────────────────────────
export const EASE = [0.16, 1, 0.3, 1];

// Default scroll-reveal distance (px raised from rest position).
export const REVEAL_Y = 24;

// Shared viewport config: run once, start slightly before the element enters
// so reveals land while the element is still mostly off-screen bottom.
export const REVEAL_VIEWPORT = { once: true, margin: '-60px' };
