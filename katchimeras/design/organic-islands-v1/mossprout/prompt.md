# Mossprout Pocket Grove generation prompt

Built with Codex's built-in image generator. The user-supplied garden image was the composition reference. The previous Pocket Grove asset was the isometric floating-island and Katchimeras visual-lineage reference.

```text
Use case: stylized-concept
Asset type: production environment tile for a React Native mobile game
Input images: Image 1 is the desired garden-room composition reference. Image 2 is the current Mossprout Pocket Grove asset whose floating-island identity, isometric camera angle, and cozy visual lineage should be retained.
Primary request: Redesign Mossprout's floating garden environment to feel much closer to Image 1: a complete miniature garden sanctuary arranged around a broad circular stone clearing, with a leaf-roof cottage at upper-left, a tiny pond and short waterfall at lower-right, a simple flower arch at upper-right, a few raised planting beds, warm wooden lantern posts, stepping-stone paths, and a low perimeter fence. Keep an organic rounded floating-island silhouette rather than a visible hexagon.
Style/medium: cozy 3D toy diorama, low-poly-inspired soft forms, genuinely low detail, flat matte colors, chunky readable shapes, subtle ambient occlusion, restrained highlights, no realistic texture, no painterly noise.
Composition/framing: square isometric three-quarter view, whole island visible with generous padding. The open circular clearing must be the visual center and remain mostly empty so a separate Mossprout character sprite can stand there. Keep props around the perimeter and avoid visual clutter.
Color palette: moss green, leaf green, honey wood, warm cream stone, small muted pink/yellow flower accents, clear toy-blue water.
Materials/textures: simplified molded clay/plastic feel; broad color planes; minimal seams and leaf veins; no micro-texture.
Constraints: environment only; no creature or character; no bridge leaving the island; no labels, signs, text, logo, watermark, UI, clouds, cast shadow, or floor plane. Use fewer and larger props than Image 1. Maintain a clear resident standing area near the center-lower portion.
Background: perfectly flat solid #FF00FF chroma-key background. It must be one uniform color with no gradient, texture, shadows, reflections, or lighting variation. Keep the island fully separated from the background with crisp edges and generous padding. Do not use magenta anywhere in the island.
```

The accepted output was extracted from magenta with the installed chroma-key helper using a tight hard matte and a three-pixel edge contraction to preserve the warm toy palette. It was then packaged to 1024/512/256 WebP runtime LODs.

## Rocky-base edit prompt

```text
Use case: precise-object-edit
Asset type: production floating-island environment tile for a React Native mobile game
Input image: the current approved Mossprout Pocket Grove asset and edit target.
Primary request: Change only the floating island's underside/base. Make the base clearly thicker and more island-like by extending it downward with a substantial visible rocky-earth cliff layer, approximately 25–30% of the island's total visible height. Use chunky irregular rounded stone and compacted-earth columns, a few stepped ledges, shallow cracks, and occasional small moss caps. The underside should feel weighty and dimensional, taper slightly toward the bottom, and have an irregular natural silhouette rather than a thin flat platform.
Style: preserve the exact cozy low-detail 3D toy-diorama style, flat matte colors, chunky readable forms, isometric camera, lighting, and scale.
Invariants: preserve the entire upper garden surface and its composition as closely as possible—same leaf cottage, central circular clearing, flower arch, planters, lanterns, fences, pond, waterfall, paths, palette, prop positions, and empty resident standing space. Do not add, remove, or rearrange surface props. Do not add a creature.
Composition: keep the full island centered and fully visible with generous padding; extend the base downward into the available empty space without cropping.
Background: preserve a perfectly flat uniform solid #FF00FF chroma-key background with no shadow, gradient, texture, floor plane, or reflection. Do not use magenta in the island.
Avoid: stalactites, sharp realistic rocks, excessive strata detail, cave openings, roots hanging down, bridges, clouds, labels, text, logos, watermark, UI.
```

## Mid-depth base refinement

```text
Use case: precise-object-edit
Asset type: production floating-island environment tile for a React Native mobile game
Input image: the current approved Mossprout Pocket Grove with an overly deep rocky underside; this is the edit target.
Primary request: Shorten only the rocky-earth underside to approximately HALF its current depth. The final base should sit midway between a thin platform and the current massive deep cliff: clearly a floating island with two to three chunky staggered rock tiers, but not a tall rock tower. Target the underside below the garden rim at roughly 20–24% of the whole island's visible height. Remove the lowest rock rows and compress the remaining rounded stone columns into a gently tapered, irregular base.
Style: preserve the exact cozy low-detail 3D toy-diorama style, flat matte colors, chunky readable stones, isometric camera, lighting, and scale.
Invariants: preserve the entire upper garden surface as closely as possible—same leaf cottage, central circular clearing, flower arch, planters, lanterns, fences, pond, waterfall, paths, colors, prop positions, and empty resident standing area. Do not add, remove, or rearrange garden props. No creature.
Composition: keep the full island centered with generous padding. Retain visible rocky thickness around the entire underside, but make the overall silhouette noticeably shorter and lighter than the input.
Background: perfectly flat uniform solid #FF00FF chroma-key background with no shadow, gradient, texture, floor plane, or reflection. Do not use magenta in the island.
Avoid: thin flat tile, giant deep cliff, more than three obvious rock tiers, stalactites, caves, hanging roots, sharp realistic rock, bridges, clouds, labels, text, logos, watermark, UI.
```

## Soft toy-art restyle

```text
Use case: style-transfer
Asset type: production floating-island environment tile for a React Native mobile game
Input images: Image 1 is the approved Mossprout Pocket Grove composition and edit target. Image 2 is the established Katchimeras hex-tile style reference for softness, simplicity, material treatment, large bevels, and distance readability.
Primary request: Restyle Image 1 into a MUCH softer, simpler toy-like 3D asset matching Image 2's visual language. Preserve the recognizable Mossprout garden layout and medium-depth floating base, but rebuild every form with low detail, broad flat color areas, thick rounded edges, large soft bevels, and clean separated silhouettes. It must remain instantly readable when reduced to 128–256 pixels.
Simplification: remove fine grass texture, speckles, cracks, seams, tiny leaves, fine leaf veins, and scattered micro-flowers. Use roughly 8–12 large pillowy cottage-roof leaves, one smooth moss-green ground plane, fewer larger clearing stones, a handful of rounded foliage clusters, a few oversized flowers, two simple base tiers, chunky simplified construction, and smooth water shapes.
Lighting/material: soft diffuse studio-like game lighting, gentle ambient occlusion only at major contacts, very soft broad highlights, matte molded-clay/plastic surfaces, moderate saturation, low local contrast.
Composition invariants: retain leaf cottage upper-left, flower arch upper-right, central empty circular resident clearing, pond/waterfall lower-right, planters, warm lanterns, perimeter fence, isometric camera, medium island-base thickness, and overall organic rounded footprint. No creature.
Background: perfectly flat uniform solid #FF00FF chroma-key background, with no gradient, texture, shadow, floor plane, or reflection. Do not use magenta in the island.
Avoid: micro-detail, texture noise, individual blades of grass, many tiny flowers, etched stone, sharp edges, thin pieces, excessive outlines, photorealism, character, bridge, clouds, labels, text, logo, watermark, UI.
```
