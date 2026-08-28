# Mossprout square merge-board island v4

The user-supplied `mossprout-square-merge-island-v4-source.jpg` is the approved
production artwork. It is promoted without redesigning, recoloring, relighting,
warping, or repainting the island.

The built-in image-generation workflow was used for a strict background-only
replacement attempt. That candidate was rejected because chroma despill changed
warm rail and lantern pixels. The shipped alpha master instead preserves the
original JPEG RGB pixels and removes only blue/cyan backdrop pixels connected
to the canvas border using `scripts/extract-haven-blue-background.py`.

The full supplied square canvas is preserved during LOD packaging. The clear
center is calibrated to `(205, 195)` through `(819, 720)` in the 1024 master.
This is a centered 15% enlargement over the initial v4 calibration and keeps
the visual grid, cells, hit testing, drag geometry, and camera focus synchronized.
