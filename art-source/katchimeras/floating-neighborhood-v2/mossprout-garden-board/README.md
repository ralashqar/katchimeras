# Mossprout tall garden board

This directory owns the lossless source, alpha masters, prompt, geometry guide,
and QA renders for the two-cell Haven merge-board structure.

- The unversioned source and alpha files preserve the previous walled art.
- The v2 wall-free files remain only as a rejected comparison pass and are not
  referenced by runtime code.
- The v3 front-isometric source is the selected revealed runtime art based on
  the two user references. Its clean and annotated construction guides lock
  the 6x7 grid, four end ports, sealed sides, and increased front cliff depth.
- The earlier merge overlay and standalone 6x7 base remain as source-history
  artifacts. The selected art paints its own grid, so Haven mounts the live
  cells, drag/merge mechanics, feedback, and animations on a transparent
  rectangular interaction surface instead of covering it.
- Runtime ships fixed 512x768 revealed and locked structure states. The locked
  state intentionally keeps the previous art until a matching lock pass is
  authored.
- The Haven board uses its own SQLite sandbox save. It starts with Mossprout's
  Wild Garden and Seeds, has no order rail, and never mutates the main Merge
  page's save.
- A one-finger gesture beginning on the board belongs to Merge. Pinch and drags
  beginning outside the board remain Haven camera gestures.
- The selected central merge surface is `(238, 289)-(800, 1033)` in the
  canonical 1024x1536 coordinate space: six columns by seven taller cells. The
  live surface is lifted 37 px (about 5% of its height) to align the items and
  hit targets with the painted perspective grid.

Package and render QA with:

```powershell
python scripts/package-kingdom-structure.py --source design/floating-neighborhood-v2/mossprout-garden-board/mossprout-garden-board-v3-front-isometric-alpha.png --key floating_neighborhood_v2_mossprout_garden_board
python scripts/package-kingdom-structure.py --source design/floating-neighborhood-v2/mossprout-garden-board/mossprout-garden-board-locked-alpha.png --key floating_neighborhood_v2_mossprout_garden_board_locked
python scripts/render-mossprout-garden-merge-overlay.py
python scripts/render-mossprout-garden-isometric-guide.py
python scripts/render-mossprout-garden-board-qa.py
```
