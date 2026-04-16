# Home Screen UX And Katchimera Design System

This document is the detailed reference for the post-onboarding core app experience. It expands on `docs/katchimera-app-mvp-design.md` and defines the intended Home screen behavior, Katchimera visual system, and the daily interaction loop.

Related reference:

- `docs/add-moment-rotary-capture-flow.md`

## 1. Core Principle

The Home screen is a living timeline of time itself:

past -> present -> future in one place

## 2. Full Layout

Top to bottom:

- Timeline, scrollable with snap
- Hero, Egg or Creature
- Context area, moments or highlight
- Insight + Paths, subtle lower layer

## 3. Timeline

### Purpose

- Navigation
- Reinforce the daily loop
- Show collection and continuity

### Visual structure

- Horizontal scroll strip
- Center item is the active day
- Slight perspective scaling

### Items

- Past days
  - small creature icons
  - slightly dimmed
- Today
  - egg if not hatched
  - creature if completed
  - larger and glowing
- Tomorrow
  - ghost egg
  - semi-transparent
  - subtle shimmer

Example mental model:

`[ past ][ past ][ today ][ tomorrow ]`

### Interaction

- Swipe horizontally
- Snap to nearest day
- Center item updates the full screen

### Selected-state behavior

- Past -> Hero shows Creature
- Today -> Hero shows Egg or Creature
- Tomorrow -> Hero shows locked Egg

## 4. Hero Area

This is the centerpiece.

### Today, forming state

Visual:

- large egg centered
- roughly 35-45% of screen height

Animation:

- slow breathing scale
- internal energy swirl
- reacts to inputs

### Today, completed

Visual:

- Creature replaces egg

Animation:

- idle loop
- breathing and glow
- subtle particles

### Past day

Visual:

- Creature only

Animation:

- calmer than the present-day state

### Tomorrow

Visual:

- dim egg
- blurred glow
- no interaction

## 5. Context Area

This changes with the selected day.

### Today

Shows:

- Add moment button
- moments strip after first input

Moments strip:

- floating chips
- no hard card containers

Example chips:

- Coffee
- Walk
- New place

Behavior:

- new moment appears
- chip floats
- chip merges into the egg

### Past day

Shows:

- highlight text as the main summary
- list of moments

Example:

"A quiet morning at your favourite cafe"

### Tomorrow

Shows minimal text:

"Not yet formed"

## 6. Add Moment Flow

### Entry points

- Tap on egg
- Secondary Add moment button if needed for accessibility and discoverability

### UI

Egg-centered radial carousel with:

- Quick tags
- Photo
- Note
- Voice
- Mood or energy
- Location or outing

### Interaction

- tap egg opens a circular orbit around the egg
- orbit items bloom outward and settle with gentle rotation
- selecting a quick tag creates the moment immediately
- selecting `Photo` transitions the orbit into recent-photo thumbnails around the egg

Quick-tag requirement:

- no confirmation screen
- stay one tap where possible

### Feedback

- chip appears
- selected item animates into the egg
- egg pulses or glows
- ring collapses cleanly

### Photo path

- request permission only when `Photo` is tapped
- keep the user in the egg-centered flow whenever possible
- show recent photos in the orbit
- prefer real camera photos over screenshots where the platform path supports it
- if filtering is unavailable, fall back gracefully to recent images

## 7. Insight + Paths

This is the subtle bottom layer, not a stats dashboard.

### Default state

"Your days have been calm this week..."

### Expanded state

- Insight text
- Path 1
- Path 2

### Path example

- Path of Energy
  - "A burst of movement today could awaken something rare."
- Path of Calm
  - "Leaning into calm might shape something deeper."

### Interaction

Tap path:

- egg reacts
- internal bias is applied to today's generation

## 8. Full User Flow

### Morning

- user opens app
- sees egg
- no pressure

### Day

- user adds moments or passive data accumulates
- egg evolves

### Evening

- egg becomes more active

### Night

- hatch sequence triggers

### After hatch

- creature appears
- highlight is shown

### Next day

- timeline shifts
- loop repeats

## 9. Katchimera Core Identity

A Katchimera is a living embodiment of a day's energy.

## 10. Signature Style

These are non-negotiable.

All creatures must share:

1. Core energy source
   - glowing internal core
   - visible through the body
