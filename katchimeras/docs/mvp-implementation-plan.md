# MVP Implementation Plan

This plan describes how to move from the current prototype to the intended Home-screen-driven MVP. It covers frontend, backend, and Supabase work together, with explicit sequencing so the system stays coherent.

## 1. Recommended Architecture Direction

### Product target

The app should become:

- onboarding -> permissions -> Home
- Home as the primary daily loop
- deterministic signal-to-creature system
- subtle, magical presentation over explainable rules

### Technical recommendation

Use a shared domain model with three layers:

1. Presentation layer
   - Expo Router screens
   - animation and interaction
   - optimistic local state
2. Domain layer
   - pure rules for moments, scores, paths, rarity, creature traits, names
   - no React or native dependencies
3. Persistence and orchestration layer
   - Supabase tables
   - Storage
   - Edge Functions or RPCs for authoritative writes and hatch finalization

### Identity recommendation

For MVP, use Supabase anonymous auth instead of hard local-only identity.

Reason:

- preserves low-friction onboarding
- enables per-user rows and RLS
- avoids pretending local device ids are real identities
- keeps upgrade path open for later account linking

## 2. Current State Versus Target

### Current state

- onboarding is local only
- Home is a demo reveal screen
- timeline data is static demo content
- Supabase mainly powers art tooling
- no real day, moment, or hatch backend exists

### Target state

- onboarding still feels cinematic, but flows into a real daily product
- permissions unlock activity and location ingestion
- Home uses real day records
- moments update today's egg
- hatch creates a real creature record
- insight and paths derive from rolling profile data

## 3. Phase Plan

## Phase 0. Freeze Product Invariants

Goal:

Align product and engineering before writing stateful backend code.

Frontend tasks:

- Confirm that `app/(tabs)/index.tsx` becomes the permanent Home route.
- Confirm whether `app/(tabs)/explore.tsx` stays as collection/world.
- Lock the minimum interaction set for MVP:
  - timeline
  - egg/creature hero
  - add moment bottom sheet
  - highlight
  - insight + paths

Backend tasks:

- Confirm that MVP uses deterministic generation, not prompt-only creature creation.
- Confirm whether sleep is in MVP or deferred behind a null-safe field.
- Confirm whether hatch is device-triggered, backend-triggered, or both.

Deliverable:

- Finalized docs:
  - `docs/katchimera-app-mvp-design.md`
  - `docs/home-screen-ux-and-katchimera-design-system.md`
  - this plan

## Phase 1. Define Shared Domain Contracts

Goal:

Create the canonical app model before building screens or tables around unstable assumptions.

Frontend and domain tasks:

- Add shared TypeScript domain types for:
  - `Moment`
  - `DayRecord`
  - `DayScores`
  - `CreatureArchetype`
  - `CreatureRecord`
  - `WeekProfile`
  - `PathSuggestion`
  - `EggState`
- Add enums or unions for:
  - moment types
  - moment sources
  - day state: `forming | ready_to_hatch | hatched`
  - hatch trigger type
  - rarity tiers
- Define a pure transformation pipeline:
  - raw signals -> normalized inputs
  - normalized inputs -> scores
  - scores + moments + paths -> creature spec
  - creature spec -> render traits and name

Backend tasks:

- Mirror those contracts in schema planning.
- Identify which fields are source-of-truth database fields versus derived values.

Recommended file area:

- `types/` for network-facing types
- `utils/` or a new `domain/` folder for deterministic logic

Deliverable:

- stable contracts that both UI and backend can implement against

## Phase 2. Build The Real Home State Machine

Goal:

Turn the Home screen into a single coordinated state machine.

Frontend tasks:

- Replace the current Home screen reveal logic in `app/(tabs)/index.tsx`.
- Introduce a Home screen controller hook, for example:
  - `use-home-screen-state`
- Model primary state axes:
  - selected timeline day
  - today's day state
  - egg state
  - context panel state
  - insight module expanded/collapsed
  - add-moment sheet open/closed
- Keep timeline selection as the top-level screen driver.
- Reuse `components/katchadeck/timeline/day-timeline.tsx`, but refactor it to support:
  - mixed item types: past creature, present egg, tomorrow ghost egg
  - selected-day callbacks against real ids
  - live today-state updates

Recommended state shape:

- `selectedDayId`
- `timelineDays`
- `todayDraftMoments`
- `todayPassiveSignals`
- `todayAppliedPath`
- `todayEggVisualState`
- `todayHatchStatus`

Deliverable:

- Home screen changes state correctly when the timeline changes, even before backend wiring is complete

## Phase 3. Implement Local Domain Engine

Goal:

Get the deterministic system working end-to-end in code before binding it to Supabase.

Frontend and domain tasks:

- Implement moment-to-score mapping:
  - coffee can influence calm or warmth-related traits
  - walk influences energy
  - new place influences exploration
  - social influences social
  - calm influences calm
  - focus influences focus
