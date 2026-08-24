# Mossprout Bloom Sanctuary — Stage 4 prompt

Built with Codex's built-in image generator. The approved soft-toy Pocket Grove was the strict composition and style target. The older Mossprout Haven Stage 4 tile was supplied only as progression-content context.

```text
Use case: precise-object-edit
Asset type: Stage 4 fully upgraded production Haven environment for a React Native mobile game
Input images: Image 1 is the approved Organic Islands v1 Mossprout base and strict composition/style target. Image 2 is an older Mossprout Stage 4 tile used ONLY as progression-content inspiration; do not copy its hex shape, texture, foliage density, or detail level.
Primary request: Create the fully upgraded Stage 4 “Mossprout Bloom Sanctuary” from Image 1. Preserve the isometric camera, organic footprint, medium two-tier island base, central resident clearing, main landmark positions, and very soft simple toy-art language. Make the upgrade unmistakable at 128–256 px through four bold large-scale changes:
1. Enlarge the rear-left leaf cottage about 15–20%, giving it a fuller two-layer canopy made from only 10–14 huge pillowy leaves, a brighter warm window, and a more substantial rounded doorway. Keep it a single cozy cottage, not a tower.
2. Make the rear-right flower arch taller and broader, with a thick rounded frame, a lush simple leaf cap, and exactly five or six oversized flowers forming one clear celebratory crown.
3. Turn the raised beds into completed mature gardens using only two or three large readable plant forms per bed—broad leaves and one simple golden bloom or vegetable shape, never many small plants.
4. Widen the lower-right pond slightly and upgrade the waterfall into a two-step smooth toy-water cascade with two large lily pads and one large lotus. Use broad blue shapes and restrained warm magical glow.
Supporting upgrade: keep the two existing chunky lantern landmarks but make their warm glow stronger and give nearby fence posts simple golden cap accents. Do not add more lantern posts.
Style contract: Organic Islands v1 soft molded-toy 3D—broad flat colors, matte clay/plastic materials, thick rounded construction, large cushion bevels, clean separated silhouettes, very soft diffuse lighting, broad highlights, and ambient occlusion only at major contacts. Lower detail than Image 2. No surface noise.
Composition invariants: keep the circular resident clearing centered, empty, and at least 20% of island width. Keep cottage rear-left, arch rear-right, pond lower-right, stairs lower-left, garden beds at rear, perimeter fence, organic rounded island silhouette, and base depth at 18–25% of visible height. Environment only; no character.
Progression rule: add hierarchy, not noise. Do not fill empty ground. The sanctuary should feel completed through larger hero forms, richer light, and stronger color grouping while remaining as simple and readable as Image 1.
Background: perfectly flat uniform solid #FF00FF chroma-key with no gradient, texture, shadow, floor plane, or reflection. Do not use magenta in the island.
Avoid: visible hexagon, micro-detail, grass texture, speckles, cracks, fine leaf veins, tiny flowers, flower confetti, thin vines, etched stone, excessive props, photorealism, bridge, clouds, creature, egg, labels, signs, text, logo, watermark, UI, crop.
```

The accepted image was extracted with the Organic Islands v1 hard-matte chroma contract, then packaged as 1024/512/256 WebP LODs under `organic_island_v1_mossprout_haven_stage_4_hex_tile`.

## Final framing correction

The first accepted composition touched the lower canvas edge, so the final production master used this framing-only edit:

```text
Use case: precise-object-edit
Asset type: final framing correction for a production floating-island game asset
Input image: the approved Mossprout Bloom Sanctuary Stage 4 artwork.
Primary request: Change ONLY the framing. Preserve the island design, composition, camera, proportions, landmarks, toy-art style, colors, lighting, and all objects exactly as closely as possible. Scale the complete island down uniformly by about 8% and recenter it so there is clean, generous #FF00FF padding on all four sides, including at least 55 pixels beneath the lowest rock edge. No part of the island may touch or be cropped by the canvas.
Invariants: same enlarged leaf cottage, five-to-six-flower arch crown, mature garden beds, empty central resident clearing, expanded lotus pond and two-step waterfall, gold-capped fence, two lanterns, organic footprint, and medium base depth. Do not add, remove, move, or redesign anything.
Background: perfectly flat uniform solid #FF00FF chroma-key with no gradient, texture, shadow, floor plane, or reflection. Do not use magenta in the island.
Avoid: any content change, extra detail, micro-texture, altered perspective, altered base depth, character, text, logo, watermark, UI.
```
