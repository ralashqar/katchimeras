# Mossprout nature islands — Level 4 art direction

These six transparent PNGs are the authoritative fully developed forms for
Mossprout's nature-island progression. Levels 1-3 should be derived backwards
from them, preserving the camera, island footprint, focal landmark, lighting,
and main color relationships while progressively removing density and magic.
Until those bespoke stages are ready, the runtime intentionally maps every
visible island level to the corresponding max-level art below.

## References

- `style-reference-board.png`: combined authority for the Mossprout main
  island plus the newest Mossprout, Steppling, Baristabbit, and Feastle hex
  tiles. It defines camera, floating-island proportions, palette discipline,
  soft toy materials, bevel language, lighting, and production detail density.
- The original composition reference remains the authority for the six island
  roles, but not for prop density or texture detail.

## Enforced production style

Every island uses a cozy 3D toy-diorama language: cushiony molded-clay forms,
broad soft bevels, chunky rounded geometry, smooth matte-to-satin materials,
large untextured color areas, warm upper-left studio light, restrained ambient
occlusion, and a front three-quarter isometric camera. Each sprite must read at
256 px through one dominant landmark, a few large secondary forms, clear
negative space, and a shallow rounded island silhouette matching the production
hex tiles.

No island may use micro foliage, surface noise, bark or rock texture, scattered
tiny props, dense mixed flowers, scratches, cracks, painterly detail,
photorealism, sharp edges, excessive glow, black outlines, or external cast
shadows. All masters require genuine alpha transparency and transparent
corners.

Island-specific subjects:

- Seed Nursery: one greenhouse, one shelf, three large trays, one watering can,
  a simple path, and a few oversized sprouts.
- Bloom Garden: one floral arch, three large flower groupings, a clear path,
  and two butterflies.
- Pond Sanctuary: one waterfall, one pond, one footbridge, three lily pads,
  two lotus blooms, and sparse reeds and stones.
- Orchard Grove: three fruit trees, one basket, two crates, one ladder, and a
  clear entrance path.
- Ancient Tree Grove: one spirit tree, three lanterns, one heart emblem, one
  spring, and three mushrooms.
- Wildgrowth Grove: three oversized mushrooms, one hollow log, four broad
  ground plants, and a simple entrance path.

The built-in image-generation workflow produced the style-enforced renders and
dedicated background-extraction passes produced the checked RGBA masters in
`max-level/`. `scripts/package-haven-nature-islands.py` normalizes their visible
silhouettes onto consistent square canvases and writes the 1024, 512, and 256
WebP runtime tiers.