- Add passive signal normalization:
  - steps
  - place count
  - new place count
  - optional sleep if available
- Implement:
  - dominant and secondary trait selection
  - rarity calculation
  - path generation from week profile imbalance
  - name generation
  - visible creature-trait mapping
- Add egg foreshadowing rules:
  - color hint
  - motion style
  - energy intensity

Important rule:

The same inputs must always produce the same creature spec.

Deliverable:

- a pure, testable engine that can drive the Home screen without relying on AI

## Phase 4. Build Home UI Modules

Goal:

Ship the visual structure from the spec using real state.

Frontend tasks:

- Timeline
  - adapt `DayTimeline` for real day records
  - preserve snap and center-driven selection
- Hero area
  - create an Egg component with:
    - breathing
    - internal swirl
    - pulse on input
    - preview variants from signals and paths
  - create a Creature Hero component for:
    - present completed
    - past selected day
- Context area
  - today mode: floating chips and Add moment CTA
  - past mode: highlight plus moments list
  - tomorrow mode: minimal "Not yet formed"
- Add moment sheet
  - quick-tag fast path
  - optional photo and text
  - instant add with no confirmation screen
- Insight + Paths
  - collapsed subtle one-liner
  - expandable detail
  - path tap feeds back into egg immediately

Suggested component slices:

- `components/katchadeck/home/home-timeline.tsx`
- `components/katchadeck/home/home-hero.tsx`
- `components/katchadeck/home/forming-egg.tsx`
- `components/katchadeck/home/day-context.tsx`
- `components/katchadeck/home/add-moment-sheet.tsx`
- `components/katchadeck/home/insight-paths-panel.tsx`

Deliverable:

- the full Home UX exists locally with realistic state transitions

## Phase 5. Add MVP Persistence Model In Supabase

Goal:

Move from prototype-only local state to real persisted day state.

Backend tasks:

- Introduce auth-backed ownership using anonymous auth.
- Create user-scoped tables. Recommended MVP schema:

1. `public.profiles`
   - `id uuid primary key references auth.users`
   - lightweight profile and preference fields
2. `public.onboarding_profiles`
   - one row per user
   - aspiration, pain points, preferences, permissions state
3. `public.day_records`
   - one row per user per local date
   - lifecycle state
   - passive summaries
   - score snapshot
   - applied path
   - hatch timestamps
4. `public.day_moments`
   - many rows per day
   - type, source, payload, created_at
5. `public.day_creatures`
   - final generated creature for a day
   - traits, rarity, name, highlight moment id, render traits
6. `public.week_profiles`
   - optional cached rolling aggregates
7. `public.path_suggestions`
   - optional persisted path suggestions if not derived on read

Rules:

- enable RLS on every table
- scope rows by `auth.uid()`
- do not use public `using (true)` policies
- use unique constraints for one-day-per-user invariants

Suggested day-record fields:

- `user_id`
- `day_date`
- `state`
- `steps_count`
- `places_count`
- `new_places_count`
- `sleep_duration_minutes`
- `sleep_quality`
- `energy_score`
- `calm_score`
- `social_score`
- `exploration_score`
- `focus_score`
- `applied_path_key`
- `hatch_ready_at`
- `hatched_at`

Deliverable:

- the data model required to persist the Home loop

## Phase 6. Add Server-Side Write Flows

Goal:

Make database writes authoritative while keeping the UI responsive.

Backend tasks:

- Add a mutation layer for:
  - creating or fetching today's day record
  - inserting a quick-tag moment
  - inserting text/photo moments
  - updating passive signal summaries
  - applying a path choice
  - finalizing hatch
- Prefer SQL functions or Edge Functions for actions that touch multiple tables:
  - `apply_day_moment`
  - `apply_path_bias`
  - `finalize_day_hatch`
- Ensure final hatch logic is atomic:
  - recompute scores
  - choose creature
  - select highlight moment
  - create day creature
  - mark day as hatched

Frontend tasks:

- perform optimistic updates for quick-tag moments
- reconcile with server response
- surface recoverable failures quietly

Reasoning:

The hatch is the core truth boundary. It should not be a loose bundle of client writes.

Deliverable:

- reliable write paths for the daily loop

## Phase 7. Wire Permissions And Passive Data

Goal:

Collect enough real signal to make the creatures feel earned.

Frontend tasks:

- Add post-onboarding permission flow for:
  - activity
  - location
- Build foreground-safe ingestion first:
  - steps if available
  - simple place classification
  - new-place detection at MVP level
- Keep permission prompts contextual, not front-loaded
- Add a fallback mode for manual-only usage

Backend tasks:

- Decide whether raw samples are stored or only summaries
- For MVP, prefer storing daily summaries over raw streams
- If storing raw events, keep them in separate private tables not used directly by UI reads

