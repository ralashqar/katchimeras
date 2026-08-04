# Katchimera trophy art pipeline

This folder is the source-of-truth for bespoke achievement art batches. Runtime assets live in `assets/images/katchimeras/achievements/<family>-v<version>/`; generation sheets, prompts and cell mappings live here.

There is no fixed trophy-count or 16-item limit. Each family manifest must cover the current authored achievement definitions for that family, including family-specific, goal, quest and Journey ladders.

## Art direction

Trophies are keepsakes from a Katchimera's world, not generic cups or medals.

- Match the app's polished cozy miniature 3D style: rounded silhouettes, handcrafted clay/wood/stone/leather/fabric, soft diffuse light and gentle ambient occlusion.
- Take palette, material and shape language from the family's character, environment and an existing in-world prop.
- Give each achievement section one recognizable base-object idea. Tiers should enrich that object rather than replace it with unrelated art.
- Keep silhouettes readable at 72–120 px. Avoid thin detached details, text, numerals, characters, photorealism, emoji styling and glossy generic game badges.
- Use a flat chroma generation background. Default to `#ff00ff`; switch to `#00ff00` for families whose native palette needs magenta, pink or violet. Prohibit the selected key colour inside the artwork. Production files must be transparent WebP.

## Generation composition contract

Preventing bad crops starts in the generation prompt, not only in post-processing.

- Ask for an exact regular grid and state the row/column count more than once.
- Require a clearly visible uninterrupted chroma-key gutter between every cell. Target at least 6% of a cell's width and height as empty space between neighboring subjects.
- Keep every object, base, decoration and soft edge fully inside its cell. Nothing may touch or cross an implied cell boundary.
- Prohibit cast shadows, contact shadows, floor planes and reflections. These often extend into the next row even when the main object does not.
- Keep the generated subject inside roughly 68–72% of its cell. The runtime processor will crop meaningful alpha and normalize it to 78%; generating oversized subjects leaves no recoverable edge information.
- Center each subject consistently. Include the complete base and lowest shadow-free pixel, with slightly more source padding below than above.
- Prefer two clean smaller sheets over one overcrowded sheet. If the requested trophy count cannot retain clear gutters, reduce the number of cells per sheet.
- Keep progression objects visually related, but never let a larger late-tier object consume a neighboring cell's safe zone.

## Per-family workflow

1. Read the family's definitions in `constants/companion-achievements.ts`. Record every `sectionId` and its exact number of tiers; never assume four.
2. Choose three references:
   - character cutout for material/palette;
   - family environment for world language;
   - closest existing prop or journal icon for rendering scale.
3. Design one visual metaphor per section and a clear progression across its tiers.
4. Pack the exact number of cells into one or more regular grids. A 4×4 grid is convenient, but not required. Prefer explicit cell mappings whenever different progressions share a row.
5. Generate through fal-hosted GPT Image 2 using the repository's secure Supabase Edge Function. Keep the full prompt in a plain-text sheet prompt file and record the final prompt set in `<family>-vN-prompts.md`:

   ```powershell
   python scripts\generate-achievement-trophy-sheet.py `
     --id <family>-v1-sheet-a `
     --prompt-file design\achievement-trophies\<family>-v1-sheet-a-prompt.txt `
     --reference assets\images\katchimeras\cutouts\<family>.png `
     --reference <environment-or-prop-reference> `
     --out tmp\imagegen\<batch>\<family>-v1-sheet-a-source.png
   ```

   This calls fal's `openai/gpt-image-2/edit` queue through `generate-asset`; `FAL_KEY` remains server-side. The command builds a local style board, downloads the generated source sheet, and writes a `.generation.json` provenance sidecar containing the fal request ID, model, prompt hash and references. Do not call fal directly from client code or put `FAL_KEY` in `.env.local`.
6. Remove the chroma key while retaining a soft antialiased edge:

   ```powershell
   python C:\Users\daruk\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py `
     --input input.png --out output-alpha.png --auto-key border --soft-matte `
     --transparent-threshold 12 --opaque-threshold 220 --despill
   ```

   Before splitting, inspect the alpha sheet at full resolution. Check all four edges of every intended cell, not only the object centers. If any subject or shadow crosses a mathematical grid line, find the real zero-alpha gutter and record that coordinate as an explicit cut. If no transparent gutter exists, regenerate that sheet or affected group; do not crop through trophy artwork to force it to fit.

   If a family's coral, pink or purple materials are damaged by global chroma removal, use the connected-background variant. It only clears key-coloured pixels reachable from the outer sheet border, so similar colours enclosed inside a trophy remain opaque:

   ```powershell
   python scripts\remove-connected-chroma.py `
     --input input.png --out output-alpha.png
   ```

   The connected remover also clears enclosed key-colour holes conservatively. Increase `--interior-distance` toward `90` only when a source has obvious key-colour pockets inside handles or arches and the subject palette remains well separated from the key.

