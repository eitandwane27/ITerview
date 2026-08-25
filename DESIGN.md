---
name: ITerview
description: "AI-powered voice mock-interview practice for Filipino IT students — a bright, friendly practice room: pure-white canvas, trust-blue accent, soft geometric type, calm-second-person copy. Playful enough to ease interview anxiety, simple enough to parse at a glance."
colors:
  # Canvas & Surfaces — light-first, always
  canvas: "#FFFFFF"
  canvas-tint: "#F6F8FB"
  surface-card: "#FFFFFF"
  surface-raised: "#F6F8FB"

  # Ink — near-black with a cool cast, never pure #000
  ink: "#101318"
  ink-secondary: "#4B5563"
  ink-muted: "#9AA1AD"
  ink-on-primary: "#FFFFFF"

  # Borders — hairline, honest, no glass
  border-hairline: "rgba(16, 19, 24, 0.10)"
  border-strong: "rgba(16, 19, 24, 0.18)"

  # Primary — trust blue. RESERVED for: primary CTAs, links,
  # and ALL live/recording states (the mic's one true color).
  blue: "#2B6EF2"
  blue-hover: "#1E5BE0"
  blue-pressed: "#174BC4"
  blue-soft: "#EAF0FE"
  blue-softer: "#F4F7FE"

  # Support — semantic only, never decorative washes
  green: "#12A150"
  green-soft: "#E7F7EE"
  amber: "#F5A524"
  amber-soft: "#FEF4E2"

  # Error — coral is for errors ONLY, nowhere else
  coral: "#E5484D"
  coral-soft: "#FDECEC"
typography:
  fontFamily: "'Manrope', 'Segoe UI', system-ui, -apple-system, sans-serif"
  display:
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-1.2px"
    textWrap: "balance"
  headline:
    fontSize: "clamp(1.25rem, 2.6vw, 1.75rem)"
    fontWeight: 800
    lineHeight: 1.22
    letterSpacing: "-0.4px"
  subhead:
    fontSize: "clamp(1rem, 2vw, 1.125rem)"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontSize: "clamp(0.9375rem, 1.5vw, 1.0625rem)"
    fontWeight: 500
    lineHeight: 1.65
  label:
    fontSize: "0.8125rem"
    fontWeight: 700
    letterSpacing: "0.02em"
  micro-label:
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.08em"
    textTransform: "uppercase"
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
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
  space-24: "96px"
---

# Design System: ITerview

## Design Principles

1. **Calm-second-person voice.** Copy names the visitor's anxiety, then dissolves it in one short sentence. Never hyper-perky, never gamified pressure — no streak guilt, no countdown dread. The vibe target: "it's okay to mess up here; that's the point."
2. **One accent, rationed.** Blue is the only color that moves. It marks the CTA, the link, and the live microphone — and nothing else. Green/amber are static semantic states (success, progress). Coral appears only on errors.
3. **Recording is never red.** All listening/recording/live-transcribing states take the reserved blue (`#2B6EF2` family): soft fills, blue glyph, blue waveform bars. Red/coral is semantically fenced to errors forever.
4. **Flat and honest.** Depth is expressed with hairline borders and at most a 1px whisper shadow. No glass, no backdrop-blur, no neon glow, no grain overlays, no gradient text. A surface looks like a surface.
5. **Generous whitespace.** Section rhythm is air: 64–96px between sections, 24–32px inside cards. When in doubt, add space instead of decoration.
6. **Motion = encouragement.** Springy easings (~200–350ms, slight overshoot), a gentle idle "breathing" on the orb, one celebratory moment when a score lands. All motion collapses under `prefers-reduced-motion`. Motion celebrates the user; it never nags them.

## Component Laws

### Buttons
Pills only. Primary = flat blue fill, white label, no border, no shadow; hover darkens one step, active presses down (`translateY(1px)` + darkest blue). Secondary = transparent with a 2px hairline border (the brilliant.org pattern); hover warms the border and tints the fill `blue-softer`. Quiet/tertiary = plain blue text on transparent.

### The Mic Button & Live States
The mic is the product's heartbeat. Idle: white pill with 2px hairline border and ink glyph. Listening/recording: the border and glyph turn reserved blue, fill takes `blue-soft`, waveform bars render blue. Never red, never coral, never amber. The transcript's live dot and the "Transcribing" pill follow the same blue.

### Try-It-Live Demo Card
The flagship artifact, re-dressed for daylight: white surface, 24px radius, 2px hairline border that turns solid `blue` while listening/recording. Inside: the AI orb (soft blue ring, breathing idle animation), question panel on `canvas-tint`, transcript box with hairline divider, and three 3C score chips laid out as a row on desktop (not stacked). Chips go `chip-neutral` → single blue accent when a score lands; success confirmation may use green. The 3-attempt cap before the auth modal is behavior, not style — keep it.

### The Logo Slot
All logo/artwork placements are defined containers so AI-generated art can drop in later without layout shift or CSS surgery:
- `.logo-slot--nav`: fixed 44×44 box, `rounded.sm`, centered content, neutral placeholder glyph.
- `.logo-slot--hero`: up to 96×96 available; component owns its own box.
Artwork swaps via one `<img>` inside the slot; the slot itself never changes size.

### Chips & Badges
Pill radius, soft-fill + strong-text pairs from the token set only (`blue/blue-soft`, `green/green-soft`, `neutral/canvas-tint`). No new color pairings at point of use.

## Do's and Don'ts

### Do:

- **Do** let trust blue be the single moving accent — primary CTA, links, live/recording states — and keep it rare so its movement carries meaning.
- **Do** keep every surface light: pure-white canvas, `#F6F8FB` tint bands for section rhythm, near-black ink with the cool cast. Light theme is the theme.
- **Do** draw edges honestly: 1–2px hairline borders, at most a 1px `rgba(16,19,24,0.04)` shadow. Borders before shadows, always.
- **Do** round generously: 10px small elements, 16px inputs/rows, 24px cards, pills for buttons/chips/badges.
- **Do** lead all type with Manrope; display weight 800 with tight tracking (-1.2px), body weight 500. Use `text-wrap: balance` on page-level headlines.
- **Do** keep copy calm-second-person: name the fear, dissolve it in one sentence.
- **Do** celebrate completion exactly once per interaction (score reveal), springy but brief.
- **Do** collapse all motion under `prefers-reduced-motion`.

### Don't:

- **Don't** reintroduce any dark-studio element: near-black canvases, cyan/violet accents, glass/backdrop-blur, film grain, blueprint grids, gradient text, neon glow shadows. The old world is retired — polish it into nothing rather than mixing it in.
- **Don't** add a second accent color to "help"; if something feels plain, add whitespace or weight, not hue.
- **Don't** let recording states drift toward red/coral under any circumstance.
- **Don't** stack more than one moving element per viewport region; idle animations stay gentle (scaleY 0.8–1.0 over ~3s max).
- **Don't** gamify pressure: no streak guilt, no urgency timers, no loss framing anywhere.
- **Don't** ship a font stack referencing families that were never imported — import Manrope (400/500/700/800) once, globally, or don't name it.
- **Don't** resize or restyle `.logo-slot` when artwork changes; the slot is contract-stable.
- **Don't** ship a surface that needs a tutorial to parse; the practice room reads at a glance.

