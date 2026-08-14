---
name: ITerview
description: "AI-powered voice mock-interview practice for Filipino IT students — a dark precision-instrument studio: near-black canvas, signal-cyan live states, blueprint-grid texture."
colors:
  canvas: "#09090B"
  canvas-deep: "#0C0B16"
  card-surface: "#18181B"
  demo-surface: "#12121A"
  ink: "#FFFFFF"
  ink-dim: "#C0C0D0"
  ink-secondary: "#9CA3AF"
  ink-muted: "#6B7280"
  ink-cyan: "#081318"
  ink-on-white: "#09090B"
  cyan: "#06B6D4"
  cyan-end: "#00D4C8"
  cyan-bright: "#22D3EE"
  cyan-soft: "#67E8F9"
  purple: "#8B5CF6"
  purple-bright: "#A78BFA"
  green: "#10B981"
  green-bright: "#34D399"
  amber: "#FBBF24"
  amber-deep: "#F8961E"
  error: "#FCA5A5"
typography:
  display:
    fontFamily: '"Geist", "Figtree", system-ui, sans-serif'
    fontSize: "clamp(1.9rem, 3.6vw, 2.9rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.75px"
  headline:
    fontFamily: '"Geist", "Figtree", system-ui, sans-serif'
    fontSize: "clamp(1.1rem, 2.5vw, 1.375rem)"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: '"Geist", "Figtree", Inter, system-ui, sans-serif'
    fontSize: "clamp(0.75rem, 1.5vw, 0.8125rem)"
    fontWeight: 600
    letterSpacing: "3px"
    textTransform: "uppercase"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(0.9375rem, 1.6vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.5px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
  space-16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink-cyan}"
    rounded: "{rounded.pill}"
    padding: "15px 32px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.cyan-bright}"
    textColor: "{colors.ink-cyan}"
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on-white}"
    rounded: "{rounded.pill}"
    padding: "7px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px 20px"
  section-cta:
    backgroundColor: "rgba(34, 211, 238, 0.06)"
    textColor: "{colors.cyan-soft}"
    rounded: "{rounded.pill}"
    padding: "10px 24px"
  card:
    backgroundColor: "{colors.card-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  demo-card:
    backgroundColor: "{colors.demo-surface}"
    rounded: "{rounded.xl}"
    padding: "32px"
  chip:
    rounded: "{rounded.pill}"
    textColor: "{colors.cyan-soft}"
    backgroundColor: "rgba(34, 211, 238, 0.07)"
---

# Design System: ITerview

## Overview

**Creative North Star: "The Live Interview Studio"**

A visitor landing on ITerview steps onto the floor of a real studio in the quiet hours — the interview room wired for signal: dark, precise, and waiting for a first voice. The canvas is near-black with a cool blue cast (`#09090B`), floor-planned by a hairline blueprint grid, and lit by a single moving light — **signal cyan** (`#06B6D4`), the color of the AI listening. Nothing else competes for that light. Violet (`#8B5CF6`) is the supporting technology accent that anchors role tracks and secondary structure; amber (`#FBBF24`) is the warm caution lamp of the Completeness dimension; green (`#10B981`) marks what is correct and unlocked.

The interface reads as a precision instrument rather than decoration: flat translucent surfaces with hairline white borders, pill-shaped controls, a 12px card radius (16px for the flagship demo), and motion that appears only when the product is doing something — the cyan waveform bouncing when the AI speaks, the pulsing dot when it listens, the cyan hairline crawling along the nav as the page scrolls.

**Key Characteristics:**

- Near-black canvas (`#09090B`) with a cool blue cast — never pure black
- One moving signal accent (cyan) for live states and primary conversion
- Blueprint grid + construction hairlines: the page is measured, engineered
- Translucent card surfaces (`#18181B` at ~60–88% alpha) with hairline white borders, flat at rest
- Pill controls, 12px cards, 16px flagship demo card
- Geist/Figtree for display, Inter for body and UI
- Ambient radial light blooms; glass blur only on the sticky nav
- Motion only where the product is alive; all of it honors `prefers-reduced-motion`

