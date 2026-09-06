# Dream mist v3

Built-in image generation edit. References: current `dream_mist_locked_hex_tile_v2.webp`, original `dream_mist_locked_hex_tile_v1.webp`, and merge-board `dream-mist-full.webp`.

## Art prompt

Edit reference image 1, the CURRENT hex tile, changing ONLY its mist/clouds. Reference image 2 is the original dream mist for mist appearance ONLY; reference image 3 is the merge-board cloud graphic for the rounded cloud material. Preserve image 1's hexagonal floating stone foundation, front central stairs, rocky lower point, camera angle, warm beige and slate stone colors, scale, placement and cozy toy diorama 3D style exactly. Do not add green rim, grass, flowers, buildings, characters or vegetation from reference 2. Replace the oversized solid cloud mound of image 1 with a lower layered bed of many smaller soft cloud puffs inspired by reference 2 and reference 3: dreamy milky ivory, pale lavender and gentle pale blue, cushiony rounded forms, soft bevels, minimal texture detail. Subtle luminous pale cyan light in crevices between puffs, a few small understated luminous points, soft mist blending around puff bases. Should read as magical dream mist concealing the tile, not rocks or whipped cream or smoke. Clouds cover the whole interior but leave stone perimeter and stairs visible. Mist silhouette lower than image 1, with a few mid-height puffs toward back, broad readable shapes, no huge central mound. Keep toy art style and low detail, no realistic noisy fog or heavy special effects. Single isolated game tile, transparent background with clean alpha. Same square composition and same stone base footprint as image 1. No text, no UI.

## Transparency pass

Background extraction only. Preserve the exact floating hex tile and all its pastel dreamy mist, pale blue glimmers, stone and stairs unchanged. Remove the baked white/gray checkerboard completely. Output a genuine transparent RGBA PNG with alpha zero outside the tile, not a rendered checkerboard, not a white background. Clean anti-aliased silhouette. Retain same composition, square canvas and full tile.

Packaged as transparent WebP at 1024, 512, and 256 pixels. Alpha bounds regenerated using the project script.
