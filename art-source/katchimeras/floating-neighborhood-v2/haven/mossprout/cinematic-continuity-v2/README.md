# Mossprout cinematic continuity v2

This five-stage set treats the existing Level 3 cinematic environment as the
spatial anchor. Levels 1, 2, 4, and 5 were generated as direct edits of that
anchor rather than recursively editing the previous stage.

## Runtime mapping

| Player level | Runtime stage | Source |
| --- | ---: | --- |
| 1 | 0 | `stage-0-level-1.png` |
| 2 | 1 | `stage-1-level-2.png` |
| 3 | 2 | `stage-2-level-3-anchor.png` |
| 4 | 3 | `stage-3-level-4.png` |
| 5 | 4 | `stage-4-level-5.png` |

`progression-contact-sheet.jpg` is the sequence QA view. Runtime exports live
under `assets/images/katchimeras/world/backgrounds/` as a 1536px full WebP and
a 1024px medium WebP for each stage.

## Continuity contract

The camera, horizon, path, central standing circle, shelter, pond, stump seat,
lamps, and mossy rocks are persistent landmarks. A stage may change their
maturity, construction finish, vegetation density, and decoration, but should
not replace them with unrelated objects or move them to a new part of the scene.

The authored progression is:

1. Bare clearing: twig-and-leaf shelter start, sprouts, rough standing ring,
   shallow pond, plain stump, and unfinished lantern stakes.
2. Settling in: half-built leaf shelter, young ferns, completed plain ring, and
   first simple lights.
3. Established home: the original Mossprout cinematic anchor.
4. Flourishing: fuller plants, moss cushion, lilies, vines, buds, and a subtle
   platform glow.
5. Signature grove: enchanted leaf home, abundant flowers, botanical lanterns,
   luminous moss platform, and mature planting while keeping the path and
   character space clear.

## Generation method

Built-in Codex image generation was used in precise-object-edit mode. Level 3
was the edit target and sole layout anchor for every generated stage. Levels 1
and 5 established the maturity endpoints; Levels 2 and 4 also used the nearest
endpoint as a progression-semantics reference, never as a layout reference.

Every prompt explicitly locked landmark coordinates, footprints, perspective,
camera framing, and the cozy soft 3D material language. Prompts changed only
construction completeness, plant maturity, finish, and restrained supporting
decoration.