**Transition Note.** The legacy lavender "calm room" world (PreTest, MainSets, PostTest, Results, Dashboard) is being retired. Those app-flow surfaces still carry the old lavender/white identity mid-migration and are scheduled to inherit this studio world; they are not a second theme.

## Colors

The palette is a lit studio: near-black neutrals carry every surface, and hue is rationed to signal. Cyan owns the primary meaning and the live state; violet is the supporting tech accent; amber, green, and rose appear only as semantic signals.

### Primary

- **Signal Cyan** (`#06B6D4`): the voice of the AI and the single brand action color — hero CTA, nav underline, live badges, section dividers, active demo states, scroll progress. **Teal End** (`#00D4C8`) is its gradient partner on the primary pill and hairline gradients — cyan leans cool-teal as it lightens. **Bright Cyan** (`#22D3EE`) is the lit accent on dark: pulsing dots, icons, waveform, focus rings. **Soft Cyan** (`#67E8F9`) is cyan text on dark: accent words, active chips, link text, score values.

### Secondary

- **Signal Violet** (`#8B5CF6`): the supporting tech accent — role-track chips, evaluation details, the violet layer of the hero bloom, purple section dividers. **Bright Violet** (`#A78BFA`) is its glyph color on dark.
- Indigo (`#4F46E5`) appears only inside the hero's ambient bloom (a third radial layer). It never touches content.

### Semantic

- **Signal Green** (`#10B981`): correctness, unlocked states, growth figures. **Bright Green** (`#34D399`) for glyphs on dark.
- **Signal Amber** (`#FBBF24`): completeness and caution. Deep variant (`#F8961E`) and soft fills (`#FDE68A`) in the completeness metric.
- **Error Rose** (`#FCA5A5` text, `rgba(244, 63, 94, 0.4)` border): demo error state only. Recording is never red on the landing — recording stays cyan.

### Neutral

- **Deepest Canvas** (`#09090B`): the page background everywhere. **Canvas Deep** (`#0C0B16`): the mid-tone of full-bleed section gradients (arena, evaluation, bento).
- **Card Surface** (`#18181B`, used translucent at ~60–88% alpha): bento, evaluation, and proof cards. The 3C arena cards drop to a lighter alpha with a radial corner tint. **Demo Surface** (`#12121A`, deepening to `#0A0A10`): the flagship Try-It-Live demo card.
- **Ink White** (`#FFFFFF`): primary text and the solid nav CTA. **Ink Dim** (`#C0C0D0`): hero sub and lead paragraphs. **Ink Secondary** (`#9CA3AF`): card descriptions and meta. **Ink Muted** (`#6B7280`): captions, timestamps, denominators. **Ink on Cyan** (`#081318`): text on cyan pills. **Ink on White** (`#09090B`): text on the solid white button.
- **Hairlines:** `rgba(255,255,255,0.06–0.12)` for card borders and separators — edges are drawn with light, not shadow.

### Named Rules

**The Signal Cyan Rule.** Cyan is the only color that moves: live states, the primary CTA, the active nav underline, the scroll-progress hairline. Violet, amber, and green are static support or semantic signals. Two moving cyan accents on one surface is a design failure.

**The One-Canvas Rule.** Every surface sits on the near-black canvas. Cards are translucent panels with hairline borders and radial tint corners — never their own new worlds with new backgrounds.

**The Cool-Cast Rule.** Dark surfaces are never pure `#000`. The `#09090B` canvas carries a cool blue cast and translucent panels pick up the same blue whisper, so the studio reads as lit, never as black.

## Typography

**Display Font:** Geist — declared stack `"Geist", "Figtree", system-ui`. The stylesheets reference Figtree ahead of Geist in every stack, but Figtree is never imported (`@import` loads Geist 400/600/700/900 and Inter only), so Geist is what actually renders. This is drift to normalize: either import Figtree or drop the reference.

**Body Font:** Inter (400/500/600/700) — body, UI, labels, meta.

