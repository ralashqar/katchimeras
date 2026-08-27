# Mossprout tall garden board

This directory owns the lossless source, alpha masters, prompt, geometry guide,
and QA renders for the two-cell Haven merge-board structure.

- The unversioned source and alpha files are the selected original walled art.
- The v2 wall-free files remain only as a rejected comparison pass and are not
  referenced by runtime code.
- `mossprout-garden-board-merge-overlay.png` is the transparent 6x7 alignment
  plate derived from the Merge page's rounded checker material. Runtime keeps
  this beneath the live board as a loading-safe visual.
- Runtime ships the two original 512x768 structure states, one 512x768 overlay,
  and a 576x672 6x7 board base. Once Mossprout is owned, the structure mounts
  the shared Merge board cells, drag/merge mechanics, feedback, and animations.
- The Haven board uses its own SQLite sandbox save. It starts with Mossprout's
  Wild Garden and Seeds, has no order rail, and never mutates the main Merge
  page's save.
- A one-finger gesture beginning on the board belongs to Merge. Pinch and drags
  beginning outside the board remain Haven camera gestures.
- The central merge surface is `(224, 400)-(800, 1072)` in the canonical
  1024x1536 coordinate space: exactly six 96 px columns by seven 96 px rows.

Package and render QA with:

```powershell
python scripts/package-kingdom-structure.py --source design/floating-neighborhood-v2/mossprout-garden-board/mossprout-garden-board-alpha.png --key floating_neighborhood_v2_mossprout_garden_board
python scripts/package-kingdom-structure.py --source design/floating-neighborhood-v2/mossprout-garden-board/mossprout-garden-board-locked-alpha.png --key floating_neighborhood_v2_mossprout_garden_board_locked
python scripts/render-mossprout-garden-merge-overlay.py
python scripts/render-mossprout-garden-board-qa.py
```
