# Egg Snap toy blocks

Regenerate from the repository root with `python apps/egg-snap/scripts/generate-toy-blocks.py` (Pillow required).
The checked-in PNGs are runtime assets; Python is not a build or device dependency.

Keep the material clean: broad upper-left light, shallow bevel, satin face, no grain or surface noise.
Colour identities are lavender/star, honey/sun, sky/drop, berry/heart and mint/leaf, in engine colour order.
Symbols describe colour, not shape or combat power. Clear mode increases symbol and socket contrast.

Each atlas contains 128px squares in six columns: full cell, pulse ring, shard, glyph, socket, miniature socket.
Rows follow `BLOCK_COLOR_IDS`. Column zero is byte-identical to the individual tray PNGs.
Tray and drag use images; placed cells and projectiles sample the same artwork through Skia.
Both atlases load before combat, so changing readability does not remount or reset a duel.

Review actual display sizes, valid/partial previews and both environments in **Mechanics arena → Piece appearance workshop**.
Keep cell geometry, aiming transforms, projectile timing and the direct shared-Picture renderer independent of artwork changes.
