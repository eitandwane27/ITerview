# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Filipino IT students (3rd-year and above) preparing for their first technical job interviews. They have foundational CS knowledge but limited experience with real interview dynamics — they freeze under pressure, unsure how to pace and structure spoken answers.

**Secondary (confirmed):** University instructors who log in to review and assess student performance through the platform.

## Product Purpose

ITerview is an AI-powered mock interview platform that lets IT students practice answering technical questions via live voice — the way real interviews actually happen. The AI plays interviewer, listens to the student speak, transcribes their answer in real time, and scores it on a transparent 1.0–5.0 rubric called the **3C framework** (Clarity, Correctness, Completeness). The goal is to replace subjective, anxious guesswork with objective, repeatable deliberate practice.

Success means delivering a production-quality interview preparation platform that demonstrates measurable value for Filipino IT students while meeting the requirements of the 3rd-year capstone defense.

## Positioning

The combination of **3C + voice + IT-specific tracks** is the unique mechanism no neighboring product honestly shares:

- **3C rubric**: deterministic, axis-separated scoring (not vague AI feedback or a single aggregate score).
- **Voice-first**: students speak their answers — not type — matching the actual interview format.
- **IT role tracks**: curated questions by specialty (Frontend, Backend, DevOps) rather than generic algorithmic CS.

## Operating Context

- Students use the platform at home or in a campus setting, on a laptop with a working microphone.
- Typical session: land on the landing page -> register -> complete pre-test Likert survey -> run mic test -> enter the interview proper -> post-test survey -> view results.
- The "Try It Live" anonymous demo on the landing page lets a visitor hear the AI and speak one answer before committing, with a 3-attempt cap before the auth modal appears.
- Three interview difficulty tiers (Easy -> Medium -> Hard) gate on performance: >= 75% average on Easy unlocks Medium, >= 75% on Medium unlocks Hard.

## Capabilities and Constraints

- **STT**: Deepgram live transcription via WebSocket; binary PCM audio streaming from the browser.
- **TTS**: AI voice synthesis via POST /api/tts/speak; audio plays through an HTML5 Audio element.
- **3C scoring**: deterministic heuristics (length, structure, technical depth); not a large LM call per answer.
- **Auth**: Firebase; users must be registered and logged in to access the full interview flow.
- **Demo cap**: 3 STT recording attempts per anonymous session; 30-second server-side hard cutoff per recording.
- **Tracks (current)**: Frontend, Backend, DevOps. More roles are planned but not yet confirmed.
- **Stack**: React 19 + Vite frontend; Node.js + Express + WebSocket backend; Firebase Auth; Deepgram STT; Tailwind CSS 4 is installed but the existing landing page and component styles are written in scoped vanilla CSS (LandingPage.css, component-level .css files).
- **Dev server**: npm run dev (frontend, Vite, port 5173); nodemon server.js (backend, port 5000).

## Brand Commitments

- **Name**: "ITerview" -- locked.
- **Visual identity**: not locked. The existing dark-mode, cyan/purple/amber palette and Geist/Inter typography are the current incumbent world, not a hard constraint; they can be evolved or replaced.

## Evidence on Hand

**Shipped pages (all in-scope):**

- `frontend/src/pages/LandingPage.jsx` / `LandingPage.css` — landing page; design tokens (Geist, Inter; `--lp-bg: #09090B`, `--lp-cyan: #06B6D4`, `--lp-purple: #8B5CF6`, `--lp-amber: #FBBF24`).
- `frontend/src/pages/PreTest.jsx` / `.css` — pre-interview Likert survey.
- `frontend/src/pages/MainSets.jsx` / `.css` — interview proper (3 difficulty sets).
- `frontend/src/pages/PostTest.jsx` / `.css` — post-interview Likert survey.
- `frontend/src/pages/Results.jsx` / `.css` — 3C score breakdown and review.
- `frontend/src/pages/Dashboard.jsx` / `.css` — student (and instructor) dashboard.
- `frontend/src/pages/LikertScale.jsx` / `.css` — reusable Likert survey component.

**Key components (all in-scope):**

- `frontend/src/components/TryItLiveDemo.jsx` — anonymous interactive demo (28 KB, implemented).
- `frontend/src/components/AuthModal.jsx` — login / register modal.
- `frontend/src/components/MicTest.jsx` / `.css` — microphone test flow.
- `frontend/src/components/SetBriefingOverlay.jsx` — set intro overlay.
- `frontend/src/components/Set2TransitionOverlay.jsx`, `Set3TransitionOverlay.jsx` — between-set transitions.
- `frontend/src/components/AiAnalysisLoader.jsx` — loading state while AI scores.
- `backend/controllers/demoSocket.js` — WebSocket handler for the anonymous demo.
- `try-it-live-plan.md` — architecture plan for the anonymous demo feature (completed).

**Absence:** No real testimonials, press, or external case studies; CTA copy is aspirational, not factual.

## Product Principles

1. **Voice is the product.** Every interaction that can be voice should be. Typing to practice speaking is practice for the wrong thing.
2. **Objectivity over vibes.** Every score must be explainable on the same axis it was measured. The 3C rubric is the product truth claim -- it must feel trustworthy, not gimmicky.
3. **Lower the barrier to first experience.** The anonymous Try It Live demo exists because friction before the first moment of value is the biggest dropout risk.
4. **IT-specific, not generic.** Questions, tracks, and terminology are scoped to real IT specialisms. Generic CS trivia is not what Filipino IT grads interview for.
5. **Capstone-grade quality bar.** Every surface must look and function at a level that convinces academic evaluators this is a production-ready, defensible artifact.

## Accessibility & Inclusion

- The core product interaction is voice — microphone access is a hard prerequisite. The mic test step before the interview is a product requirement, not a nice-to-have.
- **Language:** English-only. No Tagalog/Filipino localization is planned.
- No confirmed WCAG compliance requirement, but standard semantic HTML and keyboard focus are expected.
