# Mossprout individual interpolation v1

Mode: Codex built-in image generation, one square image per level.

All generations requested a flat `#FF00FF` backdrop. Final alpha images use
the repository's BiRefNet matte because the generated magenta fields contained
subtle lighting variation that made simple chroma-key alpha too soft.

## Generation hierarchy

1. Level 1 was generated independently from the canonical neutral island and
   original Mossprout environment references.
2. Level 5 was generated independently from the same canonical references.
3. Level 3 was generated from the completed Level 1 and Level 5 images.
4. Level 2 was generated from the completed Level 1 and Level 3 images.
5. Level 4 was generated from the completed Level 3 and Level 5 images.

## Shared prompt constraints

- One complete square floating hex tile, never a grid or contact sheet.
- Preserve the established isometric camera, island shell, perimeter wall,
  deep underside, centred front stairs, scale, crop and rounded toy-diorama
  material language.
- Keep one small circular Mossprout standing patch in the lower third,
  horizontally centred immediately above the stairs, connected by at most one
  broad stepping stone.
- Use chunky rounded forms, broad bevels, matte clay-like materials,
  low-frequency detail, soft diffuse lighting and readable silhouettes.
- No creature, egg, text, labels, watermark, central platform, long central
  path, realistic texture, micro-detail or cropped island.

## Level prompts

### Level 1 — neglected clearing

Generate a genuinely bare early state: 60–70% broad warm earth patches, thin
broken dull moss, one tiny two-leaf sprout at rear-centre, exactly two plain
rocks, one old watering can and at most one tiny flower cluster. No tree,
bench, pond, lantern, mushrooms or garden bed.

### Level 5 — enchanted grove

Generate the definitive restored state: full healthy moss, a large ancient
magical tree at rear-centre with broad roots, cloud-like canopy and glowing
hollow, a luminous rear-right pond with a small waterfall, rear-left log
bench, grouped lush fern masses, large flower clusters, mossy rocks, two
lanterns, mushrooms and restrained glowing plants.

### Level 3 — midpoint between Levels 1 and 5

Generate approximately 50% of the endpoint transformation: mostly recovered
moss with 20–25% broad earth patches, one modest young rounded tree without a
hollow or glow, a small plain rear-right pond without waterfall, rear-left
bench, two fern clumps, one flower bed, rocks, a mushroom pair and the watering
can. Keep the centre calm.

### Level 2 — midpoint between Levels 1 and 3

Generate an early recovery state: 40–45% exposed earth, larger moss patches,
the sprout becoming a small sapling without canopy, one small flower bed, one
unfinished log seat, the early rocks and watering can, one fern clump and only
a dark damp hint where the future pond will form.

### Level 4 — midpoint between Levels 3 and 5

Generate a flourishing but not final state: nearly complete moss, a substantial
mature rounded tree without a doorway, a larger bright pond without waterfall,
the bench, grouped ferns, flower clusters, rocks, mushrooms, exactly one
lantern and only a few glowing buds. Reserve the hollow, waterfall, second
lantern and full magical abundance for Level 5.