2. Soft, premium materials
   - glass, light, soft fur
   - no flat shading
3. Rounded silhouettes
   - friendly
   - approachable
4. Energy expression
   - particles
   - glow trails
   - aura
5. Subtle alive motion
   - breathing
   - pulsing
   - drifting

## 11. Shared Visual Language

- Energy = brightness + motion
- Calm = softness + slow animation
- Social = warmth + openness
- Exploration = trails + asymmetry
- Focus = symmetry + structure

## 12. Creature Generation Model

### Step 1

Collect inputs:

- moments
- steps
- location
- sleep

### Step 2

Map inputs into five dimensions:

- energy
- calm
- social
- exploration
- focus

### Step 3

Pick:

- dominant trait
- secondary trait

### Step 4

Assign archetype

- Energy -> agile / electric
- Calm -> soft / floating
- Social -> warm / multi-orbit
- Exploration -> flowing / airy
- Focus -> geometric / stable

## 13. Link To Moments

This is critical. Each creature must visibly reflect moments.

Example mapping:

- Coffee
  - warm glow
  - steam-like particles
- Walk
  - motion trails
  - light streaks
- New place
  - exploratory shape
  - extended limbs or flow
- Calm
  - soft body
  - slow animation
- Social
  - multiple orbiting lights
  - warm palette

Rule:

At least one to two visible traits must match the user's moments.

## 14. Rarity System

Based on:

- total intensity
- diversity of inputs
- breaking weekly pattern

Visual differentiation:

- Common -> simple glow
- Rare -> particles
- Epic -> complex aura
- Legendary -> evolving or animated form

## 15. Personalization

Each creature must vary through:

1. Color palette
   - influenced by user preference and day signals
2. Shape variation
   - slight form differences
3. Motion style
   - faster or slower

This is what prevents the system from feeling repetitive.

## 16. Naming System

Structure:

`[theme root] + [suffix]`

Examples:

- Creamalume
- Voltstep
- Driftelle
- Solarae

## 17. Pre-Hatch Foreshadowing

Eggs should hint at what is forming.

Examples:

- energetic day -> flickering light
- calm day -> smooth glow

The egg should never be purely generic if signals already exist.

## 18. Final System Summary

### Home screen

- timeline controls everything
- egg is the present
- creatures are the past
- tomorrow creates anticipation

### Katchimeras

- unified visual language
- driven by real signals
- linked to moments
- infinitely variable within a controlled system

### User experience

- simple input
- meaningful output
- daily loop

## 19. Engineering Interpretation

For implementation purposes, this spec implies:

- the Home screen is a state-driven screen, not a set of independent widgets
- the selected timeline day is the primary state axis
- today's egg must support live mutation from moments, passive signals, and path selection
- Add Moment should be treated as an egg-centered state machine, not a generic modal picker
- creature generation must stay deterministic enough to be explainable, even if presentation feels magical
- visible creature traits must remain traceable back to input signals and moments

## 20. Current Repo Fit

Relevant current pieces:

- `components/katchadeck/timeline/day-timeline.tsx`
  - already matches the timeline mental model closely
- `app/(tabs)/index.tsx`
  - should evolve into the real Home screen
- `constants/timeline-demo.ts`
  - good for prototyping structure, but not production data
- `app/(tabs)/explore.tsx`
  - can remain a world or collection view rather than the main daily loop

The current implementation is still a stylized prototype. This document defines the intended production-facing behavior.

## 21. Day Map Layer

The Home screen now includes a spatial memory layer for past days.

### Placement

For a selected past day:

- Creature remains the hero
- Highlight remains the main textual summary
- Day Map preview sits directly below the highlight
- moments follow underneath

This keeps the map secondary to the creature, while still making place visible.

### Interaction

The embedded preview should feel quiet and preview-like:

- compact height
- minimal interaction
- CTA: `View day map`

The dedicated day map route holds the richer interaction:

- tap node for a detail card
- tap map to dismiss

### Visual language

The Day Map should follow the same KatchaDeck design language:

- glowing orbs instead of literal pins
- soft path line instead of route chrome
- creature accent color drives the map accent
- restrained motion and low visual density

### Important boundary

This map is not a live movement view for today.

In MVP, the map is reflective:

- past-day preview on Home
- full-screen day memory map on demand

That preserves the app's identity as reflection over tracking.
