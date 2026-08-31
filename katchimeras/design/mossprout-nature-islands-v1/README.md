# Mossprout nature islands — Level 4 art direction

These six transparent PNGs are the authoritative fully developed forms for
Mossprout's nature-island progression. Levels 1-3 should be derived backwards
from them, preserving the camera, island footprint, focal landmark, lighting,
and main color relationships while progressively removing density and magic.
Until those bespoke stages are ready, the runtime intentionally maps every
visible island level to the corresponding max-level art below.

## References

- `references/layout-guide.jpg`: authority for the compact three-row satellite
  arrangement around Mossprout's environment and Merge board.
- `references/island-render-guide.jpg`: authority for each satellite's subject,
  silhouette, prop budget, entrance direction, and negative space.
- `style-reference-board.png`: combined authority for the Mossprout main
  island plus the newest Mossprout, Steppling, Baristabbit, and Feastle hex
  tiles. It defines camera, floating-island proportions, palette discipline,
  soft toy materials, bevel language, lighting, and production detail density.
- `generation-prompts-v3.md`: records the strict main-island style lock and the
  six subject prompts used for the current masters. `generation-prompts-v2.md`
  is retained as the previous, looser art-direction pass.

## Enforced production style

Every island uses a cozy 3D toy-diorama language: cushiony molded-clay forms,
broad soft bevels, chunky rounded geometry, smooth matte-to-satin materials,
large untextured color areas, warm upper-left studio light, restrained ambient
occlusion, and a front three-quarter isometric camera. Each sprite must read at
256 px through one dominant landmark, a few large secondary forms, clear
negative space, and a shallow rounded island silhouette matching the production
hex tiles.

The cliff is not generic floating-island rock. It must match the main Mossprout
island's construction: one padded grass top over a single ring of broad,
compressed vertical columns in olive, ochre, and muted terracotta. Foliage uses
a small number of large leaf cushions rather than many small clustered leaves.

No island may use micro foliage, surface noise, bark or rock texture, scattered
tiny props, dense mixed flowers, scratches, cracks, painterly detail,
photorealism, sharp edges, excessive glow, black outlines, or external cast
shadows. All masters require genuine alpha transparency and transparent
corners.

Island-specific subjects:

- Seed Nursery: one greenhouse, one shelf, one seed bed, one watering can, a
  simple path, and a few oversized sprouts.
- Bloom Garden: one floral arch, three large flower groupings, a clear path,
  and two butterflies.
- Pond Sanctuary: one waterfall, one pond, three lily pads, two lotus blooms,
  and sparse boundary plants and stones.
- Orchard Grove: three fruit trees, three crates, one ladder, and a clear
  entrance path.
- Ancient Tree Grove: one spirit tree, three lanterns, one heart emblem, one
  spring, and three mushrooms.
- Wildgrowth Grove: three oversized mushrooms, one hollow log, four broad
  ground plants, and a simple entrance path.

The built-in image-generation workflow produced the reference-matched renders and
dedicated background-extraction passes produced the checked RGBA masters in
`max-level/`. `scripts/package-haven-nature-islands.py` normalizes their visible
silhouettes onto consistent bottom-anchored square canvases and writes the 1024,
512, and 256 WebP runtime tiers. `scripts/render-mossprout-nature-islands-qa.py`
renders the real world coordinates beside the layout guide and a 256 px
thumbnail contact sheet for final review.
