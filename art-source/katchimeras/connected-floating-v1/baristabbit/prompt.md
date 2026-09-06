# Baristabbit connected floating café

## Reference roles

- `floating_empty_hex_tile_v1.webp`: strict geometry, framing, camera, grass edge, and cliff-silhouette authority.
- `organic_island_v1_baristabbit_hex_tile.webp`: café content and palette reference only.
- `design/organic-islands-v1/ART_STYLE_GUIDE.md`: simplification and mobile-readability authority.

## Final generation prompt

Use the Connected floating islands empty tile as the exact edit target. Preserve its regular six-sided top-face footprint, center, orthographic three-quarter isometric camera, canvas placement, grass edge, deep pointed rock cliff silhouette, dimensions, and scale.

Build a Baristabbit café on the tile with one compact cream-and-caramel café at rear-left, a chunky terracotta roof and striped awning, one simple espresso counter with an oversized toy espresso machine at rear-right, one small round table with two stools at front-right, one broad warm lantern, a few large planters, and a small number of broad stepping stones. Keep a clear lower-center resident patch at roughly 14–16% of tile width. Environment only; do not include a creature.

Use the established Katchimeras cozy cushion-toy 3D style: broad flat colors, matte molded clay/plastic, thick rounded edges, large cushion bevels, clean silhouettes, soft diffuse light, restrained highlights, and gentle major-contact ambient occlusion. It must remain readable at 128–256 px. Avoid micro-texture, fine seams, clutter, text, logos, bridges, clouds, eggs, UI, and cropping.

Generate outside the island on a perfectly uniform `#FF00FF` chroma-key background with no shadow, gradient, texture, floor, or reflection.

## Props-overlay extraction prompt

Use the approved Baristabbit connected-floating composite as the exact edit target and alignment authority. Extract only its café building, roof ornament, awning, serving counter, espresso counter and machine, cups, café table and stools, lantern, planters, broad stepping stones, resident patch, and nearby authored flowers. Preserve their screen-space positions, scale, isometric perspective, overlaps, lighting, and colors.

Remove the entire grass plane, island top face and rim, cliffs, rocks, hanging foliage, and terrain-only marks. Replace every removed pixel with uniform `#FF00FF`, with no floor, shadow, gradient, or texture. The resulting same-canvas cutout must align at `x=0`, `y=0` over `floating_empty_hex_tile_v1.webp`. Do not add, move, resize, restyle, or crop objects; no creature, text, logo, UI, or watermark.
