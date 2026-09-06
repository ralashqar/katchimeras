# Kingdom Residents — katchimera-led expansion

The Kingdom's growth becomes *about* the katchimeras: the map is a physical
Dex. One nest capital at the centre; every new unique katchimera claims a
quarter of a garden tile in the rings around it and gets a small house that
upgrades when that katchimera is hatched again.

## Layout

- **Capital (centre)**: the existing large kingdom slab, rendered with the
  `base_garden_nest2` art. The egg sits on the nest's paved circle (the slab
  centre — already the egg's default cell). The 8 main structures stay on the
  capital around it.
- **Ring tiles**: expansion tiles (existing docked-patch system) rendered with
  the default Garden Tile (`base_garden_main`). Placement order is the
  existing side/ring sequence from `utils/world-expansion.ts`
  (`nextExpansionTarget`: ne → se → sw → nw, then ring 2, …).
- **Quads**: each ring tile splits into 4 quads (2×2 cells each on a 4×4
  tile). A resident occupies a quad centre: creature sprite + small house.

## Rules

1. **New unique katchimera** → allocate the next free quad (spiral: oldest
   unlocked tile first, quads in a fixed order). If no quad is free anywhere,
   the next expansion tile is granted and the resident takes its first quad.
2. **Duplicate katchimera** → NO new resident; the existing resident's house
   levels up (levels 1–4, art `_01.._04`, Memory-Vault-style same-identity
   growth). Beyond max level → essence/bloom bonus instead.
3. **Allocation is deterministic** — derived by folding the Dex (hatch order)
   so it can be recomputed / migrated at any time; the store only records
   user-made *moves* (a resident dragged to another quad), not the defaults.
4. Objects/decor keep planting as today; residents don't block decor, they
   just occupy the quad anchor slot.

## Ceremonies

- **Arrival** (new unique): pan camera to the target quad → if a new tile was
  granted, the existing grow-ceremony rise plays → house + creature plant in
  with the capture-fly sparkle.
- **Upgrade** (dupe): pan to the resident's house → sparkle puff → art swaps
  to the next level.

## Build slices

- **A — per-slab base art** (built with this doc): `kingdomSlabOverlay(role)`
  in `utils/world-visuals.ts`; capital = nest2, rings = garden tile; the
  Asset Lab dev override applies to RING tiles (the capital's nest identity is
  fixed). Renderer picks per slab in the ground pass.
- **B — resident model** (built with this doc): `utils/kingdom-residents.ts`
  — quad anchors, spiral allocator, Dex fold → resident list (creatureId,
  tileIndex, quad, houseLevel). Pure functions, no store changes yet.
- **C — render residents**: world-scene emits resident sprites (house +
  creature) at quad anchors; tap → creature card.
- **D — expansion trigger rewire**: unique-katchimera count drives
  `nextExpansionTarget` eligibility (replaces/augments deeds requirements).
- **E — ceremonies**: arrival + upgrade sequences (reuse grow ceremony,
  capture-fly, provenance card).
- **F — house art**: one cozy small-house family, 4 levels, via the enforced
  prop pipeline (style anchor + 4×4 iso guide); archetype colourways later.
- **G — migration**: on first load, existing hatched katchimeras backfill
  quads in hatch order (the fold in B gives this for free).

## Open questions

- Ratio: 1 unique = 1 quad (16 uniques = 4 tiles). Revisit if rings grow too
  fast/slow once real Dex sizes are seen.
- Districts: thematic clustering (archetype quarters) deferred — spiral first.
- Whether ring tiles should be plantable by the user or resident-exclusive.
