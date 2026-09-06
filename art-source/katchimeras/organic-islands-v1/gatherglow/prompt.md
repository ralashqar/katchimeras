# Gatherglow Shared Hearth — production prompt set

Generated with the built-in image-generation tool. Image 1 was the approved
Baristabbit Organic Islands v1 master, Image 2 was Gatherglow's character
cutout, and Image 3 was the previous Gatherglow Stage 4 habitat used only as a
content reference. The second pass corrected the resident-zone proportion.

## Initial generation

```text
Use case: stylized-concept
Asset type: production floating-island Haven environment for a React Native mobile game
Input images: Image 1 is the approved Organic Islands v1 style, camera, framing, base-depth, shape-language, and thumbnail-readability reference. Image 2 is Gatherglow's warm amber/orange identity palette reference only; do not include the creature. Image 3 is a content reference for Gatherglow's established shared-hearth habitat only; preserve its hearth, communal seating, table, and welcoming lights, but DO NOT copy its detail density, wall enclosure, thick pointed base, or large central circle.
Primary request: Create one standalone Gatherglow Shared Hearth organic island environment, a warm sanctuary for friendship, mutual connection, relaxed conversation, and belonging. It must read as a social gathering place at 128–256 px while remaining soft, simple, and uncluttered.
Scene and landmarks: Build one large rounded open-front hearth pavilion at the rear-center, with a broad curved roof, a chunky glowing fireplace opening, and a simple interlocking-rings ornament above it as shape only. Place a substantial curved cushioned conversation bench along the rear-left. Place one large low round shared table just right of center with four broad rounded stools, arranged as a welcoming group rather than a formal dining set. Add a small chunky tea trolley or hosting cart at the rear-right with only one oversized pot and two cups. Add two large low bowl lanterns or flame-shaped warm lights near the front side, two simple hanging lanterns near the hearth, and a few low rounded amber-leaf shrubs. Use only a few broad paving pieces to connect the landmarks.
Resident zone — important new proportion rule: Keep one compact clear standing patch in the center-front, positioned just left of the shared table and aligned with the resident anchor. It should be only about 14–16% of the visible island width: enough for one separately rendered character plus modest breathing room, but much smaller than the large café circle in Image 1 and smaller than the circle in Image 3. Make it a subtle soft oval woven rug or smooth ground patch with no ring of stones and no large circular plaza. Leave it free of furniture and tall props, while using the recovered space for the bench, table, stools, hosting cart, lights, and planting.
Island and base: Organic rounded footprint contained inside an invisible hex layout cell; never draw a hexagon. Medium two-tier rocky-earth underside matching Image 1, around 18–23% of visible island height, built from a few large rounded lobes, never a pointed or deep cliff. Smooth muted golden-olive ground with warm terracotta paving and generous clear padding around the complete island.
Style: Match Image 1's very soft simple toy-like 3D: broad flat color regions, matte molded clay/plastic, thick rounded edges, very large cushion bevels, chunky clean silhouettes, soft diffuse lighting, broad restrained highlights, and gentle ambient occlusion only at major contacts. Low detail and extremely readable from a distance. Objects should be slightly oversized and icon-like.
Palette: warm amber, apricot orange, pumpkin terracotta, golden cream, caramel wood, restrained cocoa brown, muted golden olive ground, and small deep coral accents. The glow should be warm pale butter yellow. Do not use magenta anywhere in the island.
Simplification: no grass texture, grit, cracks, brick texture, wood grain, tiny flowers, many leaves, tiny cushions, table clutter, food, writing, thin poles, transparent glass, steam, smoke, sparks, or fine seams. Use a few large cushions and bold grouped shapes.
Composition/framing: square orthographic three-quarter isometric view at the same elevation, scale, island footprint, and medium base depth as Image 1. Entire island fully visible and centered with generous padding on every side. Environment only.
Background: perfectly flat uniform solid #FF00FF chroma-key background for removal. No gradient, texture, shadow, floor, horizon, reflection, or lighting variation. Keep every island edge crisp and fully separated from it.
Avoid: creature, Gatherglow, face, eyes, body, character silhouette, egg, giant empty center circle, stone ring around the resident zone, visible hex border, enclosed fortress walls, bridge, clouds, photorealism, high detail, busy decoration, thin furniture, text, labels, words, logo, watermark, UI, cropped island, pointed base, or cast shadow outside the island.
```

## Resident-zone correction

```text
Use case: precise-object-edit
Asset type: production floating-island Haven environment for a React Native mobile game
Edit target: the immediately preceding generated Gatherglow Shared Hearth island.
Primary request: Change only the resident rug/clear standing patch in the lower-left-of-center foreground. Shrink that olive oval rug to approximately 55–60% of its current width and height, so it occupies roughly 14–16% of the visible island width and fits one separately rendered character with modest breathing room. Keep it in the same general center-front position. It must read as a compact personal standing patch, not a large central plaza.
Use the newly recovered ground around the smaller rug for only two or three broad flat terracotta stepping stones and one small low rounded amber-leaf plant near the perimeter; do not introduce another focal object or clutter.
Preserve exactly: the complete organic island footprint, medium two-tier base thickness, camera, framing, scale, rear hearth pavilion, curved bench, shared round table, four stools, tea trolley, all lanterns, existing foliage groups, palette, lighting, soft molded-toy 3D style, flat #FF00FF background, and generous padding. Keep the island environment-only.
Do not change the table size or move the resident rug underneath furniture.
Avoid: character, creature, face, large empty oval, large circle, stone ring, new furniture, detailed texture, text, logo, visible hex, crop, bridge, cloud, shadow outside island, or any change beyond shrinking the resident rug and gently filling the released ground.
```

Extraction used border auto-keying with tolerance `64` and edge contraction `4`.
The runtime key is `organic_island_v1_gatherglow_hex_tile`.
