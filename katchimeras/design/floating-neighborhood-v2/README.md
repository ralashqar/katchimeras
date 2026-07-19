# Floating neighbourhood v2

This proof pivots the Kingdom toward complete, self-contained floating islands
with a uniform 14% axial gap. The previous connected-island proof remains
available for comparison and production defaults are unchanged.

For any new resident environment or home variant, use the canonical
[fresh-context environment pipeline](../../docs/floating-neighborhood-v2-environment-pipeline.md).
It fixes the allowed inputs, centralized prompt, FAL generation, BiRefNet
settings, promotion command, runtime integration, QA, and handoff format. This
file records art direction and approved examples; it does not replace that
runbook.

## Reference policy

- The checked-in Katchimeras style anchor is authoritative for shape language:
  broad forms, rounded clay-like materials, strong bevels, simple silhouettes,
  and low-frequency detail.
- Photo 2 supplies the floating-island concept, welcoming garden palette, and
  cottage-world mood; its micro-detail is deliberately not copied.
- Photo 1 informs only the seven-island QA composition and was not supplied to
  image generation.
- The simplified neutral v2 island is the geometry template for the home and
  future habitats. Old tile art is reviewed for project grammar but is not used
  as resident content or a generation template.

## Background and matting contract

- New v2 habitat generation uses FAL `fal-ai/nano-banana-2/edit` through the
  repository's `generate-asset` route. The v2 generation path does not call an
  OpenAI image model.
- Generate every source on a perfectly flat solid pure-black `#000000`
  background. Magenta/chroma backgrounds are prohibited because their color
  contaminates antialiased edges and produces visible purple fringes.
- The black background has no gradient, floor, external shadow, reflection,
  glow, haze, or texture.
- Transparency comes from the repository's BiRefNet Heavy
  `remove-image-background` pipeline on FAL, with foreground refinement
  enabled.
- BiRefNet supplies the exterior matte. Flood-fill neutral near-black pixels
  connected to the source canvas boundary to identify the true backdrop, then
  erode the enclosed foreground by three pixels. Inside that protected
  silhouette, restore source RGB at alpha `255`, including black/dark contact
  shadows, doorways, and ambient-occlusion seams. Leave BiRefNet's outer
  antialiased edge band unchanged.
- Preserve the original square canvas through packaging so shared face anchors
  do not shift. Matte caches are valid only when their recorded source SHA-256
  matches the current source.
- Inspect alpha edges against the dark Kingdom scene before packaging the
  1024/512/256 WebPs.
- The shared pipeline automatically pulls partial-alpha edge colour inward and
  applies a soft one-pixel contraction with a `0.45px` transition. It does not
  flood through connected dark pixels or travel deeper into the artwork.
- Resize canonical art and every runtime LOD in premultiplied-alpha space so
  transparent RGB cannot create a dark fringe during filtering.
- Keep the checked-in canonical `*-source.png` and `*-alpha.png` files as
  lossless masters. Runtime WebPs use quality 95 at 1024/512 and quality 90 at
  256; every LOD is resized directly from the canonical alpha rather than from
  another runtime LOD.

## Low-frequency art contract

- Every major feature must remain readable at the 256px LOD.
- Prefer large uninterrupted color areas and a small number of oversized forms.
- Use broad smooth bevels and soft ambient occlusion instead of surface texture.
- Hedge borders are continuous sculpted masses, not leaf-by-leaf topiary.
- Cliff bases use 8–12 large blocks with broad faces, not gravel or rock noise.
- Exclude tiny flowers, grass blades, pebbles, cracks, mineral specks, loose
  leaves, fairy lights, confetti, filigree, and dense prop clusters.
- A resident theme should be communicated by two or three material/color shifts
  and a few signature props rather than decoration spread over every surface.

## Resident surface-theme contract

Every resident may author three coordinated visual layers in its complete tile
bitmap: habitat props, the perimeter hedge/topiary, and the deep cliff material.
Camera, square canvas, flat-top face bounds, full island silhouette, cliff
depth, front direction, padding, and runtime creature stage remain invariant.
This allows real material and planting changes rather than a runtime tint while
keeping every themed island aligned to the same neighbourhood grid.

## Resident stage-layout contract

- The bottom/front half of every resident island is an open, visually quiet
  live-character stage made from uninterrupted grass.
- Resident and neutral islands must not contain a center circle, plaza, paving,
  pedestal, ring, indentation, or other character platform.
