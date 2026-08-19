# Mossprout hex cinematic continuity v2

This is the hex-tile counterpart to `../cinematic-continuity-v2/`.

## Source mapping

| Runtime stage | Player level | Chroma source | Cinematic content reference |
| ---: | ---: | --- | --- |
| 0 | 1 | `stage-0-chroma.png` | `../cinematic-continuity-v2/stage-0-level-1.png` |
| 1 | 2 | `stage-1-chroma.png` | `../cinematic-continuity-v2/stage-1-level-2.png` |
| 2 | 3 | `stage-2-chroma.png` | `../cinematic-continuity-v2/stage-2-level-3-anchor.png` |
| 3 | 4 | `stage-3-chroma.png` | `../cinematic-continuity-v2/stage-3-level-4.png` |
| 4 | 5 | `stage-4-chroma.png` | `../cinematic-continuity-v2/stage-4-level-5.png` |

`prepared/` contains the alpha masters and preparation manifest used by the
atomic Haven promotion pipeline.

## Generation method

The built-in Codex image generator was used once per stage. The accepted Level
1 hex established the continuity geometry. Levels 2-5 were precise edits of
that accepted tile, while the corresponding cinematic level was supplied only
as a maturity, landmark, palette, and decoration reference.

Every prompt locked:

- the floating-island shell, isometric camera, crop, walls, rock base and stairs;
- the rear-left shelter, left pond, rear-right seat and lantern anchors;
- the same moss-capped rocks;
- the small lower-center standing patch directly above the stairs, including
  its diameter and single broad connecting step;
- the flat `#FF00FF` background required by the project matte pipeline.

Only construction completeness, plant maturity, moss coverage, furniture
finish, flowers, and restrained magical lighting were allowed to change.

## Runtime outputs

Promotion replaces the existing stage keys without save migration:

`floating_neighborhood_v2_mossprout_haven_stage_N_hex_tile`

Each stage is packaged as transparent 1024, 512 and 256 WebP art, and shared
hex alpha bounds are regenerated after the complete set is promoted.
