# Lantern — the Katchimeras design language

Status: the spec behind the full UI revamp. The visual source of truth is the
"Katchimeras — Lantern" project on claude.ai/design (synced from `/design` in
this repo); this doc records the decisions so implementation doesn't drift.

## The idea

The product is a nightly ritual lit from within. Lantern's single rule:
**light = life.** The world is violet-black ink; warmth exists only where
something is alive (the egg, a creature, a glow core) or where the user is
invited to act (the one amber CTA per screen). Everything else recedes.

What this replaces: the current navy glassmorphism — bordered translucent
panels everywhere, blue-on-blue, every element glowing a little. Lantern keeps
the nocturnal premium feel but trades "everything is glass" for "almost
everything is quiet, a few things burn."

## Tokens

### Color
| Token | Value | Use |
|---|---|---|
| ink-950 | `#0C0A14` | app background (violet-black, not navy) |
| ink-900 | `#14111F` | surface 1 — resting cards |
| ink-800 | `#1C1830` | surface 2 — raised cards, sheets |
| dusk-700 | `#272140` | surface 3 — chips, inputs, highest rest |
| line | `rgba(196,186,240,0.08)` | hairlines (inputs only — cards are borderless) |
| moon-50 | `#F6F3FF` | primary text |
| moon-300 | `#C9C2E8` | secondary text |
| moon-500 | `#908AB5` | tertiary text, labels |
| ember-300 | `#FFC36B` | CTA gradient start |
| ember-500 | `#F58E3C` | CTA gradient end / primary accent |
| ember-glow | `rgba(245,142,60,0.35)` | CTA outer glow |
| aurora-violet | `#A78BFA` | supporting accent, rings |
| aurora-teal | `#7DE8CD` | supporting accent, success/places |
| aurora-rose | `#F49AC1` | supporting accent, social |

Per-character accents (already in `homeCreatureVisuals`) ride on top and own
their creature's halo, ring, and cue pill.

### Type
- **Instrument Serif** — display only. Creature names set 56–64px *italic*;
  screen titles 38–42px roman. Never below 24px.
- **Manrope** — everything else. Body 16/24, secondary 14/20,
  label 12 caps with 0.18em tracking, weight 600–700 for labels only.

### Shape & elevation
- Radii: 16 (chips/inputs), 24 (cards), 32 (sheets/hero), pill for actions.
- Cards are **borderless**. Elevation = layered umbra shadow + (for living
  things only) a colored glow. Hairline borders are reserved for inputs.
- Continuous corner curves everywhere.

### Spacing & layout
- 24px side gutters, 12/20/28/40 vertical rhythm.
- One oversized hero stage per screen (~320px) — the egg/creature is the
  protagonist; UI is the supporting cast.
- Floating pill tab bar, detached from the screen edge.

## Signature motifs (the brand carriers)

1. **Lantern CTA** — one per screen: amber gradient pill (`ember-300 →
   ember-500`), dark-ink text, warm outer glow. Secondary actions are quiet
   dusk pills; tertiary are text-only.
2. **Aurora ring** — conic violet→teal→ember gradient ring; frames timeline
   day orbs and collection entries. Hatched days earn the ring; forming days
   show a faint dashed moon ring.
3. **Glow chip** — moment chips: dusk pill, no border, a colored dot + soft
   matching inner bloom. Color = the moment's accent.
4. **Constellation divider** — dotted hairline with 2–3 brighter star nodes;
   replaces hard section borders.

## Motion principles

- Springs for anything alive (egg, creatures, chips landing): stiffness ~180,
  damping ~18. Timing curves for chrome: 240ms standard, 420ms reveals.
- The hatch is the only full-screen takeover; everything else moves in place.
- Respect the existing interaction physics (drag membrane, breathing) — they
  are part of the brand.

## Screen blueprint (what the mockups define)

| Screen | Key changes from current |
|---|---|
| Home — today | Egg owns the top half on bare ink (no panel). Timeline = aurora-ring orbs. Single lantern CTA ("Add a moment"). Passive signals = one quiet constellation row, not chip noise. |
| Home — hatched | Creature name in 60px italic serif, encounter kicker above it in ember caps, reflection as a quote-styled card, Share as the lantern CTA. |
| Hatch reveal | Full-bleed ink takeover (no glass panel): cracked egg center, chips converging, copy bottom-anchored. |
| Onboarding — cast | Full-bleed character moments, one per viewport-ish, cutouts at 180px+ with their accent halo. |
| Onboarding — ritual | Hour picker as a horizontal dial of lantern pills; egg preview above. |
| Postcard | 4:5, creature huge, name serif italic, cue pill, constellation footer, map as faint star-path — built to be posted. |
| Collection | New surface: month grid of aurora-ring orbs (creature faces), empty days as faint dots — the deck that "emerges". |

## Implementation order (after design approval)

1. `constants/theme.ts` — new token set (additive: `Lantern` object), fonts unchanged (already Instrument Serif + Manrope).
2. Primitives: `LanternButton`, glow-chip restyle of moment chips, aurora ring component, constellation divider.
3. Screen-by-screen: Home → hatch overlay → onboarding → postcard → collection (new route).
4. Delete-glass pass: remove borders/BlurViews made redundant.

Each step is its own PR against the design mockups as acceptance criteria.
