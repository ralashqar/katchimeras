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

## Provider Rules

- Apple/on-device providers should be tried before remote providers.
- Deterministic rules must remain available for offline behavior and tests.
- Remote LLM providers must return the same structured evidence shape and should
  never be required for a quest to avoid false negatives on unsupported devices.
- Unknown or missing providers must never false-complete a quest.

