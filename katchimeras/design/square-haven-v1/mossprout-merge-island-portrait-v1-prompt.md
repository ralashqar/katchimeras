# Mossprout orthographic empty merge island v1

## Inputs

- The user's orthographic six-row merge-board screenshot is the authoritative
  composition, camera, materials, and decorative-detail reference.

## Production prompt

Redraw the reference island as a taller, symmetrical near-orthographic floating
garden in the exact style of the current top-level Mossprout and Baristabbit
islands and Mossprout main environment. Use cushiony rounded toy forms, broad
soft bevels, chunky low-frequency silhouettes, smooth matte clay surfaces,
sparse highlights, and soft ambient occlusion. Preserve its broad readable board
face, nearly parallel sides, honey wood railing, four corner lantern posts,
large leafy white-flower accents, simple mossy rock cliff, and centered front
stone steps. Avoid embossed grass, wood grain, cracks, tiny stones, sharp seams,
thin trim, realistic materials, and all other high-frequency surface detail.

Keep the inset lawn as one uninterrupted, softly textured green playfield with
no squares, checker pattern, row or column divisions, lines, or cell-like marks.
The rear edge is only a low continuous garden railing and hedge. Do not depict chairs, seats, booths,
counters, tables, characters, creatures, trays, food, order cards, merge items,
text, UI, or watermarks.

Generate the complete uncropped silhouette on a uniform `#FF00FF` background.
The accepted chroma source is converted to a transparent alpha master and
packaged without changing its camera proportions.

## Runtime geometry

The alpha master is fitted into a `1024x1488` canvas. The calibrated playfield
corners in that normalized canvas are:

- top-left `(167, 188)`
- top-right `(836, 188)`
- bottom-left `(143, 1100)`
- bottom-right `(880, 1100)`

The app's 7x9 visual and interaction grid is calibrated over the empty lawn.
Three dynamic order-chair slots remain independent runtime overlays.
