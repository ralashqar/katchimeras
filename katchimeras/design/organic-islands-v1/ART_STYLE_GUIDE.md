# Organic Islands v1 — art style and progression guide

This is the production contract for standalone Katchimera Haven islands. The invisible hex grid still owns layout and interaction, but the visible artwork is an organic floating diorama.

## The thumbnail rule

Judge every asset at 128–256 px before judging it full-size. The character home, resident clearing, signature activity, water/secondary landmark, and island silhouette must read as separate large shapes. If an element disappears at that size, enlarge or remove it; do not sharpen it with more texture.

## Core visual language

- Cozy molded-toy 3D with matte clay/plastic materials.
- Broad flat color regions and low local contrast.
- Large cushion-like bevels on every structural edge.
- Chunky pieces with clean separation and soft ambient occlusion only at major contacts.
- One dominant hue family, one construction hue, one light neutral, one water/accent hue, and at most two small flower/accent colors.
- Soft diffuse lighting, broad restrained highlights, and no hard cast shadow outside the island.
- Organic rounded footprint contained inside an invisible hex cell; never draw a hex border.
- Rocky-earth underside uses two readable tiers and occupies roughly 18–25% of the island's visible height.

## Simplification budget

- Cottage roof: 8–12 large leaves, no fine veins.
- Ground: one smooth plane plus a small number of large path stones; no grass blades, speckles, grit, or cracks.
- Foliage: a few rounded clusters, not many individual leaves.
- Flowers: a few oversized five-petal icons, never flower confetti.
- Stone circles and paths: fewer, larger segments with deep soft bevels.
- Fences, arches, planters, and lanterns: thick parts and minimal seams.
- Water: one smooth color mass, one broad highlight, and simplified waterfall foam.
- Island base: fewer large rounded blocks, no strata noise, caves, roots, or stalactites.

## Composition contract

- Square orthographic three-quarter isometric view.
- Entire island visible with generous transparent padding.
- Character is rendered separately. Keep a compact clear resident zone around the normalized `residentAnchor` and do not generate a creature.
- Keep the resident zone roughly 14–16% of the visible island width: large enough for the resident sprite and a little breathing room, but never the dominant plaza. Prefer a small rug, smooth ground patch, or a few broad stones over a large outlined circle. Keep tall props outside it.
- Put the home in the rear-left or rear-center, the signature activity opposite it, and a secondary landmark such as water on a front side.
- Keep perimeter props low enough that the resident and main landmarks remain readable.
- Do not add bridges, clouds, UI, text, logos, signs, labels, or a floor plane.

## Progression: add hierarchy, not noise

All stages preserve camera, island footprint, base depth, ground silhouette, resident anchor, and the positions of identity-defining landmarks.

| Stage | Read | Allowed visual delta |
| --- | --- | --- |
| 0 | A newly claimed home | Shelter, resident zone, one small activity cue, sparse planting |
| 1 | Settled | One functional prop cluster and one warm light source |
| 2 | Growing | A larger activity landmark or water feature; stronger pathing |
| 3 | Flourishing | Mature silhouette, upgraded arch/fence, one celebratory accent cluster |
| 4 | Signature sanctuary | Three to five bold upgrades: enlarged home, completed activity area, richer water/lighting, and one unmistakable hero ornament |

An upgrade should change the thumbnail silhouette or value grouping—not fill empty ground with tiny objects. Stage 4 may be richer, but it must remain as visually simple as Stage 0.

## Reusable generation prompt

```text
Use case: precise-object-edit
Asset type: production floating-island Haven environment for a React Native mobile game
Input images: Image 1 is the approved previous-stage island and composition target. Optional Image 2 is a progression-content reference only; never copy its detail density.
Primary request: Create Stage {stage} for {family}. Preserve the camera, footprint, medium two-tier base, resident clearing, and landmark positions. Add only {three_to_five_large_upgrade_beats}.
Style: very soft simple toy-like 3D matching Organic Islands v1: broad flat colors, matte molded clay/plastic, thick rounded edges, large cushion bevels, clean silhouettes, soft diffuse light, and gentle major-contact ambient occlusion. It must read at 128–256 px.
Simplification: no grass texture, speckles, cracks, tiny leaves, fine veins, micro-flowers, etched stone, thin pieces, or construction clutter. Consolidate decoration into a few large shapes.
Progression rule: add hierarchy, not noise. Make the upgrade obvious through larger landmarks, silhouette, lighting, and color grouping—not more surface texture.
Composition invariants: preserve {resident_anchor}, a compact clear resident zone roughly 14–16% of island width, {home_landmark}, {activity_landmark}, {secondary_landmark}, isometric view, organic footprint, and 18–25% base depth. Environment only; no creature. The resident zone must not read as a large central plaza.
Background: perfectly flat uniform #FF00FF chroma-key with no gradient, texture, shadow, floor, or reflection. Do not use magenta in the island.
Avoid: visible hex border, photorealism, high detail, bridge, cloud, character, egg, text, label, sign, logo, watermark, UI, or crop.
```

## Production pipeline

1. Use the latest approved stage as Image 1; never regenerate progression from prose alone.
2. Generate on flat `#FF00FF` because the environments are green-heavy.
3. Check composition and invariants before extraction.
4. Extract with the installed imagegen chroma helper. For warm assets where magenta despill contaminates wood, use a tight hard matte and inspect edges.
5. Save the chroma source and alpha master under `design/organic-islands-v1/{family}/`.
6. Package through `scripts/package-transparent-hex-tile.py` using key `organic_island_v1_{family}_haven_stage_{stage}_hex_tile`.
7. Regenerate and verify shared alpha bounds.
8. Add the stage tile to `havenResidentTiles`, preserving a stable `residentAnchor` across progression unless the standing zone genuinely moves.
9. Validate the 1024, 512, and 256 WebPs, then check the 256 version for readability.

The machine-readable companion contract is in `art-pipeline.json`.