- The front stairs, bottom half, and route into the live-character stage remain
  unobstructed.
- Buildings and signature props may form a richer U-shaped composition across
  the rear and upper portions of both side edges. Side framing may extend toward
  the midpoint but must not enter the bottom half.
- Use several large readable features rather than a single sparse rear cluster,
  while retaining the low-frequency art contract.
- The home tile is the deliberate exception: its empty nest occupies the center
  circular plaza because the separately rendered live egg is anchored there.

## Neutral foundation prompt

Create one empty flat-top floating garden island using the approved v2 camera
and Katchimeras toy-diorama style. Use a smooth uninterrupted grass top, one
continuous chunky hedge, four oversized flower accents, front stairs, and a
deep underside made from 8–12 large beveled rocks. Do not add a central circle,
plaza, paving, pedestal, ring, or indentation. Keep all detail low-frequency
and readable at 256px. Center the complete silhouette with generous padding on
a flat pure-black `#000000` BiRefNet matte. Exclude structures, nests, eggs, creatures, bridges,
clouds, shadows, texture noise, text, and watermarks.

## Cottage home prompt

Preserve the simplified neutral foundation exactly. Add one compact cottage
made from a few large masses: a broad cobalt roof with 5–7 oversized shingle
bands, cream walls, one arched door, three large windows, two chunky evergreens,
two lanterns, and an empty nest on the plaza. Exclude miniature masonry, tiny
landscaping, baked eggs, creatures, bridges, clouds, shadows, text, and
watermarks.

## Home archetype variants

The six persisted home archetypes each use a dedicated v2 island while sharing
the exact camera, face bounds, front stairs, central circular plaza, empty nest,
and live-egg anchor:

- Explorer: sage-roof timber lookout, telescope, map table, travel cases, pine
  forms, compass border emblems, and slate/sandstone/timber cliff blocks.
- Creator: rose-and-violet studio, blank easel, worktable, sculpture, palette,
  paint pots, sparkle emblems, and cream/plum/blush cliff blocks.
- Builder: muted-blue workshop, drafting bench, tool rack, timber and stone,
  gear and crate forms, bolt emblems, and slate/sandstone/honey cliff blocks.
- Nurturer: sage cottage, garden beds, armchair, watering can, oversized plants,
  leaf emblems, and cream/olive/terracotta cliff blocks.
- Connector: coral clubhouse, gathering table and chairs, blank message board,
  ribbon posts, linked-loop emblems, and cream/coral/gold cliff blocks.
- Dreamer: indigo observatory, telescope, reading bench, moon lamp, cloud and
  star forms, star emblems, and slate/violet/cream cliff blocks.

`floating-home-v2` generation receives the generic home island as its sole
image reference. Every variant preserves the empty nest for the separately
rendered live egg and excludes baked eggs and creatures.

## Example resident habitats

Tasklet uses one compact navy-roof workshop, a broad planning bench, blank task
board, toolbox, rolled plans, and two lanterns in the rear-and-upper-side frame.
Its continuous blue-green hedge and large slate/sandstone cliff blocks carry the
theme without texture noise.

Feastle uses one compact terracotta-roof oven, a broad rear serving counter,
soup pot, bread basket, fruit bowl, picnic bench, drink trolley, herb pots, and
two broad lanterns in a rear-and-upper-side frame. Its sage border, oversized
leaf emblems, and large biscuit/terracotta cliff blocks carry the theme. The
entire bottom/front half and stairs remain uninterrupted grass for the live
creature sprite. The generation received no legacy Feastle or resident-tile
art.

Cheerlet uses one broad wavy teal pavilion, one small cake, two chunky gift
blocks, two three-balloon bunches, two lanterns, and oversized coral flowers.
Its smooth teal hedge and large alternating cream, coral, and muted-teal cliff
blocks carry the celebration identity. Props form a rear-and-upper-side frame,
leaving the unpaved bottom/front stage empty. There are no garlands, fairy
lights, confetti, mineral specks, or leaf-by-leaf textures.

Skylo uses one compact rounded art-deco city pavilion, a tall central tower,
two large street lanterns, one bench, one street tree, and a blank transit
shelter in the rear-and-upper-side frame. Its smooth slate-blue parapet with
four gold light accents and alternating blue-gray/sandstone cliff blocks carry
the city identity without roads, traffic, signs, or tiny window grids.

