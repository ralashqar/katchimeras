# Tile Pipeline — any tile render → canonical Kingdom base asset

One command turns a tile image (an upload, a generation, a mockup) into a
bundled, seam-perfect Kingdom base tile:

```bash
python scripts/tile-pipeline.py \
  --source path/to/tile.png \
  --key base_garden_nest \
  --desc "a velvet grass lawn with tiny flowers, a round paved plaza holding a woven wicker nest, and a rounded cobblestone side wall"
```

## The canonical diamond (why tiles always align)

Every base tile is normalised so its **top face** sits on the same diamond in
a 2048×2048 canvas:

| corner | px |
|---|---|
| T | (1024, 201) |
| R | (1959, 949) |
| B | (1024, 1697) |
| L | (89, 949) |

Half-width **935**, slope **0.8**. Neighbor offsets are derived, not tuned:
`w = 935/2048 = 0.4565`, `h = 748/2048 = 0.3652` (`data/world-tile-layout.json`).
Because every tile's face lives at identical canvas coordinates, pure
translation by those offsets makes any tile tessellate with any other.

We align the **face**, never the image bounds — bounds vary per art (walls,
skirts, posts), so bounds-fitting guarantees misalignment (the bottom-most
pixel is the wall bottom, not the face corner).

## Pipeline steps

0. **Hi-res re-render** — gpt image edit reproduces the source at 2048
   ("recreate EXACTLY … do not add, remove, move or restyle"); the `--desc`
   line names the materials so the model keeps them. Background color is
   auto-detected from the source corners. Skip with `--skip-rerender` when
   the source is already 2K-crisp.
1. **BiRefNet heavy matte** — transparency comes from BiRefNet ONLY
   (`BiRefNet_lite`, transported to FAL HTTP as its required mapped value
   `General Use (Heavy)`, @1024 + refineForeground).
   No chroma floods, no
   erosion, no alpha edits of any kind (hard rule; every hand-rolled alpha
   trick we tried caused user-visible artifacts).
2. **Initial quad fit** — upper edges from the silhouette; L/R x from the
   wall-band medians; B from the wall-bottom lines shifted up by the
   measured wall height (self-cancelling, so skirt/erosion bias drops out).
3. **Corrective passes** (default 4, `--passes`) — measure the PAINTED edges
   in canvas space (upper = silhouette, lower = the border→wall luminance
   crease) and re-warp until corners sit on the canonical diamond; exits
   early under 2px; rejects degenerate measurements over 300px. Typical
   convergence: 30–50px → **<2px**.
4. **Clip gate** — zero opaque pixels on all four canvas borders, or the
   script aborts without bundling. Nothing is ever cut off; if a tile can't
   fit at canonical scale (oversized skirt), that's a conversation, not a
   crop.
5. **Bundle + QA** — webp q82 to `assets/images/katchimeras/world/base/<key>.webp`
   plus `qa-solo.png`, `qa-seams.png` (both seam midpoints, game draw order)
   and `qa-tessellation.png` in the work dir (printed at the end).

## Wiring checklist (3 places, same key)

1. `utils/world-visuals.ts` → `WORLD_BASE_SOURCES`: `key: require('../assets/…/base/<key>.webp')`
2. `constants/world-asset-catalog.ts` → base section entry (name + provenance line)
3. `app/dev-tile-lab.tsx` → `BASE_IDS` list

Then reload the dev client; select it live from the Asset Lab detail page
("Use as Kingdom base") or cycle it in the Tile Layout Lab.

## Generating brand-new tile art (canonical-base-first)

Prefer starting from the procedural templates rather than free renders — the
model keeps the geometry it's given:

- `assets/…/world/design/proc-tile-green.png` — plain face + 44px extrusion
- `assets/…/world/design/proc-tile-roads.png` — + crossing lanes to edge midpoints
- `assets/…/world/design/proc-tile-crossroad.png` — + border band + plaza
- style ref: `assets/…/world/design/style-anchor.png` (baristabbit + brick tile
  + approved props — never use generated props as style refs, drift compounds)

Generate with template as image 1, style anchor as image 2, a materials
prompt plus the CRITICAL GEOMETRY RULE block (see scratchpad
`styled-from-template.py`), then run this pipeline with `--skip-rerender`.

## QA rules of thumb

- Always eyeball **qa-solo** (holes/artifacts only show there) and both
  **qa-seams** crops (thumbnail tessellations hide wedges).
- Corner errors that bounce between passes (±30px flips) mean the crease
  detector is latching different features — check the solo tile for damage
  first; healthy art converges monotonically.
- Layout Lab shows a seam gap for a tile that QA'd clean? Check the lab's
  offsets first (⚠ tuned chip / reset) — the art is rarely the problem after
  this pipeline.
