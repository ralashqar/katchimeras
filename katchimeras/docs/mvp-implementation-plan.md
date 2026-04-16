# Katchimeras MVP Implementation Plan

This plan sequences the convergence work needed to turn the current repo into the intended Katchimeras MVP.

The app already contains most of the right building blocks. The work now is to tighten the product around one clear loop instead of growing more side surfaces.

Related references:

- `docs/katchimeras-core-mvp.md`
- `docs/katchimera-app-mvp-design.md`
- `docs/add-moment-rotary-capture-flow.md`

## Goal

Ship a Home-first, iPhone-first, local-first MVP around:

`today's egg -> passive + manual shaping -> nightly hatch -> shareable memory postcard -> past-day memory with map`

## Execution Order

### 1. Lock the product framing

- make `docs/katchimeras-core-mvp.md` the source of truth
- treat older KatchaDeck deck/world language as future-phase reference
- align user-facing copy around Katchimeras, daily memory, and hatch ritual

### 2. Strip navigation to the MVP

- keep Home as the main user-facing surface
- keep `/day-map/[dayId]` as the secondary route from Home
- hide the World tab from the production MVP path
- remove premium/world/deck emphasis from the main journey

### 3. Rewrite onboarding around the real loop

- explain the premise directly
- show one clear example of a day gathering and hatching
- let the user choose a light tone preference
- explicitly prime location and steps
- land the user directly in today's egg

### 4. Strengthen the local day model

- keep the current local orchestration model
- extend the stored day contract with:
  - `stepsCount`
  - `visitedPlaceCount`
  - `newPlaceCount`
  - `locationSampleCount`
  - `shareReadyAt`
- keep deterministic generation and highlight selection

### 5. Make passive-only days real

- ingest foreground location
- ingest step count
- let passive inputs affect egg state and final scores
- ensure a day can hatch meaningfully even with no manual moment

### 6. Formalize the nightly hatch ritual

- hatch once per day
- trigger on first open after the hatch threshold
- keep the hatched result stable after reopen
- surface creature, highlight, map, and share from the same day record

### 7. Add sentimental sharing

- build a postcard composition from local state
- include:
  - creature hero
  - day label/date
  - one emotional line
  - subtle place-memory cue
- share through the native share sheet with no backend requirement

### 8. Polish past-day memory reading

- keep past-day presentation emotional and low-noise
- show creature first
- keep highlight as the primary text
- keep the day map as reflective context, not tracker chrome
- keep the moments list simple

## Non-Goals For This Phase

- moving the core loop to Supabase
- shipping auth-backed ownership
- growing the World tab
- building premium purchase flow
- building broad social mechanics
- turning the app into a metrics dashboard

## Test Checklist

- onboarding explains the concept and ends in Home
- denied permissions do not dead-end the user
- passive-only days can still form and hatch
- manual-only days can still form and hatch
- location and steps visibly influence the egg before hatch
- the hatch is stable across relaunch
- past days show creature, highlight, map, and moments
- the postcard share flow works from a hatched day without backend support
