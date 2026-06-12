# Katchimeras — UX Flow & Presentation Redesign

Status: design decisions + implementation notes for the onboarding/UX pass that follows M1
(encounter engine). Builds on `katchimera-product-direction-2026-06.md`.

## Diagnosis of the current flow

1. **Onboarding explains mechanics twice and characters never.** Steps 1 and 2 both walk the
   egg→hatch loop (timeline demo, then egg + chips + a sample creature). The cast — the soul of
   the product under the encounter-first direction — never appears as *characters with
   identities*, only as anonymous sample art.
2. **The ritual has no anchor.** Hatch time is a hardcoded 8 PM the user never sees or chooses.
   A ritual you didn't pick isn't yours.
3. **The privacy promise is silent.** The direction doc calls for local-first to be loudly
   stated; onboarding asks for location without ever saying "this stays on your phone."
4. **Encounter identity is stored but invisible.** M1 added `motifTags` (encounter cue) and
   `repeatDepth` (the relationship), but the hero shows a bare rarity word, the postcard shows
   none of it, and the hatched-day panel repeats the same highlight line twice on one screen.

## Onboarding redesign (same 5-step skeleton, sharper jobs)

| Step | Before | After |
|---|---|---|
| 0 | Cinematic opening | unchanged — it is the wow moment |
| 1 | Concept recap + demo timeline (redundant with step 0) | **Meet the cast**: three real characters (Lattelet/coffee, Mossprout/parks, Sprintail/runs) with one-line encounter identities, plus the bond rule: returning to a ritual brings the same character back, deeper |
| 2 | Loop mechanics, egg + chips + second sample creature (long, cutoff-prone) | **The evening ritual**: egg + chips kept, sample creature dropped, and the user **picks their hatch hour** (7–10 PM) |
| 3 | Tone preference | unchanged |
| 4 | Permission rows + tone recap | adds a **"Stays on your phone"** privacy panel above the permission rows; recap now includes the chosen hatch time |

Why cast-first: the shareability framework's own test — "would the user know why they got it?" —
starts working at minute one if users meet the characters before they meet the mechanics.
Why hatch-hour-in-onboarding: it pulls M4.1 forward cheaply (the picker and engine plumbing;
the notification remains M4.2) and converts "the app reveals at 8" into "my day hatches at 9."

## Presentation changes on Home

- **CreatureHero kicker** now reads encounter-first: `Coffee shop · 3rd visit` for a returning
  character, `Coffee shop · epic` for a rare first meeting, falling back to rarity for
  trait-fallback creatures. The relationship became visible.
- **Memory postcard** gains the encounter cue pill under the highlight (`Coffee shop · 3rd
  visit`) — the share-card structure the shareability framework specifies (portrait, name,
  reflection line, *one reason tag*).
- **Hatched-day panel** shows the creature's `reflection` (identity insight) instead of
  duplicating the `highlight` the hero already shows; label changes from "Highlight" to
  "Reflection." Two distinct lines of copy now appear per hatched day instead of one twice.
- **Explore tab** drops residual "deck" phrasing ("Where your deck is leaning" → days).

## Hatch hour plumbing

- `OnboardingProfile.hatchHour: number | null` (null → legacy default 20). Stored profiles
  without the field load through a defaults-merge in `loadOnboardingProfile`.
- `resolveHatchHour(profile)` in home-engine clamps to 17–23; `resolveDayState` takes the hour
  as a parameter, threaded from every caller (all already receive the profile).
- The forming egg's "Ready to hatch" gating, day rollover, and dev scenarios are unaffected:
  a day stored as `ready_to_hatch` stays ready regardless of hour.

## Out of scope for this pass (intentionally)

Hatch notification (M4.2), note moment + postcard share polish (M5), new cast renders (M2),
LLM reflections (M3), collection grid (M6). The tone step and cinematic opening were left
untouched — both already serve the direction.