Pagelet uses one broad cream library pavilion with a curved burgundy roof,
integrated shelves, a rear lectern with one open book, a chunky reading chair,
book cart, and two broad reading lamps. Its smooth segmented burgundy border,
oversized gold book emblems, and alternating cream, burgundy, and walnut cliff
blocks carry the reading identity without leaf texture, loose pages, or book
clutter.

Steppling uses a compact hiking lodge, blank trail-map board, rest bench, water
station, gear rack, waypoint posts, pine forms, stepping stones, and lanterns
in a fuller rear-and-side U-shaped composition. Its smooth sky-blue border with
four oversized orange footprint emblems and alternating slate-blue/sandstone
cliff blocks carry the walking identity while leaving the bottom-half floor and
front approach empty.

Mossprout uses one broad leafy alcove, three moss boulders, a small rear pond,
a chunky stump bench, a watering-stone ornament, oversized fern forms, and two
lanterns. Its smooth deep-green border with four pale leaf emblems and large
olive/umber/cream cliff blocks carry the garden identity without leaf-by-leaf
texture or foreground clutter.

Flickerbun uses a broad blank cinema screen, simple curtains, one chunky
projector, paired velvet seats, popcorn forms, lanterns, and rounded moonflower
shrubs in a rear-and-side U-shaped composition. Its navy/burgundy border, gold
reel emblems, and plum/navy/sandstone cliff blocks carry the cinema identity
without tiny bulbs, film perforations, or a baked screen image.

Relicoon uses one compact museum pavilion, blank map cabinet, two simplified
display cases, large vase and fossil-shell plinths, an expedition chest, rolled
maps, lanterns, and topiary in a rear-and-side U-shaped composition. Its teal
border and terracotta/teal-gray/cream cliff blocks carry the archive identity
without labels or archaeological clutter.

Bedrotte uses one pillow-canopy sleep nook, a blanket chest, broad lanterns,
one chunky armchair, pillow forms, and a moon lamp in a calm rear-and-side
frame. Its continuous indigo/lavender upholstered border and large dusk-slate,
cream, and plum cliff blocks carry the restorative evening identity without
stitching or fabric noise.

Gatherglow uses one open-front shared-hearth pavilion, a rear supper table,
chunky stools, a conversation bench, tea trolley, ember planters, and broad
lanterns. Its continuous terracotta wall, linked-loop emblems, and large
biscuit/terracotta/honey cliff blocks carry the convivial identity while the
entire bottom/front stage remains clear.

## Packaging and QA

Use the canonical pipeline linked at the top of this file. It replaces the old
per-asset command list with prompt dry-run provenance and the single
`promote-floating-neighborhood-v2-tile.py` command. Render all comparison
compositions with `python scripts/render-floating-neighborhood-v2-qa.py`.

`qa-seven-island-neighborhood.png` uses the production face-alignment math,
v2 spacing, painter order, and live egg scale.
`qa-tasklet-feastle-neighborhood.png` adds both resident habitats and their live
creature sprites at production scale and anchor positions.
`qa-cheerlet-surface-theme.png` shows the simplified home, neutral, Cheerlet,
Tasklet, and Feastle treatments with live creatures to verify that every
resident stage remains clear at production scale.
`qa-five-resident-themes.png` adds Skylo and Pagelet, leaving one neutral island
for direct comparison across all five themed resident treatments.
`qa-steppling-mossprout-neighborhood.png` verifies the two FAL-generated
walking and garden habitats with their live creature sprites at production
scale.
`qa-skylo-mossprout-tasklet-refresh.png` verifies the refreshed city, garden,
and focus-workshop habitats together with their live creatures, shared face
alignment, 14% neighbourhood gaps, and clear front-stage anchors.
`qa-pagelet-cheerlet-feastle-refresh.png` verifies the refreshed reading,
celebration, and cooking habitats together with their live creatures, shared
face alignment, 14% neighbourhood gaps, and clear front-stage anchors.
`qa-flickerbun-relicoon-neighborhood.png` verifies the cinema and museum
habitats with their live creature sprites at production scale.
`qa-bedrotte-gatherglow-neighborhood.png` verifies the restorative sleep and
shared-hearth habitats with their live creature sprites at production scale.
`qa-six-home-archetypes.png` verifies all six persisted home identities with
the live egg at the shared production anchor and scale.
