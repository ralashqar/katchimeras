# Approved soft dream mist

`source.png` is the approved imagegen artwork; preserve it when reprocessing transparency.
`alpha.png` is the initial background-removal output, retained for comparison only.

Runtime v4 assets use `birefnet-clean/final.png`, processed through the existing
FAL BiRefNet v2 endpoint (General Use Heavy, foreground refinement), followed by
the shared hex-tile source-backed interior repair, edge cleanup and premultiplied
alpha resizing. No art rerender or canvas reframing is applied.

Reproduce from the app root:

```powershell
python scripts/hex-tile-pipeline.py --source design/dream-mist-imagegen-soft-v1/source.png --key dream_mist_locked_hex_tile_v4 --desc "Approved soft dream mist hex tile" --skip-rerender --preserve-canvas --workdir design/dream-mist-imagegen-soft-v1/birefnet-clean
```

This packages 1024/512/256 WebPs and regenerates the alpha-bounds manifest.
`birefnet-clean/qa-comparison.jpg` shows the initial matte on the left and the
processed runtime asset on the right, against light and dark backgrounds.
