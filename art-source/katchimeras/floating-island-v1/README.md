# Connected floating-island v1

Production sources for the first Kingdom floating-island art-direction proof.
The art was generated with the built-in image-generation tool, using the user
reference for style/materials and
`design/hex-tile-clean-flat-regular-projected-widthfit-1024.png` for geometry.

## Empty foundation prompt

Create one empty modular floating-island hex tile. Use the supplied floating
garden as the style, material, lighting, and cliff-depth reference only, and
the canonical guide for the exact regular flat-top projected hex orientation,
camera tilt, six corners, centered framing, and padding. Render open lush grass
with subtle texture and sparse tiny inset flowers; add a deep tapered underside
of rounded warm tan rock with restrained vines. Premium cozy 3D toy finish,
warm studio light. No paths, structures, nest, egg, characters, trees, stairs,
lamps, clouds, text, watermark, cast shadow, or edge decoration. Use a perfectly
flat solid `#ff00ff` background and do not use that color in the subject.

## Egg-home foundation prompt

Preserve the empty foundation's island silhouette, hex face, cliff structure,
camera, lighting, grass, and vines. Add only a centered circular plaza of
rounded honey-stone pavers, a handcrafted wicker nest at its exact center, and
restrained inset hedges, shrubs, and flowers. Keep all six connection edges
clean and leave usable grass around the plaza. No baked egg, cottage, edge path,
characters, clouds, text, watermark, or shadows. Use the same perfectly flat
solid `#ff00ff` background.

## Packaging

## Example resident tiles

Tasklet uses the same connected-island language as a focused outdoor workshop:
a timber planning bench, blank task board, tools, papers, lanterns, and an open
grass foreground reserved for the runtime creature sprite. Feastle uses a warm
open-air kitchen and cafe counter with an oven, cookware, produce, bread, and
the same clear creature stage. Neither master bakes the Katchimera into the art.

Both were generated on a flat magenta matte, extracted locally, and packaged at
the same three LOD sizes as the foundations. Tasklet uses a hard chroma cut
because its blue-violet props overlap the matte hue; Feastle uses the standard
soft chroma extraction.

The `*-source.png` files are the generated chroma-key masters. The
`*-alpha.png` files are the locally extracted transparent masters. Package them
without trimming or recentering:

```powershell
python scripts/package-transparent-hex-tile.py --source design/floating-island-v1/floating-empty-alpha.png --key floating_empty_hex_tile_v1
python scripts/package-transparent-hex-tile.py --source design/floating-island-v1/floating-home-alpha.png --key floating_home_base_hex_tile_v1
python scripts/package-transparent-hex-tile.py --source design/floating-island-v1/floating-tasklet-alpha.png --key floating_tasklet_hex_tile_v1
python scripts/package-transparent-hex-tile.py --source design/floating-island-v1/floating-feastle-alpha.png --key floating_feastle_hex_tile_v1
```

`qa-connected-cluster.png` records the approved seven-tile composition using
the measured `connected-floating-v1` overlap profile.
`qa-tasklet-feastle-cluster.png` adds the two example habitats and their live
creature cutouts at the renderer's production scale and anchor positions.
