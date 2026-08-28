# Mossprout square Haven v1

The player-facing Haven now uses two equal square zones on one pannable world:
Mossprout's environment at `(0, 0)` and the persistent garden at `(0, 1)`.
Their transparent source frames overlap by ten percent of one zone width,
leaving a small visible gap between the actual painted silhouettes. The initial
and recentered camera fits both zones; selecting Mossprout or a garden cell
focuses that zone.

The two canonical 1024px PNG files are transparent lossless masters regenerated
from the square compositions with the older Mossprout hex tiles as the strict
style authority: cozy toy-diorama forms, large geometry, soft bevels, restrained
props, and low texture detail. Their `*-chroma-v3-toy.png` siblings preserve the
flat magenta imagegen output used for background extraction, while the
`*-alpha-v3-toy.png` siblings preserve the reviewed alpha result. Runtime packages
full, 512px, and 256px alpha WebP tiers under
`assets/images/katchimeras/world/square/`.

Both dioramas have fully transparent corners and isolated silhouettes; the
shared Haven atmosphere is rendered by the world canvas rather than baked into
either zone. The garden generation produced a strict 42-cell grid as seven columns by six
rows. The existing Haven sandbox's 42 stable logical cell IDs are mapped in
their existing order, so stored occupants and progression require no reset or
migration. The painted source bounds are owned by
`utils/haven-square-world.ts`; interaction geometry must remain derived from
those bounds rather than hand-positioned in the component. The live board's
average cell aspect ratio is also derived from those measured 7x6 bounds, so
items, hit targets, merge effects, and FTUE anchors fill the painted grid rather
than inheriting the narrower legacy-board proportions.

The main environment intentionally has no baked character or egg. Mossprout,
the player's egg, status markers, FTUE layers, merge sprites, and upgrade
effects remain live runtime layers. Haven stages 0-4 intentionally share this
single environment art state in v1.

The previous hex renderer and its in-progress tall-board art remain available
to developer surfaces and have not been deleted.
