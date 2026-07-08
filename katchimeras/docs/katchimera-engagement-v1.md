# Katchimera Engagement — v1

Residents become relationships: tap a katchimera → the camera focuses on it →
a companion card opens in its voice with ONE engagement unit (insight,
suggestion, or quest). Spec agreed 2026-07-06; extends
docs/kingdom-residents-plan.md.

## Loop

1. **Tap → focus**: pan/zoom animates to the resident's quad (world-canvas
   `focusOnPoint`, same math as `recenter` + a zoom bump).
2. **Companion card**: identity (name, archetype, rarity, bond = hatchCount,
   house level) + today's engagement unit + quest accept/decline.
3. **Engagement units** come from a rule engine keyed to the archetype's
   signal (utils/katchimera-engagement.ts).

## Content tiers (graceful degradation)

- **T1 — rules (always, offline)**: per-archetype insight templates computed
  from the user's own history (food/cafés, steps, sleep, photos…) + a static
  quest table written BACKWARDS from detectable signals (place confirms,
  moment captures + subjects, step counts, sleep records) — evaluator pattern
  = world-objects unlock engine, run on day sync.
- **T2 — Foundation Models voice (iOS 26, on-device)**: rewrites T1 text in
  the katchimera's persona (persona bible from the reflection context
  engine). LLM phrases, never decides — quest logic stays rule-owned; rule
  text is the fallback. Needs native dev build.
- **T3 — MapKit POI (native module)**: MKLocalSearch for "new to you" place
  suggestions (café/park/…), subtracting confirmed-places history. Free,
  on-device, no key.

## Quests

- ≤3 active (one per katchimera); stored via the Memory Quests infra pattern.
- Completion → celebration + essence drip + counts toward HOUSE UPGRADES
  (alongside dupes) — engagement grows the kingdom, not just hatching.
- Every card interaction ticks the bond axis; bond gates deeper insights.

## Build order

- **V1a (this build)**: focus camera + companion card + T1 rule engine v0
  (insights for the main archetype signals + generic fallback). Quest table +
  evaluators + rewards next.
- **V1b**: FM voice pass (fallback = T1 templates).
- **V1c**: MapKit POI module + new-place quests.

All tiers on-device; nothing leaves the phone.
