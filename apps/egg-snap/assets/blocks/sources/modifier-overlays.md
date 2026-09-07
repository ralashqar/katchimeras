# Transparent modifier overlays

Generated with built-in imagegen on 2026-09-07. Original RGBA sources: `shield-overlay.png`, `bomb-overlay.png`. These replace opaque modifier plates in Egg Snap; ordinary ghost art remains underneath.

Direction: one front-facing square cell overlay, transparent open areas, cozy soft-bevel toy 3D, no text or numbers baked into art. Cyan glass rounded-square frame and shield with an empty central number recess; red glass rounded-square frame and charcoal toy bomb with a warm fuse. No scene, grid, opaque square backdrop, or mockup labels.

Runtime packing: resize each RGBA source to 126×126 with Lanczos; composite at (1,1) into a transparent 128×128 canvas, preserving alpha. No extra layout inset. Runtime strength and rigged/safe labels remain live text. Bomb art is preloaded by the theme before the battle mounts.
