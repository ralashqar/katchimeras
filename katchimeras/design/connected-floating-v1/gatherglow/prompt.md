# Gatherglow connected-floating props overlay

## Reference roles

- `floating_empty_hex_tile_v1.webp`: strict square canvas, camera and six-sided ground-boundary blueprint.
- `organic_island_v1_gatherglow_hex_tile.webp`: Gatherglow content, palette and cozy-toy art-direction reference only.
- `design/organic-islands-v1/ART_STYLE_GUIDE.md`: simplification and mobile-readability authority.

## Final generation prompt

Create only the freestanding Gatherglow environment props on uniform `#FF00FF`, aligned to the exact square coordinate system of the Connected floating empty base. Include a chunky rear-center hearth pavilion with friendship-knot ornament, curved cushioned sofa, tea trolley, round gathering table and stools, two low fire bowls, broad stepping stones, a compact resident patch and a few consolidated autumn leaf clusters. No creature and no island body, grass, rim, cliff, rocks or terrain.

All ground-contact points must remain inside the conservative inner hex with normalized vertices `(0.29,0.21)`, `(0.71,0.21)`, `(0.90,0.45)`, `(0.72,0.68)`, `(0.28,0.68)`, `(0.10,0.45)`. Tall rear structures may rise above it. Use broad flat colors, matte molded clay/plastic, thick rounded pieces, large cushion bevels, clean silhouettes and soft diffuse light. Avoid micro-texture, thin parts, clutter, text, logos, bridges, clouds and UI.

## Baked placement

The extracted master is scaled to `0.72` around the canvas center and shifted upward by `0.05` canvas height before generating the 1024/512/256 WebPs. Runtime applies no independent transform, keeping the overlay on the same camera rasterization path as the base tile.

## Shallow-cap replacement

The props-only experiment was replaced in runtime by a complete shallow decorated cap. Generate one regular flat-top six-sided grassy tile matching the Connected floating base camera, with the Gatherglow environment integrated into its surface and only one simple rounded earth lip beneath it. The lip should occupy roughly 5–7% of the cap's visible height. Do not generate the deep rocky island, pointed underside, roots, hanging rocks or sky.

The cap master is baked to `0.83` scale around the canvas center and shifted upward by `0.06` canvas height. This leaves a narrow forgiving border of the original base face while positioning the cap's front lip over the base grass/cliff seam. Runtime uses `floating_gatherglow_shallow_cap_overlay_v1` without an additional transform.
