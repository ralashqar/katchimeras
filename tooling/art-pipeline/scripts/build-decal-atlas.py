from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Compose the 16 fitted decals into one sprite atlas.

The renderer then loads ONE image and shows each decal as a clipped sub-region,
so the GPU uploads a single texture instead of 16. Cells are laid out 4x4 at the
decal's 2:1 aspect (256x128), giving a 1024x512 atlas. The cell ORDER here MUST
match DECAL_ATLAS_CELLS in utils/world-visuals.ts.

Run after (re)generating decals: python scripts/build-decal-atlas.py
"""
import os
from PIL import Image

ROOT = str(game_root())
DECALS = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'decals'))

CELL_W, CELL_H = 256, 128  # 2:1, matches the tile aspect
LAYOUT = [
    ['grass', 'flowers', 'moss', 'path'],
    ['cobble', 'rock', 'wood', 'glow'],
    ['grass_2', 'flowers_2', 'moss_2', 'path_2'],
    ['cobble_2', 'rock_2', 'wood_2', 'glow_2'],
]


def main():
    cols = max(len(r) for r in LAYOUT)
    rows = len(LAYOUT)
    atlas = Image.new('RGBA', (cols * CELL_W, rows * CELL_H), (0, 0, 0, 0))
    for r, line in enumerate(LAYOUT):
        for c, key in enumerate(line):
            path = os.path.join(DECALS, f'{key}.png')
            tile = Image.open(path).convert('RGBA').resize((CELL_W, CELL_H), Image.LANCZOS)
            atlas.paste(tile, (c * CELL_W, r * CELL_H), tile)
    out = os.path.join(DECALS, '_atlas.png')
    atlas.save(out)
    print(f'atlas {atlas.size} -> {out}')
    for r, line in enumerate(LAYOUT):
        for c, key in enumerate(line):
            print(f'  {key:12s} ({c},{r})')


if __name__ == '__main__':
    main()