Recommendation:

For MVP, persist summaries first:

- steps count
- place count
- new place count
- optional coarse activity markers

Do not build raw telemetry infrastructure unless the product truly needs it.

Deliverable:

- basic passive signal ingestion without overbuilding

## Phase 8. Implement Hatch Orchestration

Goal:

Make the day transition from egg to creature feel dependable and magical.

Frontend tasks:

- Add hatch-trigger detection:
  - end-of-day threshold
  - first open after threshold
- Build hatch sequence:
  - moment recap
  - convergence
  - reveal
  - highlight
  - skip support
- Cache the result locally so the reveal is stable on reopen

Backend tasks:

- Make hatch idempotent:
  - repeated calls return the same creature once hatched
- Store hatch event metadata
- Ensure the highlight moment id exists and belongs to that day

Deliverable:

- the daily reward loop works end-to-end

## Phase 9. Add Weekly Insight And Paths

Goal:

Turn multi-day behavior into gentle guidance.

Backend tasks:

- Add rolling 5-7 day profile computation
- Derive:
  - trend insight
  - imbalance insight
  - absence insight
- Generate two path suggestions:
  - contrast path
  - reinforcement path

Frontend tasks:

- render collapsed insight by default
- expand on tap
- allow path selection to affect today's egg preview

Recommendation:

Derive insights from recent persisted day records rather than storing too much precomputed text at first. Cache later only if needed.

Deliverable:

- insight and path system layered into Home without turning it into analytics UI

## Phase 10. Connect Creature Spec To Render Assets

Goal:

Ensure generated creatures visibly reflect the day.

Backend and content tasks:

- Define archetype-to-visual-trait libraries
- Define moment-to-visual overlays
- Define rarity-to-effects mapping
- Define naming roots and suffix tables

Frontend tasks:

- render creature cards and hero states from structured trait payloads
- make sure at least one to two visible traits map to actual moments

Important:

Do not let the art layer drift away from the signal system. If the user added coffee and walk, some visible part of the result should support that story.

Deliverable:

- creatures feel authored, not random

## Phase 11. Production Hardening

Goal:

Make the MVP safe enough to ship beyond an internal prototype.

Backend tasks:

- replace any remaining public-open policies
- decide whether current art lab routes remain internal-only
- remove or quarantine starter schema like `todos`
- lock down any cost-bearing functions
- add migration discipline

Frontend tasks:

- add offline tolerance for moment creation
- add loading and retry states for hatch recovery
- ensure empty-state avoidance across all Home states

Deliverable:

- production-ready MVP infrastructure

## 4. Concrete Frontend Worklist

In order:

1. Convert `app/(tabs)/index.tsx` from reveal page to stateful Home shell.
2. Keep `DayTimeline` and refactor it for real-day data and today/tomorrow variants.
3. Build the Egg component and its live reaction system.
4. Build the Context area variants for today, past, and tomorrow.
5. Add the Add moment bottom sheet with instant quick-tag flow.
6. Add the collapsed and expanded Insight + Paths module.
7. Add hatch animation flow and skip logic.
8. Add optimistic state syncing to Supabase-backed mutations.

## 5. Concrete Backend Worklist

In order:

1. Add anonymous auth and RLS-safe ownership.
2. Create onboarding, day, moment, and creature tables.
3. Add server-side write flows for moment creation and path application.
4. Add authoritative hatch finalization.
5. Add rolling profile and path generation.
6. Add passive summary ingestion.
7. Lock down function and policy security.

## 6. Suggested Milestone Breakdown

### Milestone 1

Local-only real Home prototype

Success criteria:

- timeline controls the screen
- egg reacts to quick tags
- past/today/tomorrow views work

### Milestone 2

Persisted day and moment model

Success criteria:

- moments survive app relaunch
- real day records load from Supabase
- onboarding can map into a real user profile

### Milestone 3

Real hatch loop

Success criteria:

- a day can hatch once
- creature is stable after hatch
- highlight is chosen and shown

### Milestone 4

Insight + paths and passive signals

Success criteria:

- weekly profile exists
- path suggestions affect today's egg
- the app feels like a daily companion rather than a static showcase

## 7. Risks To Manage

- Building backend too early before the domain model is stable
- Keeping local-device identity too long and then having to migrate ownership later
- Letting creature visuals become disconnected from actual moments
- Overbuilding passive telemetry when the MVP only needs daily summaries
- Treating art-generation tooling as the same system as the daily creature engine

## 8. Recommended Immediate Next Actions

1. Add the new docs as the product source of truth.
2. Implement Phase 1 shared contracts.
3. Refactor `app/(tabs)/index.tsx` into the real Home controller shell.
4. Add anonymous auth and day/moment schema before wiring production persistence.
5. Build hatch finalization as a single authoritative backend action.
