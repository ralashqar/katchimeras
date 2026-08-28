# Baristabbit cozy cafe island — Square Haven v2

Generated with the built-in image-generation workflow.

## Reference roles

- The approved Mossprout square-v4 source is the strict camera, square
  footprint, rail system, cliff depth, paving density, framing, material,
  lighting, bevel, and project-style reference.
- The previous Square Haven Baristabbit cafe is a theme reference for the
  serving window, awning, cup motif, furniture, and warm palette only.
- Baristabbit's cutout supplies identity and palette only; the resident is not
  baked into the environment.

## Production prompt

Create a standalone Baristabbit Cozy Cafe square island platform that looks
like a sibling built from the same kit as the approved Mossprout island.

Preserve the exact true-orthographic elevated camera, parallel front/rear and
left/right edges, apparent scale, square canvas framing, shallow brown cliff
course, green edge blocks, wooden perimeter rails and posts, four large
lanterns, centered front opening, and four cream front steps. No side bridges
or additional stairs.

At the rear center, place a substantial rounded cream-and-caramel cafe cottage
with a warm rounded roof, one forward-facing serving window, a broad striped
terracotta-and-cream awning, and a simple sculpted cup emblem without words.
Use a chunky counter with one large toy coffee-pot or espresso-machine
silhouette and two oversized cups. Keep the scene uncluttered.

Retain a large circular cream-stone plaza in the center, with its central
standing zone completely empty for the separately rendered resident. Place one
round table with two broad stools on the left and one small bench seating area
on the right, outside the resident zone. Add two low rear planters with broad
leaves, sparse cream flowers, and restrained terracotta accents.

Match the Mossprout master exactly: premium cozy 3D toy diorama, matte molded
materials, very broad soft bevels, chunky modular forms, large readable
silhouettes, low texture detail, restrained surface variation, warm upper-left
lighting, broad highlights, and soft ambient occlusion. Use crema, cappuccino,
caramel, honey wood, espresso brown, muted terracotta, amber light, and the same
moss/lime greens as Mossprout.

Exclude characters, rabbits, ears, faces, eggs, residents, text, menu writing,
logos, tiny food or utensil clutter, glass, steam, smoke, fine wood grain,
cracks, noise, thin furniture, extra islands, bridges, perspective taper,
rounded organic footprints, photorealism, and cropped silhouettes.

Render over a perfectly flat solid `#ff00ff` removable background with no
gradient, scenery, floor, cast shadow, reflection, glow, text, or watermark.

The alpha master is extracted with the connected magenta-background mode of
`scripts/extract-haven-blue-background.py`, preserving the generated RGB pixels
without cream/terracotta despill.

The approved alpha is packaged by `scripts/package-baristabbit-square-island.py`
into the existing 1024px, 512px, and 256px Baristabbit runtime asset names. The
resident anchor is calibrated to 54% of the island frame height, centered on the
cream-stone plaza.
