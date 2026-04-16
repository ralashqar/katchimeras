# Katchimeras Core MVP

This is the source-of-truth product brief for the current Katchimeras MVP.

It replaces older deck-first framing for the core app loop. The MVP is now:

`today's egg -> passive + manual moments -> nightly hatch -> sentimental memory postcard -> past-day memory with map -> tomorrow anticipation`

Related references:

- `docs/mvp-implementation-plan.md`
- `docs/katchimera-app-mvp-design.md`
- `docs/add-moment-rotary-capture-flow.md`

## Summary

Katchimeras is a calm, reflective lifestyle app where each day becomes a creature.

The app should feel:

- sentimental
- lightly magical
- therapeutic
- non-judgmental
- reflective rather than analytical

The emotional promise is simple:

- your day becomes something living and keepable

## Core Flow

### Morning

- the user opens the app and sees today's egg
- the screen is never empty
- no pressure is applied if nothing has been added yet

### Daytime passive shape

- foreground location capture quietly leaves a memory trace
- step count adds movement and energy
- the egg reacts to passive signals even without manual input

### Daytime active shape

- the user feeds the egg through quick tags, photos, or inspiration moments
- the egg-centered radial capture flow remains the native interaction
- every added moment should feel like it is absorbed into the egg

### Nightly reveal

- after the hatch threshold, the day becomes ready
- the first open after that threshold triggers the formal hatch
- the hatch reveals:
  - one creature
  - one emotional highlight line
  - the moments that mattered
  - the place-memory layer for that day
  - a share CTA for the memory postcard

### Afterward

- past days remain browsable from the timeline
- tomorrow remains visible as a ghost egg
- the app keeps continuity through the week without becoming a stats dashboard

## MVP Surfaces

### Keep in MVP

- Home as the uncontested main surface
- timeline across past, today, and tomorrow
- egg hero
- hatch sequence
- radial moment capture
- day map route
- local-first deterministic generation
- memory postcard sharing

### Defer from MVP

- World tab as a user-facing primary surface
- premium preview in the core loop
- avatar/deck identity systems
- backend-first auth and schema work
- broad social systems beyond sharing one day's postcard

### Remove from MVP framing

- deck-first product language
- collection-first onboarding
- premium-heavy onboarding beats
- tracker-style activity language
- retention mechanics based on grind, streaks, or flex

## Product Rules

- Reflection over tracking
- Memory over metrics
- Calm magic over gamified pressure
- One strong daily artifact over many weak outputs
- Passive sensing should enrich the day, not dominate the interface
- Sharing should feel sentimental, not performative

## Viral And Retention Design

### Viral wedge

The first share artifact is a sentimental memory postcard.

It should lead with:

- the Katchimera
- one emotional line
- a subtle place-memory cue

It should not lead with:

- stat flex
- streaks
- rarity bragging
- competitive language

### Retention loop

- the egg is visible every morning
- the hatch becomes a nightly return ritual
- the timeline shows continuity across the week
- past days stay emotionally revisitable through creatures and maps
- tomorrow's ghost egg creates anticipation without pressure

## Passive Inputs

The first real MVP is iPhone-first and local-first.

Mandatory passive inputs:

- foreground location
- step count
- manual moments always available as fallback

Optional enrichment:

- Apple Health workout route import for selected days

Denied permissions must never block the core loop.

## Acceptance Shape

The MVP is working when:

- a passive-only day can still hatch into a meaningful creature
- a manual-only day can still hatch into a meaningful creature
- the user understands the app in under a minute
- the day map reads like memory, not telemetry
- the share postcard feels worth sending to another person
