# Intelligence And Evidence Architecture

The intelligence layer turns private day inputs into typed, explainable evidence
that quests and future systems can evaluate without knowing which model or
fallback produced the read.

## Layers

1. `utils/intelligence/types.ts`
   - Shared provider/task/result contracts.
   - Default policy is on-device first: Apple Vision/Foundation/Speech, then
     deterministic fallback. Remote LLM providers must be explicitly allowed.

2. `utils/intelligence/taxonomy.ts`
   - Canonical signal vocabulary for photos, notes, and model outputs.
   - Owns synonym matching and generic-label rejection.
   - Add new quest-safe concepts here before adding quest criteria.

3. `utils/intelligence/evidence.ts`
   - Builders for persisted `DayEvidence` records.
   - Evidence carries source id, source type, provider, confidence, signals, and
     a short explanation.
   - `DayVisionSummary` remains a derived compatibility surface; quest-grade
     checks should use evidence.

4. `utils/signals/providers/evidence.ts`
   - Exposes `evidence.items` to the existing facts/criteria quest engine.
   - Backfills old records from aggregate `vision` when no evidence exists.

5. `utils/capabilities/quest-capabilities.ts`
   - Central capability vocabulary for quest requirements: camera, photos,
     location, Health, microphone, calendar, Apple Vision/Foundation, and remote
     LLM.
   - Converts stored app permission state into quest-facing statuses.

6. `utils/quests/runtime.ts`
   - The quest-grade evaluator for UI surfaces.
   - Combines criteria, evidence matches, capability gating, next action,
     user-facing message, and debug reason into `QuestRuntimeStatus`.
   - World companion cards and the quest journal use this status directly; camera
     actions route to `app/moment-capture.tsx`, while other actions route to
     Today where the owning controllers request permissions or capture input.
   - Cross-tab quest actions use `utils/quest-action-signal.ts`: World queues a
     one-shot `QuestNextAction`, Today consumes it on focus, then
     `use-today-action-router.ts` opens the exact sheet/control.

7. `utils/quests/today-intelligence.ts`
   - Today-facing selector that groups active, complete, and blocked companion
     quests with runtime status and matched evidence IDs.

8. `utils/quests/definitions.ts`
   - Quest definitions are authored as data and normalized on export with
     family, themes, required/optional capabilities, suggested actions, and
     evidence policy.
   - Mixed quests, such as "confirm a park and take a photo", accumulate all
     required capabilities instead of picking a single family.

## Adding A New Intelligent Quest

1. Add or verify a canonical concept in `utils/intelligence/taxonomy.ts`.
2. Ensure the relevant capture path creates evidence with that concept.
3. Add a quest criterion in `utils/quests/definitions.ts` using:

```ts
{
  fact: 'evidence.items',
  op: 'evidenceIncludes',
  value: 'park',
  minConfidence: 0.62,
  sourceTypes: ['photo'],
  label: 'Snap a photo of a park',
}
```

4. Add or update a verification script under `scripts/verify-*.cjs`.
5. Let `utils/quests/definitions.ts` infer metadata when possible. Add explicit
   `family`, `requiresCapabilities`, or `suggestedActions` only when the
   inference would be ambiguous.

## Quest Runtime States

- `complete`: all criteria passed.
- `in_progress`: attainable, but missing evidence or facts.
- `blocked_permission`: the phone/app can probably satisfy it, but permission is
  missing or denied.
- `unavailable`: this build/device cannot provide the required capability.
- `impossible_today`: the day state/time window makes the quest impossible now.

## Provider Rules

- Apple/on-device providers should be tried before remote providers.
- Deterministic rules must remain available for offline behavior and tests.
- Remote LLM providers must return the same structured evidence shape and should
  never be required for a quest to avoid false negatives on unsupported devices.
- Unknown or missing providers must never false-complete a quest.
- User-facing quest UI should read `QuestRuntimeStatus`, not raw criteria, when
  it needs capability prompts, next actions, or debug reasons.
