#!/usr/bin/env python3
"""Normalize world decal cutouts into a 2:1 isometric-tile frame.

Raw decals come back from the pipeline with a ~1.7:1 content aspect — rounder
than the 2:1 tile — so fitting by height leaves left/right gaps that read as
"the decal doesn't fill the tile". This trims to content, then fills the frame
WIDTH edge to edge so the graphic spans the whole tile horizontally; the height
is squashed down to the 2:1 frame only if it overflows (mild, keeps soft edges),
or padded if short. Result: every decal fills its tile side to side.

Idempotent: re-running re-extracts the content bbox and re-fits.

Usage: python scripts/fit-world-decals.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECALS = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'decals')

FRAME = (240, 120)   # 2:1, matches the tile aspect


def fit(path):
    img = Image.open(path).convert('RGBA')
    bbox = img.getbbox()
    if not bbox:
        return 'empty'
    content = img.crop(bbox)
    cw, ch = content.size
    # Fill width edge to edge, preserving aspect for now.
    new_h = round(ch * FRAME[0] / cw)
    sized = content.resize((FRAME[0], max(1, new_h)), Image.LANCZOS)
    # Squash to the 2:1 frame height if it overflows; centre-pad if it's short.
    if sized.height > FRAME[1]:
        sized = sized.resize((FRAME[0], FRAME[1]), Image.LANCZOS)
        note = f'fill-width, squashed {new_h}->{FRAME[1]}'
    else:
        note = f'fill-width, padded {new_h}->{FRAME[1]}'
    canvas = Image.new('RGBA', FRAME, (0, 0, 0, 0))
    canvas.alpha_composite(sized, (0, (FRAME[1] - sized.height) // 2))
    canvas.save(path)
    return note


def main():
    for name in sorted(os.listdir(DECALS)):
        if name.endswith('.png'):
            print(f'  {name:16s} {fit(os.path.join(DECALS, name))}')


if __name__ == '__main__':
    main()
