from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Slice a matted 4x4 variant grid into 16 aligned, true-alpha cell cutouts.

Input is a square RGBA grid (background already removed by BiRefNet) whose cells
follow data/katchimeras/creature-variants.json (rows = moods, cols = bond
depths). Cells are cut on the NxN boundary, then ALL cropped to one shared
content bbox (union of every cell's alpha bounds) so the framing stays aligned
when the app crossfades between moods. Output:
  assets/images/katchimeras/cutouts/variants/<visualKey>/<mood>_<bond>.png

Usage:
  python scripts/slice-variant-grid.py --grid <matted.png> --creature <profileId>
"""
import argparse
import json
import os
import sys

from PIL import Image

ROOT = str(game_root())
GRID_N = 4


def load_variants():
    path = str(content_path(ROOT, 'data/katchimeras/creature-variants.json'))
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--grid', required=True)
    parser.add_argument('--creature', required=True, help='encounter profileId key in creature-variants.json')
    parser.add_argument('--pad', type=int, default=6, help='transparent padding around the shared bbox')
    args = parser.parse_args()

    data = load_variants()
    creature = data['creatures'].get(args.creature)
    if not creature:
        sys.exit(f'no variant spec for {args.creature}')
    visual_key = creature['visualKey']
    cells = creature['cells']
    if cells == '@cellTemplate':
        cells = data['cellTemplate']

    grid = Image.open(args.grid).convert('RGBA')
    w, h = grid.size
    if w != h or w % GRID_N != 0:
        sys.exit(f'grid must be a square divisible by {GRID_N}; got {grid.size}')
    cell = w // GRID_N

    # Extract each cell, then compute the union content bbox across all of them.
    extracted = {}
    union = None
    for spec in cells:
        r, c = spec['gridRow'], spec['gridCol']
        box = (c * cell, r * cell, (c + 1) * cell, (r + 1) * cell)
        tile = grid.crop(box)
        extracted[spec['id']] = tile
        bbox = tile.split()[3].getbbox()  # alpha bounds within the tile
        if bbox is None:
            sys.exit(f"cell {spec['id']} is fully transparent — bad grid")
        if union is None:
            union = list(bbox)
        else:
            union[0] = min(union[0], bbox[0])
            union[1] = min(union[1], bbox[1])
            union[2] = max(union[2], bbox[2])
            union[3] = max(union[3], bbox[3])

    pad = args.pad
    crop = (
        max(0, union[0] - pad),
        max(0, union[1] - pad),
        min(cell, union[2] + pad),
        min(cell, union[3] + pad),
    )

    out_dir = str(content_path(ROOT, 'assets/images/katchimeras/cutouts/variants', visual_key))
    os.makedirs(out_dir, exist_ok=True)
    written = 0
    for spec in cells:
        tile = extracted[spec['id']].crop(crop)
        out_path = os.path.join(out_dir, f"{spec['id']}.png")
        tile.save(out_path)
        written += 1

    print(f'wrote {written} cells to {out_dir} (cell {cell}px, shared crop {crop})')


if __name__ == '__main__':
    main()
