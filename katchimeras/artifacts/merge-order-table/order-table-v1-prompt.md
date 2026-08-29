# Merge order table/tray sprite

Built-in image generation edit using the user-supplied table/tray image as the edit target.

## Final correction prompt

Use case: precise-object-edit

Asset type: chroma-key game sprite source

Change one thing only: replace every pixel outside the table/tray object with exact solid `#ff00ff` magenta. The entire background must be one flat color with no gradient, vignette, glow, cast shadow, contact shadow, floor, reflection, texture, or lighting variation. Preserve the table/tray object exactly: geometry, scale, position, wood, white tray, golden leaf emblem, green foot caps, highlights, materials, and crisp silhouette. Do not crop, redesign, recolor, move, or restyle the object. No added elements, text, or watermark.

The chroma-key source was converted locally to `order-table-v1-alpha.png` with the imagegen skill's `remove_chroma_key.py` helper.
