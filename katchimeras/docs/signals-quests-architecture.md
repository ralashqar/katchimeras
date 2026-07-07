# Signals & Quests — modular architecture

A three-layer system so new inputs and quests append cleanly instead of
ad-hoc (extends docs/katchimera-engagement-v1.md). Built 2026-07-07.

## Layers

1. **Facts** (`utils/signals/facts.ts`) — one normalized, namespaced vocabulary
   (`steps.count`, `sleep.quality`, `photo.labels`, `photo.place.categories`,
   `places.confirmedNew`, …). `unknown` = the owning provider couldn't run;
   criteria on `unknown` NEVER pass, so degradation can't false-complete.
   `Criterion` = `{ fact, op, value?, label }`; `testCriterion` evaluates one.

2. **Providers** (`utils/signals/resolve.ts`) — modular producers, each
   `{ id, produces: FactKey[], resolve(context) }`. `day-record` is the cheap
   always-on baseline. Capability-gated ones (Vision labels, MapKit geo,
   sleep) land as their own files + `registerProvider(...)`. `resolveFacts`
   merges them all for a day.

3. **Quests** — declarative:
   - `utils/quests/definitions.ts` — `QUEST_DEFINITIONS[id] = { title, hint,
     criteria: Criterion[] }`. Adding a quest = adding data.
   - `utils/quests/evaluate.ts` — ONE generic engine: `questCriteriaStatus`
     (journal checklist) and `isQuestComplete` both derive from the same
     criteria. No more parallel switch statements.

`utils/katchimera-quests.ts` (the persisted ledger) now delegates completion
+ criteria to the engine; it no longer hardcodes per-quest logic. `world.tsx`
resolves `todayFacts = resolveFactsForDay(today)` once and passes it to both
the focus auto-check and the journal's "Check now".

## Adding things

- **New quest**: one entry in `QUEST_DEFINITIONS` referencing existing facts.
- **New capability** (e.g. "photo is of coffee"): add the fact key to `Facts`,
  add a provider that produces it (behind a capability check if native), then
  reference it from any quest's criteria. Every consumer updates for free.

## Providers built

- **photoLabelsProvider** (`utils/signals/providers/photo-labels.ts`) →
  `photo.labels` from the day's DayVisionSummary (Apple Vision — already run +
  stored by utils/photo-vision; `concepts` are canonicalised via
  vision-signals CONCEPT_RULES: coffee/cat/dog/flowers/food/sunset/mountains/
  stars…). NOT new analysis — pure plumbing of stored labels. No vision read →
  'unknown'. Powers the subject-photo quests (snap a cat / your food / the
  night sky …).
- **dayDetailProvider** (`utils/signals/providers/day-detail.ts`) →
  `food.cuisines`, `studio.media`, `capture.earliestHour/latestHour` (from
  moment/food/studio timestamps + cuisine/media tags already on the record).
  Powers cuisine, culture/inspiration, and dawn/late-night quests, no native
  work.
- **SleepProvider** (`utils/signals/providers/sleep.ts`) → `sleep.quality`
  from the day's DaySleep atmosphere (manual tap or Apple Health, already on
  the record). good→'good', normal/low→'low', missing→'unknown'. Sleep is
  "how the day began", so an early-night quest completes when a LATER day logs
  good sleep — the "next good night" behaviour.

## Roadmap providers (each = one file, registered, degrades to `unknown`)

- **PhotoLabelProvider** → `photo.labels` via on-device Apple Vision
  (vision-pass scaffold). Criterion: `includes 'coffee'`.
- **PhotoGeoProvider** → `photo.place.categories` via reverse-geocode + MapKit
  `MKLocalSearch`. Criterion: `includes 'park'`.
- **Sleep fallback** → a second provider producing `sleep.quality` from an
  overnight phone-idle heuristic when Health is absent.

Later this same facts+criteria engine can absorb the world-objects unlock and
discoveries evaluators (three ad-hoc "did it happen" systems today).