7. Describe the sheet in `<family>-vN.json`. Use legacy `rows` for a square 4×4 sheet, or `grid` plus explicit zero-based `cells` for any layout. Generated grid lines are not always mathematically even: inspect the alpha sheet and put optional `columnCuts` and `rowCuts` through the real transparent gutters so artwork cannot bleed between cells. If a safe gutter shifts between rows or columns, give that cell measured `[left, top, right, bottom]` pixel `bounds` instead of forcing one global cut:

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
       { "name": "section-id-1", "row": 0, "column": 0 },
       { "name": "section-id-2", "row": 0, "column": 1, "bounds": [274, 0, 563, 325] }
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
10. Keep trophy UI images at their fixed frame size with no family-, pillar- or tier-specific scale transforms. If one trophy looks too small or large, normalize its source canvas or add a documented manifest exception; do not compensate in the React Native presentation layer.

## Required post-split review

A successful processor exit is necessary but not sufficient. Complete this review for every generated sheet:

1. Produce a contact sheet in manifest order on the same warm panel color used by the trophy room.
2. Inspect the top and bottom of every icon for crescents, bases or shadows inherited from adjacent rows; inspect left and right edges for neighboring props.
3. Confirm the progression order and filename mapping visually. Grid packing can be correct while tier names are assigned to the wrong cells.
4. Check alpha bounds programmatically: transparent corners, 76–80% maximum subject coverage, and no file above 100 KiB.
5. Preview representative tall, wide and nearly square trophies at both runtime sizes: the 120 px carousel frame and the 78 px achievement-card image.
6. Check locked opacity and earned tick overlays. Important details must remain recognizable without colliding with the tick or caption.
7. Open the family trophy room on a narrow phone viewport and scroll the complete carousel. No artwork may clip, overlap its caption or appear abruptly larger than adjacent trophies.
8. If any check fails, adjust `columnCuts`, `rowCuts`, coverage, or a documented per-cell crop and regenerate the runtime files. Regenerate the source art when the original pixels are already clipped or cells have no clean gutter.

Keep the reviewed contact sheet in `tmp/imagegen/<family>-trophies-vN/` during production. Do not mark the family complete in the batch table until this review passes.

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
| Complete | Movement | Flexel, Shellio |
| Complete | Food & ritual | Baristabbit, Feastle |
| Complete | Connection | Gatherglow, Heartmote, Kindling, Snuglet, Waglet |
| Complete | Daily rhythm | Tasklet, Errandimp, Bedrotte, Dawnle, Mendle |
| Complete | Creativity | Pagelet, Relicoon, Museling, Encora, Flickerbun, Pixooka |
| Next | Exploration | Skylo, Voyagle, Cheerlet |

Review each completed family in the trophy-room UI before generating the next batch. This catches family-specific scale, contrast and concept problems before they are repeated.
