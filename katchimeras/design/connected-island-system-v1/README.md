# Connected island art system v1

This folder establishes the first reusable connection kit for the square Haven.
The approved Mossprout island is the authority for camera elevation, lighting,
palette, material response, shape scale, bevel softness, and texture density.

## Composition contract

Render components back-to-front in this order:

1. straight bridges;
2. circular connectors;
3. destination and source islands;
4. characters, effects, and UI.

When two islands connect directly along one horizontal or vertical axis, render
only the straight bridge beneath both islands. Do not insert a circular
connector. Reserve connectors for turns, branches, junctions, or intentional
intermediate stops.

Bridge ends deliberately continue beneath adjoining land pieces. Connectors and
large islands cover those overlap tails, so adjacent assets do not need to share
pixel-identical edges. This also lets the same bridge serve multiple island
silhouettes.

The v1 connector is a neutral two-port unit. Its north and south sockets sit on
the vertical centerline. The vertical bridge uses those sockets directly. The
horizontal bridge is the matching east-west building block; a later horizontal,
three-way, or four-way connector variant should expose the appropriate sockets
without changing the connector's outer diameter or center medallion.

## Scale and placement

- Treat a full companion island as `1.0` visual width.
- Render a circular connector at approximately `0.34-0.36` of that width.
- Render bridge deck width at approximately `0.08-0.10` of island width.
- Place bridge endpoints beneath land silhouettes by at least one end-post depth.
- Snap ports by their centerline, not by transparent image-frame edges.
- Do not rotate a bridge bitmap to make another direction. Each direction keeps
  its own upper-left lighting and camera-correct render.

## Files

- `connector-circle-alpha-v1.png`: preferred transparent two-port connector.
- `connector-circle-alpha-v2.png`: broader alternate connector exploration.
- `bridge-straight-vertical-alpha-v1.png`: north-south bridge.
- `bridge-straight-horizontal-alpha-v1.png`: east-west bridge.
- `bridge-straight-horizontal-alpha-v2-perspective.png`: superseded rigid
  east-west bridge exploration.
- `bridge-suspension-horizontal-alpha-v3.png`: selected east-west suspension
  bridge with a shallow curved plank deck, chunky posts, and softly sagging rope
  rails in the established cozy toy-diorama style.
- `egg-home-island-alpha-v1.png`: new rounded Egg Home generated from the
  approved Mossprout island and polished Baristabbit, Encora, and Relicoon hex
  tiles; no legacy Egg Home art was used.
- `*-chroma-*.png`: original flat-key generation sources.
- `component-kit-preview-v1.jpg`: isolated kit comparison.
- `connected-system-assembly-preview-v1.jpg`: draw-order and overlap proof using
  the approved Mossprout island.
- `mossprout-to-egg-home-direct-bridge-layout-v2.jpg`: superseded rigid-bridge
  connection proof.
- `mossprout-to-egg-home-suspension-layout-v3.jpg`: selected direct east-west
  connection proof with the islands 120 world units apart. The suspension
  bridge renders first and both island silhouettes cover its endpoint posts; no
  connector is used.

Egg Home and the v3 suspension bridge are now live runtime layers in the
square Haven. Their full, medium, and thumbnail alpha WebP tiers live under
`assets/images/katchimeras/world/square/`. Runtime geometry preserves the draw
order above rather than flattening the connected map into one image.
