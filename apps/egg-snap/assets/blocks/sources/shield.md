# Shield cell

Generated with built-in imagegen on 2026-09-07, using `../coolant.png` as the silhouette/style reference. Original output retained as `shield.png` in this directory.

Prompt: Create one production game sprite: a shielded variant of the reference tile. Preserve its straight-on square silhouette, rounded corners, cushiony bevel, proportions and edge-to-edge coverage. Rich teal enamel with a narrow warm pale gold armour rim and a softly embossed shield outline. Keep the center empty for the live number. No text, numbers, water drop, gems, rivets, sparkles or detached shadows. Cozy 3D toy style, simple readable surfaces, no texture grain. Opaque tile on transparent alpha; square tile silhouette, not shield-shaped.

Runtime asset: resize original RGBA to 126×126 with Lanczos and composite at (1,1) in a transparent 128×128 canvas, preserving alpha. This matches regular tile sprites. Render over the full cell bounds with no additional layout inset; render the live strength number separately.