**Character:** a modern technical-instrument voice. Geist's geometric sans carries display moments with a precise, slightly engineered edge; Inter handles dense body and data. The pairing reads as a calibration device that happens to be friendly — never playful-casual, never corporate-cold.

### Hierarchy

- **Display** (Geist/Figtree 700, `clamp(1.9rem, 3.6vw, 2.9rem)`, line-height 1.12, `-0.75px`): hero headline (max 14ch), final CTA (`clamp(1.75rem, 4.6vw, 2.875rem)`), evaluation headline (`clamp(1.75rem, 4.5vw, 2.75rem)`). One display moment per viewport; `text-wrap: balance` on page-level questions.
- **Headline** (Geist/Figtree 700, `clamp(1.1rem, 2.5vw, 1.375rem)`, line-height 1.3): card titles, bento titles, journey-step names, fact-tile titles.
- **Section Label** (Geist/Figtree 600, `clamp(0.75rem, 1.5vw, 0.8125rem)`, 3px tracking, uppercase): "THE 3C RUBRIC", "Objective evaluation", "How it works" — always beside an 8px colored dot (cyan or amber).
- **Body** (Inter 400, `clamp(0.9375rem, 1.6vw, 1.0625rem)`, line-height 1.65): hero sub, CTA sub, section intros — held to ~48–65ch. Card descriptions step down to `clamp(0.8125rem, 1.5vw, 0.875rem)` at 1.55.
- **Label** (Inter 600, 11–12px, 0.3–1.2px tracking): status chips, live badges, attempt counters, timestamps, score-chip labels. Uppercase where it reads as a phase or badge.

### Named Rules

**The One-Display Rule.** Display/headline sizes are reserved for brand moments and page-level questions. One display-scale element per viewport at a time.

**The Weight-Separation Rule.** Hierarchy is carried by weight and size steps (700 display → 700 card titles → 600 labels → 400 body), never by color alone on a dark canvas.

## Layout

- **Nav:** sticky, 64px, glass — `rgba(9,9,11,0.62)` backdrop with `blur(18px) saturate(150%)` — and a 1px inner bottom hairline. Logo (34px mark + 1.0625rem/700 wordmark) left, 13px muted links center, CTA pair right. The active link carries a 2px cyan gradient underline; a 2px cyan scroll-progress hairline runs along the bottom edge (scroll-driven CSS, no JS listeners). Below 900px the nav collapses to a hamburger with a staggered dropdown.
- **Hero:** full viewport height (`100dvh − 64px`) at desktop, `5fr 7fr` copy/demo split above 1024px, content capped at 1400px.
- **Section rhythm:** `--lp-px: clamp(1rem, 5vw, 5rem)` horizontal, `--lp-py: clamp(3rem, 7vw, 6rem)` vertical. Each content section (arena, evaluation, bento) is a full-bleed canvas gradient — `canvas → canvas-deep → canvas` — that starts and ends on the base canvas so bands never seam on wide viewports. 2px cyan/violet divider hairlines separate major sections.
- **Grids:** 3C cards 1 → 2 → 3 columns at 640/900px; evaluation `5fr 6fr` at 900px; bento an asymmetric 12-column grid at 900px (spine 7 / roles 5, then mastery 5 / session 7) with a 1rem gap; hero split at 1024px.
- **Measure:** content maxes at 1400–1440px; body copy ~48–65ch; grid gaps 8–24px.
- **Responsive:** single column under 900px; touch targets ≥ 40px; grids collapse rather than squeeze.

## Elevation & Depth

Depth is **flat-by-default with light**: surfaces distinguish themselves by translucency and hairline borders first; shadows add faint lift; color is reserved for the signal.

### Light & Shadow Vocabulary

