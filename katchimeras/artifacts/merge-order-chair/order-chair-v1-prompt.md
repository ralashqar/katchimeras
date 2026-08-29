# Merge order chair v1

Built-in image generation edit using the supplied leafy armchair as the edit
target. The edit replaced only the blue studio background and floor with flat
`#ff00ff`, preserving the honey-wood frame, green leaf upholstery, flowers,
front-facing composition, and cozy low-detail toy-diorama materials.

The chroma source is converted to `order-chair-v1-alpha.png` with the installed
imagegen `remove_chroma_key.py` helper using border auto-key, soft matte, and
despill. `scripts/package-merge-order-chair.py` trims and packages the approved
alpha into the 256px runtime WebP.
