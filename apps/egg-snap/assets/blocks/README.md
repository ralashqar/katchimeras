# Egg Snap imagegen toy blocks — v3

Regenerate from the repository root with `python apps/egg-snap/scripts/generate-toy-blocks.py` (Pillow required).
The checked-in PNGs are runtime assets; Python is not a build or device dependency.

The five high-resolution masters in `sources/` were made with built-in imagegen. Exact prompts are in `sources/prompts.json`; honey/sun is the visual master used to reference the other four variants.
The packer consumes these masters; it never generates or repaints the tile material. For regeneration, generate a new master and reference it for each variant before replacing the corresponding source PNGs.

Keep the material clean: restrained upper-edge light, shallow bevel, smooth cushiony face, simple shallow embossed symbols with flat fills, no glossy raised relief or surface noise.
Colour identities are lavender/star, honey/sun, sky/drop, berry/heart and spring green/leaf, in engine colour order.
Symbols describe colour, not shape or combat power. Clear mode increases symbol and socket contrast.

Each atlas contains 128px squares in six columns: full cell, pulse ring, shard, glyph, socket, miniature socket.
Rows follow `BLOCK_COLOR_IDS`. Column zero is byte-identical to the individual tray PNGs.
Tray and drag use images; placed cells and projectiles sample the same artwork through Skia.
Sources are normalized to a 126px square inside a 128px transparent canvas. The one-pixel alpha gutter plus Egg Snap's one-point grid gap makes tight seams in tray, held pieces, and targets. Some generated sources have a drawn neutral checkerboard; the packer extracts the connected chromatic silhouette, fills enclosed highlights and removes the outside background. Inspect every output against both dark and light backgrounds after replacing a source. Clear mode uses the same art with increased contrast.
Both atlases load before combat, so changing readability does not remount or reset a duel.

Review actual display sizes, valid/partial previews and both environments in **Mechanics arena → Piece appearance workshop**.
Keep cell geometry, aiming transforms, projectile timing and the direct shared-Picture renderer independent of artwork changes.
