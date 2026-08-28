# Mossprout square Haven v1

The player-facing Haven now uses two equal square zones on one pannable world:
Mossprout's environment at `(0, 0)` and the persistent garden at `(0, 1)`.
Their transparent source frames overlap by 52 world units, matching the centered
alpha margins with a small antialiasing allowance so the two centered stair
connections visually meet. The initial
and recentered camera fits both zones; selecting Mossprout or a garden cell
focuses that zone.

The two canonical 1024px PNG files are transparent lossless masters regenerated
from the square compositions with the established Haven hex tiles as the strict
style authority: cozy toy-diorama forms, large geometry, broad soft bevels,
restrained props, and low texture detail. The approved v5 main environment uses
Baristabbit, Encora, and Relicoon's production tiles as direct shape-scale and
material references while retaining Mossprout's rounded footprint, deep cliff,
pond, cottage, plaza, and centered connection stair. The live garden is the
approved tall v6 regeneration, using the same chunky hex-tile shape language,
soft bevels, vivid palette, and low-detail materials. Its playfield is orthographic in
screen space: its sides and ends are
parallel, its border width is constant, and only the exterior cliff retains
depth. The versioned `*-chroma-*.png` files preserve the flat magenta imagegen
outputs used for background extraction, while their `*-alpha-*.png` siblings
preserve the reviewed alpha results. Runtime packages
full, 512px, and 256px alpha WebP tiers under
`assets/images/katchimeras/world/square/`.

Both dioramas have fully transparent corners and isolated silhouettes; the
shared Haven atmosphere is rendered by the world canvas rather than baked into
either zone. The garden art deliberately contains no painted grid, seams, or
cells: it is one continuous turf playfield. The live board presents the 42
stable cells as six columns by seven rows and overlays the same sand-cell grid
used by the dedicated merge page at 34% opacity. Existing logical cell IDs are mapped in
their existing order, so stored occupants and progression require no reset or
migration. The painted source bounds are owned by
`utils/haven-square-world.ts`; interaction geometry must remain derived from
those bounds rather than hand-positioned in the component. The live board's
average cell aspect ratio is also derived from those measured 6x7 bounds, so
items, hit targets, merge effects, and FTUE anchors fill the clear turf panel.
The board uses fractional cell dimensions to fill those bounds exactly; its
gesture blocks the parent camera across cells, gutters, and edge padding.

The main environment intentionally has no baked character or egg. Mossprout,
the player's egg, status markers, FTUE layers, merge sprites, and upgrade
effects remain live runtime layers. Haven stages 0-4 intentionally share this
single environment art state in v1.

The previous hex renderer and its in-progress tall-board art remain available
to developer surfaces and have not been deleted.