- **Card hairline:** `1px rgba(255,255,255,0.06–0.12)` — the default edge for every panel.
- **Card lift:** translucent `#18181B` surface + hairline; bento cards rise `translateY(-4px)` on hover with a single white sheen sweep (0.85s) and a `rgba(255,255,255,0.02–0.03)` overlay.
- **Demo card:** the deepest moment — `0 24px 48px -24px rgba(0,0,0,0.6)` with an inset top highlight; a quiet cyan hairline ring appears while speaking/recording.
- **Chrome blur:** `backdrop-filter: blur(18px) saturate(150%)` — glass on the sticky nav only, never on content cards.
- **Signal shadows:** cyan-tinted CTAs cast `0 8px 24px -12px rgba(6,182,212,0.5)` — the single sanctioned colored shadow, on primary conversion only.
- **Ambient light:** the hero's breathing radial bloom (cyan/violet/indigo, 26s), the demo halo (7s), the CTA's single cyan wash, and the blueprint grids — 56px cyan/violet hairlines under the hero (radially masked), 52px white hairlines in the evaluation section.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat translucent panels with hairline borders at rest. Shadows appear only as ambient lift — never as hard outlines or decorative drop shadows on content.

**The Chrome-Only-Glass Rule.** Backdrop blur is a chrome material: the sticky nav only. Glass on content cards is drift.

**The Signal-Shadow Rule.** Colored shadows belong to primary conversion only. The cyan CTA tint is the single sanctioned colored shadow; anything else that glows is noise.

## Shapes

The form language is **precision-rounded** — soft enough to feel approachable, regular enough to read as engineered.

- **Radius scale:** 8px (rows, journey steps), 10px (controls, chips, set rows), 12px (cards, panels, icon tiles), 16px (flagship demo card), 9999px (pills — buttons, badges, status, timestamps).
- **Pills for small things:** buttons, chips, badges, attempt counters, status chips, the mic button.
- **Cards:** 12px corners, hairline border, translucent fill. The 3C arena cards carry a 2px top accent hairline in their dimension color (cyan/green/amber) that sweeps in on hover, plus a radial corner tint in the same hue.
- **Icon tiles:** square tiles, 10–12px radius, tinted background + accent glyph (cyan/purple/green families).
- **Metric bars:** 2px tracks with rounded gradient fills; segment scale bars are 3px rounded segments.
- **The AI orb:** a top-lit violet sphere (`#31306B → #0E0E26` radial) with a 5-bar white waveform inside; a cyan ring pulses on speak/record states.
- **Waveform:** 2px bars that scaleY-bounce on active states only, staggered by bar.

## Components

### Navigation

Sticky 64px glass bar — `rgba(9,9,11,0.62)` + `blur(18px) saturate(150%)`, hairline bottom edge, logo left, 13px muted links center (white on hover with a 2px cyan gradient underline; scroll-spy keeps the underline on the active section), CTA pair right. The bottom edge carries the 2px cyan scroll-progress hairline. Below 900px: hamburger → staggered dropdown with full-width buttons.

### Buttons

- **Primary:** cyan pill — a two-stop `#06B6D4 → #00D4C8` gradient (the final CTA uses flat cyan to avoid a visible seam on some displays), `#081318` ink, 700 weight, a single white sheen sweep on hover, cyan tint shadow. Active scales to 0.98.
- **Solid (white):** the nav "Start practicing" — white fill, `#09090B` ink, pill.
- **Ghost:** transparent, `1px rgba(255,255,255,0.16)` border, dim text; hover brightens the border and adds a `rgba(255,255,255,0.07)` fill.
- **Section CTA link:** cyan-tinted pill — `rgba(34,211,238,0.06)` fill, `rgba(34,211,238,0.22)` border, `#67E8F9` text, trailing arrow.
- **Disabled:** 0.4 opacity, `not-allowed` cursor, no transform.

### Section Labels

Uppercase 600, 3px tracking, 8px colored dot — cyan for "Objective evaluation" and "How it works", amber for "THE 3C RUBRIC". The label is a phase marker, not the headline; the heading it precedes carries the meaning.

### Cards / Containers

