from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Normalize standing-object cutouts so their BASE sits at a known frame position.

Objects come back from the pipeline with the subject floating at varying spots in
the frame, so centering the image leaves the base hanging over the front tile
edge. This trims each object to its content and bottom-aligns it in a fixed-aspect
frame, so the renderer can plant the base (bottom-centre) on the tile centre.

  python scripts/fit-world-objects.py                 # anchors + props + memory
  python scripts/fit-world-objects.py --only prop_bench calm_pond
"""
import argparse
import os
from PIL import Image

ROOT = str(game_root())
WORLD = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world'))
FOLDERS = ['anchors', 'props', 'memory-nodes']

FW, FH = 512, 716  # 1 : 1.4 frame (room for tall objects)
FILL_W, FILL_H = 0.92, 0.95
BASE_Y = 0.97      # content bottom sits here (fraction down the frame)


def fit(path):
    img = Image.open(path).convert('RGBA')
    bbox = img.getbbox()
    if not bbox:
        return 'empty'
    content = img.crop(bbox)
    cw, ch = content.size
    scale = min((FW * FILL_W) / cw, (FH * FILL_H) / ch)
    sized = content.resize((max(1, round(cw * scale)), max(1, round(ch * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    x = (FW - sized.width) // 2
    y = round(FH * BASE_Y) - sized.height
    canvas.alpha_composite(sized, (x, max(0, y)))
    canvas.save(path)
    return f'{sized.width}x{sized.height}'


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--only', nargs='*')
    args = p.parse_args()
    for folder in FOLDERS:
        d = os.path.join(WORLD, folder)
        for name in sorted(os.listdir(d)):
            if not name.endswith('.png') or name.startswith('_'):
                continue
            key = name[:-4]
            if key in ('fence_l', 'fence_r'):
                continue  # directional perimeter art, not centred objects
            if args.only and key not in args.only:
                continue
            print(f'  {folder}/{key:24s} {fit(os.path.join(d, name))}')


if __name__ == '__main__':
    main()
