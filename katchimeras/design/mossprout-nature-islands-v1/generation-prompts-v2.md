# Mossprout satellite-island generation prompts — v2

The built-in image-generation workflow generated one independent Level 4 master
for each satellite. `references/island-render-guide.jpg` is the subject and
composition authority; `style-reference-board.png` is secondary authority for
the production camera, soft-toy materials, cliff construction, and lighting.

All prompts share this production contract:

- isolated floating-island sprite with genuine alpha transparency;
- front three-quarter orthographic isometric camera and bottom-center entrance;
- cozy 3D toy diorama with broad soft bevels and cushiony molded-clay forms;
- smooth matte-to-satin surfaces, low texture detail, and large readable shapes;
- warm upper-left light and restrained ambient occlusion;
- no characters, text, external shadow, sky, floor, micro-foliage, surface noise,
  scattered tiny props, cracks, sharp edges, or merge-board elements.

Island-specific requests:

- **Seed Nursery:** upper-left reference island; one rounded greenhouse with one
  seed bed, one planter shelf, one blue watering can, and a simple entrance path.
- **Bloom Garden:** upper-right reference island; one flower arch, one lantern,
  three separated flower groupings, one path, and two butterflies.
- **Pond Sanctuary:** middle-left reference island; one rear-left waterfall, one
  dominant pond, three lily pads, two lotus blooms, and sparse boundary plants.
- **Orchard Grove:** middle-right reference island; three fruit trees, one ladder,
  three harvest crates, and one uncluttered entrance path.
- **Ancient Tree Grove:** lower-left reference island; one spirit tree, three
  lanterns, one heart emblem, one front spring, three mushrooms, and one path.
- **Wildgrowth Grove:** lower-right reference island; three oversized mushrooms,
  one front-facing hollow log, four broad ground plants, and one short path.

Any generated checkerboard background is removed with a dedicated
background-extraction edit that preserves the island unchanged and outputs real
alpha. Approved outputs replace the canonical `max-level/*-l4-master.png` files.