12px radius, translucent `#18181B` fill, 1px hairline border, generous padding. The 3C arena cards are the signature variant: dimension-tinted border (`rgba(6,182,212,0.22)` / `rgba(16,185,129,0.22)` / `rgba(251,191,36,0.22)`), radial corner tint, a 2px top accent hairline that fills on hover, and a metric footer (score value + 2px gradient fill bar). Bento cards lift `-4px` on hover with a sheen sweep. The evaluation proof card and the evidence strip follow the same translucent + hairline language.

### Chips / Badges / Status

- **Role chips:** pill, violet-tinted fill (`#8B5CF6` at ~5% alpha), colored dot, name + description, hairline in the accent.
- **Status chip:** muted grey idle → cyan active (`#67E8F9` text, `rgba(34,211,238,0.06)` fill) with a 5px pulsing dot.
- **Live badge:** cyan-tinted pill, pulsing 5px dot, 1.2px tracking uppercase label.
- **Locked tier:** `#FFFFFF06` fill, muted grey text, "Locked" pill; unlocked tiers take the accent tint (green at ~7% alpha) with white text.

### The Signature Component: The Mic Button

The landing expression is a **cyan gradient pill** (`#0891B2 → #06B6D4`) with the mic glyph and a countdown; while recording it quiets to a dark cyan-hairline surface (`rgba(34,211,238,0.1)` fill, `rgba(34,211,238,0.3)` border) — recording is never red on the landing. The app-flow orb (`pt-mic-btn`, an 80px white circle that fills red while recording) is legacy from the retiring world.

### Try-It-Live Demo Card

The flagship artifact: 16px radius, dark gradient surface (`#12121A → #0A0A10`), hairline border that turns cyan while speaking/recording. Inside: a cyan-ringed AI orb with a 5-bar waveform, a muted→cyan status chip, a question panel, a transcript box with a pulsing "Transcribing" pill and timestamp, and three 3C score chips that go neutral → single cyan accent when a score lands. Segment scale bars fill in the accent. The demo has a 3-attempt cap before the auth modal appears.

### Final CTA & Footer

Display headline with a single cyan accent word, a flat cyan pill button, and a muted trust line. Footer: canvas background, cyan-tinted hairline divider, muted links that turn cyan on hover.

## Do's and Don'ts

### Do:

- **Do** let signal cyan (`#06B6D4`) be the single moving accent — live states, primary CTA, active nav underline — and keep it rare so its movement carries meaning.
- **Do** keep every surface on the near-black canvas (`#09090B`) with a cool blue cast; never pure `#000`.
- **Do** draw edges with light: translucent card surfaces, 1px hairlines at `rgba(255,255,255,0.06–0.12)`, radial tint corners.
- **Do** round everything: 8px rows, 12px cards, 16px demo card, pills for buttons, chips, and badges.
- **Do** lead with Geist for display and Inter for body; keep labels 11–13px uppercase with tracking.
- **Do** use the blueprint grid and construction hairlines as the page's measuring language — grids belong under the hero and evaluation sections, not on every card.
- **Do** keep motion purposeful: it appears when the product is alive (waveform, pulsing dot, scroll hairline) and collapses entirely under `prefers-reduced-motion`.
- **Do** keep one display-scale moment per viewport; use `text-wrap: balance` on page-level headlines.

### Don't:

- **Don't** reintroduce the lavender/white "calm room" surfaces — the app-flow pages are mid-migration to this studio world, not a second theme.
- **Don't** use harsh pure `#000` or pure-white-on-black text blocks; dark surfaces carry the `#09090B` blue cast.
- **Don't** put more than one moving accent on a surface; violet, amber, and green are static support and semantic signals, never live-state colors.
- **Don't** add neon glows or heavy drop shadows; the cyan-tinted CTA shadow is the single sanctioned colored shadow.
- **Don't** use gradient text, and keep gradients functional: the cyan primary pill, full-bleed section bands, the demo surface, and ambient blooms — never decorative washes on content cards.
- **Don't** apply glass/blur beyond the sticky nav chrome.
- **Don't** let Figtree hang unloaded: the display stack references it ahead of Geist but never imports it — import it or drop the reference.
- **Don't** ship a surface that needs a tutorial to parse; the studio reads as a precision instrument, not a control panel.

