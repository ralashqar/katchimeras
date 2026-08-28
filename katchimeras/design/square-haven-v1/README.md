# Mossprout square Haven v1

The player-facing Haven now uses four equal square zones on one pannable world:
Baristabbit's café at `(0, 0)`, Mossprout's environment at `(1, 0)`, Egg Home
at `(2, 0)`, and the persistent merge island at `(1, 1)`. The merge island sits directly below Mossprout while
remaining a separate floating neighbor with no stair or bridge connection. Its
source frame is raised by 150 world units so the merge island tucks visibly
under Mossprout's lower edge. The square-world camera fits the complete cluster
in its initial and recentered views.

Baristabbit is connected directly west-east to Mossprout, and Egg Home is
connected directly east-west to Mossprout, by the same camera-correct shallow-sag
suspension bridge from `design/connected-island-system-v1/`. No
circular connector is used for this aligned connection. The bridge renders
before both islands, its endpoint posts remain hidden beneath their silhouettes,
and its visible curved plank deck and rope rails sit in the upper-middle portion
of the island sides. Horizontal zones use a 720-unit pitch, leaving a tighter
120-unit opening between their source frames.

Baristabbit's island uses the Mossprout main island as its strict structural
base: the same rounded-square silhouette, front-isometric camera, deep cliff,
and visual scale. Its restrained café dressing comes from the live Baristabbit
hex tile: a cream-and-terracotta kiosk, broad canopy, chunky counter, small
round furniture, and amber lanterns. The central circular patio remains open
for the separately rendered resident, and no character is baked into the art.

The canonical 1024px PNG files are transparent lossless masters regenerated
from the square compositions with the established Haven hex tiles as the strict
style authority: cozy toy-diorama forms, large geometry, broad soft bevels,
restrained props, and low texture detail. The approved v5 main environment uses
Baristabbit, Encora, and Relicoon's production tiles as direct shape-scale and
material references while retaining Mossprout's rounded footprint, deep cliff,
pond, cottage, plaza, and centered connection stair. The live merge island is
the approved compact v2 regeneration: a broad rounded turf island with a small
leafy door structure along its rear rim, sparse edge decoration, and an
irregular layered floating-rock underside matching the main environment. Its
center remains an uninterrupted orthographic playfield; only the exterior cliff
retains depth. The versioned `*-chroma-*.png` files preserve the flat magenta
image-generation outputs used for background extraction, while their
`*-alpha-*.png` siblings preserve the reviewed alpha results. Runtime packages
full, 512px, and 256px alpha WebP tiers under
`assets/images/katchimeras/world/square/`.

All three islands have fully transparent corners and isolated silhouettes; the
shared Haven atmosphere is rendered by the world canvas rather than baked into
any zone. The garden art deliberately contains no painted grid, seams, or
cells: it is one continuous turf playfield. The live board presents the 42
stable cells as seven columns by six rows and overlays the same sand-cell grid
used by the dedicated merge page at 34% opacity. Existing logical cell IDs are mapped in
their existing order, so stored occupants and progression require no reset or
migration. The painted source bounds are owned by
`utils/haven-square-world.ts`; interaction geometry must remain derived from
those bounds rather than hand-positioned in the component. The live board's
average cell aspect ratio is also derived from those measured 7x6 bounds, so
items, hit targets, merge effects, and FTUE anchors fill the clear turf panel.
The board uses fractional cell dimensions to fill those bounds exactly; its
gesture blocks the parent camera across cells, gutters, and edge padding. Cell
taps only select or operate merge content and never move the world camera.

The main environment intentionally has no baked character or egg. Mossprout,
the player's egg, status markers, FTUE layers, merge sprites, and upgrade
effects remain live runtime layers. Haven stages 0-4 intentionally share this
single environment art state in v1.

The previous hex renderer and the earlier tall-board art remain available
to developer surfaces and have not been deleted.
