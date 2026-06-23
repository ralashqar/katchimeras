#!/usr/bin/env python3
"""POC: generate isometric ground tiles by EDITING over a diamond outline.

Instead of generating a free-floating decal and trimming it to fit, we render an
isometric diamond outline locally and pass it to nano-banana-2/edit as the source
image, asking the model to paint the ground texture INSIDE the outline. The tile
then conforms to the diamond bounds by construction. Source is sent as a data URI
(FAL image fields accept them) so no upload step is needed.

  python scripts/world-tile-edit.py single --key grass --subject "cozy grass"
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'decals')


def load_env():
    env = {}
    with open(os.path.join(ROOT, '.env.local'), encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    url = env.get('EXPO_PUBLIC_SUPABASE_URL')
    key = env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or env.get('EXPO_PUBLIC_SUPABASE_KEY')
    if not url or not key:
        sys.exit('missing supabase url/key')
    return url, key


SUPABASE_URL, SUPABASE_KEY = load_env()


def call(fn, payload, timeout=300):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def diamond_outline(size=1024, margin=0.04):
    """A single isometric 2:1 diamond outline centered in a square frame."""
    img = Image.new('RGBA', (size, size), (208, 208, 208, 255))  # neutral bg
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    hw = size * (0.5 - margin)       # half width
    hh = hw / 2                      # 2:1 -> half height
    pts = [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]
    d.polygon(pts, fill=(238, 230, 214, 255), outline=(120, 104, 74, 255), width=6)
    return img, pts


def to_data_uri(img):
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def mask_to_diamond(img, pts):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img.convert('RGBA'), (0, 0), mask)
    return out


def edit(prompt, data_uri, resolution='2K'):
    payload = {
        'renderProfile': {
            'id': 'world_tile_edit_poc',
            'displayName': 'tile-edit',
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': 'tile',
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'tile edit',
            'imagePrompt': prompt,
        },
        'modelId': 'fal-ai/nano-banana-2/edit',
        # input overrides the function defaults (incl. the 0.5K cap), so request a
        # bigger output for the multi-tile grid.
        'input': {'image_urls': [data_uri], 'resolution': resolution},
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    return rec.get('status'), rec.get('image_url')


def cmd_single(args):
    outline, pts = diamond_outline()
    prompt = (
        f'Paint the inside of the isometric diamond floor tile with a {args.subject} ground texture, '
        'premium stylized 3D cozy cottagecore mobile-game art, soft warm pastel palette, flat and '
        'top-down 2:1 isometric. Fill the diamond exactly to its four edges and stay strictly within '
        'the diamond outline. Keep everything OUTSIDE the diamond a plain flat neutral background. '
        'No text, no letters.'
    )
    status, url = edit(prompt, to_data_uri(outline))
    print('status', status, 'url', url)
    if not url:
        sys.exit('no image returned')
    raw = os.path.join(OUT, f'_edit_{args.key}_raw.png')
    urllib.request.urlretrieve(url, raw)
    # Mask to the diamond we drew (we know its exact geometry).
    img = Image.open(raw).convert('RGBA')
    # outline was 1024; result may differ — scale pts to result size.
    s = img.size[0] / 1024.0
    scaled = [(x * s, y * s) for x, y in pts]
    masked = mask_to_diamond(img, scaled)
    out = os.path.join(OUT, f'_edit_{args.key}.png')
    masked.save(out)
    print('saved', out)


# 4x4 grid: 8 decal types x2 variants, each cell's diamond pre-tinted with a
# hint colour so the edit knows which texture to paint where.
GRID_CELLS = [
    'grass', 'flowers', 'moss', 'path', 'cobble', 'rock', 'wood', 'glow',
    'grass', 'flowers', 'moss', 'path', 'cobble', 'rock', 'wood', 'glow',
]
HINT = {
    'grass': (120, 170, 90), 'flowers': (150, 185, 100), 'moss': (90, 130, 80),
    'path': (205, 178, 132), 'cobble': (176, 176, 182), 'rock': (162, 150, 138),
    'wood': (182, 140, 92), 'glow': (180, 150, 230),
}


def cell_diamond(cell_size, margin=0.06):
    cx = cy = cell_size / 2
    hw = cell_size * (0.5 - margin)
    hh = hw / 2
    return [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]


def cmd_grid(args):
    cell = 512
    grid = cell * 4
    img = Image.new('RGBA', (grid, grid), (210, 210, 210, 255))
    d = ImageDraw.Draw(img)
    base_pts = cell_diamond(cell)
    for i, key in enumerate(GRID_CELLS):
        r, c = divmod(i, 4)
        ox, oy = c * cell, r * cell
        pts = [(x + ox, y + oy) for x, y in base_pts]
        d.polygon(pts, fill=HINT[key] + (255,), outline=(110, 95, 70, 255), width=5)
    prompt = (
        'This is a 4x4 grid of separate isometric diamond floor tiles, each pre-filled with a flat '
        'base colour. Repaint the inside of EACH diamond into a detailed cozy stylized 3D top-down '
        'isometric ground texture that matches its base colour: green=lush grass, bright green with '
        'dots=grass with flowers, dark green=mossy stones, tan=dirt path with pebbles, grey='
        'cobblestones, grey-brown=scattered rocks and pebbles, warm brown=wooden plank floor, '
        'violet=glowing magical runes. Keep every texture strictly inside its own diamond outline, '
        'do not bleed between tiles. Premium mobile-game art, soft warm pastel palette. Plain flat '
        'neutral grey background between the diamonds. No text, no letters, no numbers.'
    )
    status, url = edit(prompt, to_data_uri(img))
    print('status', status, 'url', url)
    if not url:
        sys.exit('no image returned')
    raw = os.path.join(OUT, '_grid_raw_tmp.png')
    urllib.request.urlretrieve(url, raw)
    result = Image.open(raw).convert('RGBA')
    print('result size', result.size)
    # Split each cell, mask to its diamond, write base + _2 variant into decals/.
    rcell = result.size[0] / 4
    rpts = cell_diamond(rcell)
    seen = {}
    for i, key in enumerate(GRID_CELLS):
        r, c = divmod(i, 4)
        crop = result.crop((round(c * rcell), round(r * rcell), round((c + 1) * rcell), round((r + 1) * rcell)))
        masked = mask_to_diamond(crop, rpts)
        n = seen.get(key, 0) + 1
        seen[key] = n
        name = key if n == 1 else f'{key}_{n}'
        masked.save(os.path.join(OUT, f'{name}.png'))
    os.remove(raw)
    print(f'split {len(GRID_CELLS)} tiles into {OUT} (run fit-world-decals.py next)')


# Object grids: standing props/anchors generated many-per-call, matted as one
# image, then split. Footprint = per-grid scale (props ~1 tile, anchors ~2 tiles),
# set in the prompt rather than a drawn outline (a drawn footprint survives the
# matte as an unwanted ring). Objects are listed in reading order so the model
# places them top-left → bottom-right; cells map back by that order.
OBJECT_GRIDS = {
    'props': {
        'folder': 'props',
        'scale': 'each object SMALL, occupying roughly one isometric floor tile',
        'items': [
            ('prop_bench', 'a cozy little wooden park bench'),
            ('prop_lantern', 'a warm glowing standing lantern on a wooden post'),
            ('prop_bush', 'a small round leafy green bush'),
            ('prop_rock', 'a small mossy grey boulder'),
            ('prop_log', 'a short fallen mossy wooden log'),
            ('prop_fence', 'a short low wooden picket fence section'),
            ('prop_flower', 'a small cluster of cute colorful wildflowers'),
            ('prop_coffee_table', 'a small round wooden coffee table with a steaming mug'),
        ],
    },
    # Anchors are 2-tile-footprint hero objects — same mechanism, bigger scale.
    # Reading-order placement is imperfect, so keep grids small (one archetype's
    # 3 anchors) and regenerate any DROPPED key individually.
    'anchors': {
        'folder': 'anchors',
        'scale': 'each object a LARGER hero centerpiece, occupying about two isometric floor tiles',
        'items': [
            ('calm_pond', 'a small round glowing calm pond with lily pads and reeds'),
            ('social_campfire', 'a cozy circular stone campfire ring with stacked logs and a warm flame'),
            ('focus_cafe', 'a small cozy cafe corner: a round bistro table with a steaming cup and a stool'),
        ],
    },
}


def matte_grid(image_url, name):
    data = call('remove-image-background', {'imageUrl': image_url, 'outputName': name})
    return data.get('imageUrl')


def cmd_objects(args):
    spec = OBJECT_GRIDS[args.kind]
    items = spec['items']
    n = len(items)
    side = int(n ** 0.5 + 0.999)  # square grid, NxN
    cell = 512
    size = side * cell
    img = Image.new('RGBA', (size, size), (210, 210, 210, 255))
    listing = '; '.join(f'{i + 1}) {sub}' for i, (_, sub) in enumerate(items))
    prompt = (
        f'A {side}x{side} grid of separate cozy isometric game objects on a plain flat neutral grey '
        f'background, {spec["scale"]}. Draw exactly one object centered in each grid cell, in reading '
        f'order left-to-right then top-to-bottom: {listing}. Premium stylized 3D mascot-world props, '
        '2:1 dimetric isometric three-quarter view, soft warm pastel palette, consistent lighting from '
        'the upper-left, each object fully inside its own cell with clear space around it. No text, no '
        'numbers, no letters, no grid lines.'
    )
    status, url = edit(prompt, to_data_uri(img))
    print('status', status, 'url', url)
    if not url:
        sys.exit('no image returned')
    matted = matte_grid(url, f'world-{args.kind}-grid')
    if not matted:
        sys.exit('matte failed')
    raw = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', '_obj_tmp.png')
    urllib.request.urlretrieve(matted, raw)
    result = Image.open(raw).convert('RGBA')
    print('result size', result.size)
    rcell = result.size[0] / side
    out_dir = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', spec['folder'])
    dropped = []
    for i, (key, _) in enumerate(items):
        r, c = divmod(i, side)
        crop = result.crop((round(c * rcell), round(r * rcell), round((c + 1) * rcell), round((r + 1) * rcell)))
        bbox = crop.getbbox()
        # Reading-order placement is imperfect — a near-empty cell means the model
        # dropped that object. Flag it so it can be regenerated individually.
        area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) if bbox else 0
        if area < (rcell * rcell) * 0.05:
            dropped.append(key)
            continue
        crop = crop.crop(bbox)
        s = max(crop.size)
        framed = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        framed.alpha_composite(crop, ((s - crop.width) // 2, (s - crop.height) // 2))
        framed.save(os.path.join(out_dir, f'{key}.png'))
    os.remove(raw)
    kept = n - len(dropped)
    print(f'kept {kept}/{n} objects into {out_dir}')
    if dropped:
        print('DROPPED (regenerate individually):', ', '.join(dropped))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('single')
    s.add_argument('--key', required=True)
    s.add_argument('--subject', required=True)
    s.set_defaults(func=cmd_single)
    g = sub.add_parser('grid')
    g.set_defaults(func=cmd_grid)
    o = sub.add_parser('objects')
    o.add_argument('--kind', required=True, choices=list(OBJECT_GRIDS.keys()))
    o.set_defaults(func=cmd_objects)
    args = p.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
