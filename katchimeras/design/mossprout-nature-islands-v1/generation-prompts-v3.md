# Mossprout satellite-island generation prompts — v3 style lock

The built-in image-generation workflow generated one independent Level 4 master
for each satellite. The references have deliberately separate responsibilities:

- `../square-haven-v1/mossprout-main-environment-alpha-v5-hex-style.png` is the
  binding authority for form language, camera, materials, lighting, palette,
  foliage construction, and cliff construction.
- `references/island-render-guide.jpg` supplies only the six subjects and their
  broad compositions.

Every generation prompt repeats this strict production contract:

- match the main Mossprout island's three-quarter orthographic camera and scale;
- broad, softly inflated cushion forms with wide pillowy bevels;
- smooth matte clay/foam surfaces with almost no texture or micro-detail;
- foliage built from a small number of large oval leaves, never bead clusters;
- thick rounded-rectangle paths and simple orange-ochre wooden blocks;
- one compact grass cushion over a single perimeter ring of large vertical
  rounded cliff columns in olive, ochre, and muted terracotta;
- no layered rock strata, cracks, pebbles, tiny foliage, sharp chamfers, glossy
  plastic, realistic texture, dramatic highlights, characters, text, or UI;
- genuine alpha transparency, centered square cutout, and entrance at the front.

Island subjects:

- **Seed Nursery:** one rounded greenhouse, one seed bed, one chunky shelf, one
  oversized watering can, and a short entrance path.
- **Bloom Garden:** one broad flower arch, one chunky lantern, three padded
  flower groupings, and a short entrance path.
- **Pond Sanctuary:** one block-built waterfall, one graphic pond, three large
  lily pads, two padded lotus flowers, and sparse broad boundary leaves.
- **Orchard Grove:** three compact fruit trees, one ladder, three chunky crates,
  sparse oversized fruit, and a short entrance path.
- **Ancient Tree Grove:** one broad spirit tree, three lanterns, one heart emblem,
  one small spring, three oversized mushrooms, and a short entrance path.
- **Wildgrowth Grove:** three oversized padded mushrooms, one chunky hollow log,
  four broad leaf groups, and a short entrance path.

Where generation returned a visible checkerboard, a dedicated
background-extraction edit removed only that background and preserved the island
artwork. The approved RGBA outputs replace the canonical
`max-level/*-l4-master.png` files.
