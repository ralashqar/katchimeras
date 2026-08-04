# Katchimera trophy art pipeline

This folder is the source-of-truth for bespoke achievement art batches. Runtime assets live in `assets/images/katchimeras/achievements/<family>-v<version>/`; generation sheets, prompts and cell mappings live here.

There is no fixed trophy-count or 16-item limit. Each family manifest must cover the current authored achievement definitions for that family, including family-specific, goal, quest and Journey ladders.

## Art direction

Trophies are keepsakes from a Katchimera's world, not generic cups or medals.

- Match the app's polished cozy miniature 3D style: rounded silhouettes, handcrafted clay/wood/stone/leather/fabric, soft diffuse light and gentle ambient occlusion.
- Take palette, material and shape language from the family's character, environment and an existing in-world prop.
- Give each achievement section one recognizable base-object idea. Tiers should enrich that object rather than replace it with unrelated art.
- Keep silhouettes readable at 72–120 px. Avoid thin detached details, text, numerals, characters, photorealism, emoji styling and glossy generic game badges.
- Use a flat `#ff00ff` generation background and prohibit magenta inside the artwork. The production files must be transparent WebP.

## Per-family workflow

1. Read the family's definitions in `constants/companion-achievements.ts`. Record every `sectionId` and its exact number of tiers; never assume four.
2. Choose three references:
   - character cutout for material/palette;
   - family environment for world language;
   - closest existing prop or journal icon for rendering scale.
3. Design one visual metaphor per section and a clear progression across its tiers.
4. Pack the exact number of cells into one or more regular grids. A 4×4 grid is convenient, but not required. Prefer explicit cell mappings whenever different progressions share a row.
5. Generate with the built-in image generator. Save the complete prompt in `<family>-vN-prompts.md` and the source sheet locally.
6. Remove the chroma key while retaining a soft antialiased edge:

   ```powershell
   python C:\Users\daruk\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py `
     input.png output-alpha.png --auto-key border --soft-matte `
     --transparent-threshold 12 --opaque-threshold 220 --despill
   ```

7. Describe the sheet in `<family>-vN.json`. Use legacy `rows` for a square 4×4 sheet, or `grid` plus explicit zero-based `cells` for any layout. Generated grid lines are not always mathematically even: inspect the alpha sheet and put optional `columnCuts` and `rowCuts` through the real transparent gutters so artwork cannot bleed between cells:

   ```json
   {
     "grid": {
       "columns": 5,
       "rows": 4,
       "columnCuts": [0, 274, 563, 828, 1116, 1402],
       "rowCuts": [0, 325, 586, 849, 1122]
     },
     "tightFit": true,
     "subjectCoverage": 0.78,
     "dropEdgeFragments": true,
     "strictCellBounds": true,
     "cells": [
       { "name": "section-id-1", "row": 0, "column": 0 }
     ]
   }
   ```

8. Split, tightly trim, center and optimize the runtime art:

   ```powershell
   python scripts\process-achievement-icon-sheet.py `
     --manifest design\achievement-trophies\<family>-vN.json `
     --size 512 --quality 82
   ```

   Set `"tightFit": true` on new manifests. The processor then fits meaningful alpha to 78% of the canvas, retains 11% safety space on each side, removes fragments crossing grid boundaries and enforces a 100 KiB budget per icon. `strictCellBounds` fails the batch if a primary subject still touches its source cell edge. The default remains the legacy no-upscale behavior so older manifests reproduce exactly.

   Existing individual trophy folders can be normalized without returning to a source sheet:

   ```powershell
   python scripts\process-achievement-icon-sheet.py `
     --normalize-dir assets\images\katchimeras\achievements\<pack> `
     --size 512 --quality 82 --coverage 0.78
   ```

9. Add a family-specific source map in `constants/achievement-icon-sources.ts` before the shared fallback branches. The index is `tier - 1`, clamped to the available progression.
10. For tightly processed packs, return scale `1` from `trophyArtScale` in `components/katchadeck/world/companion-trophy-room-screen.tsx`. Legacy padded art may retain a temporary compensating scale.

## QA checklist

- Every authored section/tier resolves to a unique existing file.
- Trophy concept matches the achievement it represents and tiers read as a progression.
- Transparent corners; no chroma fringe, grid line, neighboring-cell fragment or clipped subject.
- Meaningful alpha occupies 76–80% of one canvas dimension.
- No non-primary component is inherited from a neighboring grid cell.
- 512×512 WebP with alpha; each file below 100 KiB.
- Runtime shelf and vertical achievement cards both show the art at useful size.
- Typecheck, lint, achievement tests and `git diff --check` pass.

## Batch queue

Keep batches thematically coherent so their palettes and object metaphors can be reviewed together.

| Status | Batch | Families |
| --- | --- | --- |
| Complete | Foundation | Mossprout, Steppling |
| Next | Movement | Flexel, Shellio |
| Planned | Food & ritual | Baristabbit, Feastle |
| Planned | Connection | Gatherglow, Heartmote, Kindling, Snuglet, Waglet |
| Planned | Daily rhythm | Tasklet, Errandimp, Bedrotte, Dawnle, Mendle |
| Planned | Creativity | Pagelet, Relicoon, Museling, Encora, Flickerbun, Pixooka |
| Planned | Exploration | Skylo, Voyagle, Cheerlet |

Review each completed family in the trophy-room UI before generating the next batch. This catches family-specific scale, contrast and concept problems before they are repeated.
