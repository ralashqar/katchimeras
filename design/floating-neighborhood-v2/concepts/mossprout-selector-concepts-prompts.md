# Mossprout selector concepts

Generated with the built-in OpenAI image-generation tool using these project references:

- `../floating-mossprout-selector-emblem-alpha.png` for selector scale and composition
- `../floating-mossprout-alpha.png` for the floating-island silhouette and camera
- `../../square-haven-v1/mossprout-main-environment-1024.png` for materials, lighting, and art direction

## Heartseed Sanctuary

```text
Use case: stylized-concept
Asset type: top-level Haven selector hex tile concept — Heartseed Sanctuary
Input images: Image 1 current selector composition reference; Image 2 original floating hex structure and camera reference; Image 3 project art-style reference.
Primary request: Create a bold new artistic representation of Mossprout's world, centered on a monumental luminous heart-shaped seed held upright in a cradle of broad curling roots. This is a complete symbolic environment, not a room waiting for a character.
Scene/backdrop: one self-contained floating flat-top hex island with a deep tapered cliff underside and genuine transparent background. No surrounding wall is required. Soft moss terraces, a tiny curved stream, stepping stones, oversized simplified leaves, and a few cream flowers flow toward the central seed.
Style/medium: Katchimeras cozy 3D toy diorama; very low detail, very low texture detail, broad soft bevels, large readable clay-like forms, smooth tactile materials. Match the supplied references' camera, scale, lighting, and green/ochre palette.
Composition/framing: centered orthographic-front-isometric game asset, square canvas, complete uncropped silhouette, strong central landmark readable at 256px. The central heartseed occupies the former empty middle and is unmistakably the hero.
Lighting/mood: warm gentle upper-left light, soft amber glow within the seed, hopeful and magical but restrained.
Constraints: no Katchimera, no egg, no portrait, no UI, no text, no empty central clearing, no checkerboard, no external shadow, no cropped edges. Genuine transparent alpha outside the island.
```

## Bloomwell

```text
Use case: stylized-concept
Asset type: top-level Haven selector hex tile concept — Bloomwell
Input images: Image 1 current selector composition reference; Image 2 original floating hex structure and camera reference; Image 3 project art-style reference.
Primary request: Reimagine Mossprout's selector tile around a huge open six-petal flower whose cupped center holds a glowing turquoise dew spring. The flower is a symbolic landmark and completely fills the visual center; the whole island feels like a magical garden spring rather than an empty home platform.
Scene/backdrop: one self-contained floating flat-top hex island with a deep tapered cliff underside and genuine transparent background. Organic grassy banks replace perimeter walls. A narrow water ribbon spills from the central flower into two tiny round pools, surrounded by bold leaf clusters, smooth stones, and a few restrained white and yellow blooms.
Style/medium: Katchimeras cozy 3D toy diorama; very low detail and texture detail, big simplified forms, broad soft bevels, smooth clay and polished toy materials. Match the references' camera, lighting, silhouette weight, and friendly scale.
Composition/framing: centered orthographic-front-isometric square game asset, complete uncropped silhouette, iconic at 256px. Make the Bloomwell large, clean, symmetrical enough to read instantly, while surrounding nature remains organic.
Lighting/mood: fresh spring morning, warm upper-left light, subtle luminous dew, cozy rather than ethereal.
Constraints: no Katchimera, no egg, no portrait, no UI, no text, no empty middle, no walls all around, no checkerboard, no external shadow, no cropped silhouette. Genuine transparent alpha outside the island.
```

## Elderleaf Grove

```text
Use case: stylized-concept
Asset type: top-level Haven selector hex tile concept — Elderleaf Grove
Input images: Image 1 current selector composition reference; Image 2 original floating hex structure and camera reference; Image 3 project art-style reference.
Primary request: Create a bold Mossprout world emblem dominated by one heroic ancient toy-like tree growing from the center of the floating hex. Its trunk forms a tiny rounded green leaf-door shrine, its broad roots create the island paths, and its layered canopy makes a recognizable Mossprout crown. The center must feel intentionally complete and iconic.
Scene/backdrop: one self-contained floating flat-top hex island with a deep tapered cliff underside and genuine transparent background. No perimeter wall. Root bridges divide small moss gardens; one tiny blue spring curves around the roots; a bench and watering can are secondary accents only. Use dense but simplified plant masses at the edges.
Style/medium: Katchimeras cozy 3D toy diorama; very low detail, very low texture detail, soft chunky bevels, large smooth shapes, tactile clay-like greens and warm ochres. Follow reference camera, lighting, and material softness closely.
Composition/framing: centered orthographic-front-isometric square game asset, complete uncropped silhouette, strong readability at 256px. The tree and leaf-door shrine are the unmistakable central symbol; avoid a vacant clearing.
Lighting/mood: warm upper-left lantern-like daylight, sheltered and welcoming.
Constraints: no Katchimera, no egg, no portrait, no UI, no text, no empty central space, no full surrounding wall, no checkerboard, no external shadow, no cropped edges. Genuine transparent alpha outside the island.
```

## Export notes

- Bloomwell is an RGBA cutout with verified transparent corners.
- Heartseed Sanctuary and Elderleaf Grove are review renders with an opaque white background; they need a clean production matte before integration.

## V2 — enforced project toy style

The second pass uses the first concepts only for subject/composition. These three project assets are authoritative for rendering style:

- `../../../katchimeras/design/floating-neighborhood-v2/floating-baristabbit-alpha.png`
- `../../../katchimeras/design/floating-neighborhood-v2/floating-encora-alpha.png`
- `../../../katchimeras/design/square-haven-v1/mossprout-main-environment-alpha-v3-toy.png`

Shared style direction used for all three V2 concepts:

```text
Redraw from scratch in the exact Katchimeras project visual language: cozy 3D toy diorama, very low detail, very low texture detail, cushiony rounded construction, broad soft bevels, chunky friendly proportions, smooth matte clay and soft vinyl materials. Use a small number of large clean molded forms. Match the project references' front-isometric near-orthographic camera, warm upper-left studio lighting, broad gradients, and gentle contact shadows. The concept image controls only the landmark and broad composition; do not inherit its detailed rendering.

Avoid dense foliage, ferns, scattered pebbles, bark grooves, realistic leaf veins, high-frequency texture, photorealism, excessive gloss, surrounding walls, characters, eggs, UI, and text. Keep a complete uncropped floating-island silhouette, readable at 256px.
```

Concept-specific direction:

- **Heartseed Sanctuary:** one large glowing heart-shaped seed cupped by two broad roots; two simple pools, one short path, three or four leaf clumps, two cream flowers, and no more than two lanterns.
- **Bloomwell:** one huge six-petal cream flower cradling a turquoise dew spring; one water ribbon, two simple pools, four large leaf cushions, three small flowers, a few large stones, and no more than two lanterns.
- **Elderleaf Grove:** one monumental rounded tree with a tiny green leaf-door shrine; three or four broad roots, one curved pool, five or fewer large plant clusters, one bench, two cream flowers, and no more than two lanterns.

All V2 outputs are review renders with an opaque pale background. A selected concept should receive a dedicated clean-alpha production pass before runtime integration.
