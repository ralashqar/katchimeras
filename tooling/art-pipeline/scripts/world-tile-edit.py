from incubator_context import game_root, content_path, logical_path
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
import time
import urllib.request
import uuid
import numpy as np
from PIL import Image, ImageDraw

ROOT = str(game_root())
OUT = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'decals'))


def load_env():
    env = {}
    with open(str(content_path(ROOT, '.env.local')), encoding='utf-8') as fh:
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


def poll_record(rid, timeout=360):
    """GPT Image 2 edit exceeds the edge function's sync gateway limit (504) but
    finishes server-side — poll the DB for the record by its unique id."""
    q = (f'{SUPABASE_URL}/rest/v1/generated_katchimeras?render_profile_id=eq.{rid}'
         '&select=status,image_url&order=created_at.desc&limit=1')
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(6)
        req = urllib.request.Request(q, headers={'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'})
        try:
            rows = json.load(urllib.request.urlopen(req, timeout=30))
        except Exception:
            continue
        if rows and rows[0]['status'] in ('completed', 'failed'):
            return rows[0]['status'], rows[0].get('image_url')
    return 'timeout', None


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


def edit(prompt, data_uri, resolution='2K', model='nano'):
    if model == 'gpt':
        # GPT Image 2 edit: NAMED size preset, no `resolution`. The function uploads
        # the data-URI guide to a fetchable URL (GPT drops data: URIs).
        model_id = 'openai/gpt-image-2/edit'
        fal_input = {'image_urls': [data_uri], 'image_size': 'square_hd'}
    else:
        model_id = 'fal-ai/nano-banana-2/edit'
        # input overrides the function defaults (incl. the 0.5K cap).
        fal_input = {'image_urls': [data_uri], 'resolution': resolution}
    rid = f'world_edit_{uuid.uuid4().hex[:12]}'
    payload = {
        'renderProfile': {
            'id': rid,
            'displayName': 'tile-edit',
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': 'tile',
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'tile edit',
            'imagePrompt': prompt,
        },
        'modelId': model_id,
        'input': fal_input,
    }
    try:
        rec = call('generate-katchimera-art', payload).get('record', {})
        return rec.get('status'), rec.get('image_url')
    except urllib.error.HTTPError as exc:
        # GPT Image 2 often 504s the sync gateway but finishes server-side.
        if exc.code in (504, 502, 408):
            print('  (sync timeout — polling DB for completion...)')
            return poll_record(rid)
        raise


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
    raw = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', '_obj_tmp.png'))
    urllib.request.urlretrieve(matted, raw)
    result = Image.open(raw).convert('RGBA')
    print('result size', result.size)
    rcell = result.size[0] / side
    out_dir = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', spec['folder']))
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


# Objects generated STANDING on a footprint guide, so the base sits at a known
# frame position (0.5, FOOT_Y) and the renderer can plant that point at the tile
# centre — instead of centering the whole image (which leaves the base hanging
# over the front edge between two tiles). 1-tile footprint = 0.42*S wide, 2-tile
# = 0.84*S, so the same render box scales both correctly.
FOOT_Y = 0.74  # footprint centre, fraction down the square frame

OBJECT_FP = {
    # key: (folder, footprint_tiles, subject)
    'prop_bench': ('props', 1, 'a cozy little wooden park bench'),
    'prop_lantern': ('props', 1, 'a warm glowing standing lantern on a wooden post'),
    'prop_bush': ('props', 1, 'a small round leafy green bush'),
    'prop_rock': ('props', 1, 'a small mossy grey boulder'),
    'prop_log': ('props', 1, 'a short fallen mossy wooden log'),
    'prop_flower': ('props', 1, 'a lush dense rounded clump of colorful wildflowers with full green leaves and grass growing on a small grassy earth mound'),
    'prop_coffee_table': ('props', 1, 'a small round wooden coffee table with a steaming mug'),
    'calm_pond': ('anchors', 2, 'a small round glowing calm pond with lily pads and reeds'),
    'exploration_tower': ('anchors', 2, 'a tall cute wooden lookout tower with a ladder'),
    'meaningful_ancient_tree': ('anchors', 2, 'a majestic ancient tree with a glowing canopy'),
    'social_campfire': ('anchors', 2, 'a cozy circular stone campfire ring with a warm flame'),
    'focus_cafe': ('anchors', 2, 'a cozy cafe corner: round bistro table, steaming cup, a stool'),
    'memory_crystal': ('memory-nodes', 1, 'a softly glowing violet memory crystal on a small pedestal'),
}


def object_fp_guide(footprint, size=1024):
    img = Image.new('RGBA', (size, size), (208, 208, 208, 255))
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size * FOOT_Y
    hw = (0.42 if footprint == 1 else 0.84) * size / 2
    hh = hw / 2
    pts = [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]
    d.polygon(pts, fill=(224, 218, 202, 255), outline=(150, 135, 100, 255), width=5)
    return img


def cmd_object_fp(args):
    keys = args.only if args.only else list(OBJECT_FP.keys())
    for key in keys:
        folder, footprint, subject = OBJECT_FP[key]
        guide = object_fp_guide(footprint)
        prompt = (
            f'Draw {subject} as a premium stylized 3D isometric mascot-world object STANDING centered '
            'on the marked diamond ground footprint, its base resting inside the diamond and the object '
            'rising upward from there. The diamond only marks where the object meets the ground — do '
            'NOT draw the diamond or any platform, just the object on plain flat neutral ground. 2:1 '
            'dimetric isometric three-quarter view, soft warm pastel palette, lighting from the '
            'upper-left. No text, no numbers.'
        )
        status, url = edit(prompt, to_data_uri(guide), resolution='2K')
        print(key, status)
        if not url:
            continue
        matted = matte_grid(url, f'world-fp-{key.replace("_", "-")}')
        raw = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', folder, f'_fp_{key}_tmp.png'))
        urllib.request.urlretrieve(matted, raw)
        # Keep the footprint at (0.5, FOOT_Y) — DO NOT trim/recenter — then downscale.
        im = Image.open(raw).convert('RGBA').resize((768, 768), Image.LANCZOS)
        im.save(str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', folder, f'{key}.png')))
        os.remove(raw)
        print(f'  saved {folder}/{key}.png')


def fence_guide(direction, size=512):
    """A guide image: a 2:1 isometric baseline with picket hints, for the edit to
    turn into a fence running along it. direction 'r' = front-right edge (down-left),
    'l' = front-left edge (up-left)."""
    img = Image.new('RGBA', (size, size), (208, 208, 208, 255))
    d = ImageDraw.Draw(img)
    cx = size / 2
    # one tile-edge spans TILE_W x TILE_H (2:1); draw it centered, low in frame
    half_w, half_h = size * 0.4, size * 0.2
    midy = size * 0.62
    if direction == 'r':  # right -> bottom : goes down-left
        a = (cx + half_w, midy - half_h)
        b = (cx - half_w, midy + half_h)
    else:  # bottom -> left : goes up-left
        a = (cx + half_w, midy + half_h)
        b = (cx - half_w, midy - half_h)
    d.line([a, b], fill=(120, 100, 70, 255), width=8)
    for t in [i / 6 for i in range(7)]:
        px = a[0] + (b[0] - a[0]) * t
        py = a[1] + (b[1] - a[1]) * t
        d.line([(px, py), (px, py - size * 0.22)], fill=(150, 130, 95, 255), width=10)
    return img


# Generate each object STANDING ON a magenta footprint tile (square canvas so the
# 2K edit preserves the layout). The magenta tile is keyed out; the renderer maps
# that tile 1:1 onto the target cell — so planting + scale are baked in. Plant
# constants (must match world-canvas.tsx): tile centre at (0.5, TILE_OBJ_YF) of a
# square frame, tile top-face width = TILE_OBJ_WF of the frame.
TILE_OBJ_YF = 0.76
TILE_OBJ_WF = 0.80

TILE_OBJECTS = {
    # key: (folder, footprint, subject)
    'calm_pond': ('anchors', 2, 'a small round glowing calm pond with lily pads and reeds'),
    'calm_tree': ('anchors', 2, 'a single big cozy rounded tree with soft round foliage'),
    'calm_flower_grove': ('anchors', 2, 'a small grove of soft wildflowers and grass tufts'),
    'active_trail_marker': ('anchors', 2, 'a wooden hiking trail marker post with a blank arrow and a stone'),
    'active_bridge': ('anchors', 2, 'a small cute arched wooden footbridge'),
    'active_windmill': ('anchors', 2, 'a small charming windmill with rounded sails and a stone base'),
    'social_campfire': ('anchors', 2, 'a cozy circular stone campfire ring with stacked logs and a warm flame'),
    'social_plaza': ('anchors', 2, 'a small cozy round cobblestone plaza with a low central planter'),
    'social_picnic_table': ('anchors', 2, 'a cozy wooden picnic table with two benches'),
    'exploration_tower': ('anchors', 2, 'a tall cute wooden lookout tower with a ladder'),
    'exploration_signpost': ('anchors', 2, 'a wooden signpost with blank directional arrow boards'),
    'exploration_lookout': ('anchors', 2, 'a rocky lookout point with a wooden railing and a small telescope'),
    'focus_cafe': ('anchors', 2, 'a cozy cafe corner: round bistro table, steaming cup, a stool'),
    'focus_workshop': ('anchors', 2, 'a cozy little workbench workshop with tools and a stool'),
    'focus_library': ('anchors', 2, 'a cozy reading nook with a small armchair, a stack of books and a lamp'),
    'meaningful_shrine': ('anchors', 2, 'a small serene stone shrine with a softly glowing orb'),
    'meaningful_crystal': ('anchors', 2, 'a large softly glowing magical crystal cluster on a mossy base'),
    'meaningful_ancient_tree': ('anchors', 2, 'a majestic ancient oak tree with a thick gnarled wooden trunk, sprawling roots and a full lush leafy round green canopy (a real tree, not a crystal)'),
    'prop_flower': ('props', 1, 'a lush dense rounded clump of colorful wildflowers with full green leaves and grass growing on a small grassy earth mound'),
    'prop_bush': ('props', 1, 'a small round leafy green bush'),
    'prop_bench': ('props', 1, 'a cozy little wooden park bench'),
    'prop_lantern': ('props', 1, 'a warm glowing standing lantern on a wooden post'),
    'prop_rock': ('props', 1, 'a small mossy grey boulder'),
    'prop_log': ('props', 1, 'a short fallen mossy wooden log'),
    'prop_coffee_table': ('props', 1, 'a small round wooden coffee table with a steaming mug'),
    'memory_photo_bloom': ('memory-nodes', 1, 'a magical glowing flower bloom with a floating glassy photo-frame petal'),
    'memory_landmark_stone': ('memory-nodes', 1, 'a carved standing landmark stone with a glowing face and a small cairn'),
    'memory_monument': ('memory-nodes', 1, 'a small tiered carved grey-stone monument obelisk on a stepped stone base with a soft golden glow (solid carved stone, NOT a crystal, not a shrine)'),
    'memory_crystal': ('memory-nodes', 1, 'a single faceted glowing violet gemstone crystal hovering just above a small grey stone pedestal (one floating gem, not a building or shrine)'),
    'memory_lantern_shrine': ('memory-nodes', 1, 'a cozy little shrine ringed by warm glowing paper lanterns'),
}


def tile_object_guide(footprint, S=1024):
    img = Image.new('RGBA', (S, S), (205, 205, 205, 255))
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S * TILE_OBJ_YF
    gw = S * TILE_OBJ_WF / 2
    gh = gw / 2
    d.polygon([(cx, cy - gh), (cx + gw, cy), (cx, cy + gh), (cx - gw, cy)],
              fill=(255, 0, 228, 255), outline=(170, 0, 150, 255), width=7)
    return img


def _key_out(raw):
    arr = np.array(raw.convert('RGBA')).astype(int)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    # Magenta/pink/purple = green is the low channel and red+blue rise above it.
    # Safe for the objects: brown wood has b<g, greenery has g high, so neither
    # trips this. Catches the bright tile AND its darker anti-aliased edges.
    magenta = ((r - g) > 26) & ((b - g) > 6)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    grey = ((mx - mn) < 26) & (mx > 150)
    alpha = np.where(magenta | grey, 0, 255)
    # Drop tiny stray speckles left by keying (1-px fringe).
    arr[:, :, 3] = alpha
    return Image.fromarray(arr.astype('uint8'), 'RGBA')


def cmd_tile_object(args):
    import numpy as np  # noqa: F401 (used by _key_out)
    keys = args.only if args.only else list(TILE_OBJECTS.keys())
    for key in keys:
        folder, footprint, subject = TILE_OBJECTS[key]
        guide = tile_object_guide(footprint)
        prompt = (
            f'Draw {subject} STANDING ON TOP of the magenta isometric floor tile, its base resting ON '
            'the magenta tile and the object rising up above it, sized to sit naturally within the '
            'tile footprint. Keep the magenta tile clearly visible around the base; do NOT draw the '
            'object beyond the tile footprint at its base. 2:1 dimetric isometric three-quarter view, '
            'premium stylized 3D mascot-world art, soft warm palette, lighting from the upper-left, '
            'plain flat pale grey background. No text, no numbers.'
        )
        status, url = edit(prompt, to_data_uri(guide), resolution='2K')
        print(key, status)
        if not url:
            continue
        raw = Image.open(io.BytesIO(urllib.request.urlopen(url).read()))
        obj = _key_out(raw).resize((768, 768), Image.LANCZOS)
        obj.save(str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', folder, f'{key}.png')))
        print(f'  saved {folder}/{key}.png')


# Object grid v2: each cell is 1 tile WIDE x 2 tiles TALL with a diamond OUTLINE
# guide at the bottom (the base tile). The object stands with its base inside that
# diamond and rises up; the renderer overlays the bottom diamond 1:1 onto the
# target cell. Plant constants (match world-canvas.tsx): the bottom diamond centre
# sits at (0.5, GRID_OBJ_YF) of the 1:2 asset, diamond width = full asset width.
GRID_OBJ_YF = 0.875  # = 1 - (Wc/4)/(2*Wc); diamond centre fraction down the 1:2 cell


FW_OBJ, FH_OBJ = 384, 768  # saved 1:2 frame = one object's 2-cell (base+headroom) slot


# Objects are ALWAYS generated in a 4x4 LINE grid: 4 thick columns × 2 thick rows
# = 8 slots, each slot 1 column wide × 2 cells tall (a faint mid-line splits it
# into a top headroom cell + a bottom base cell). The full-frame line grid grounds
# the model so it can't drift/recenter objects (floating tiles did). >8 objects are
# generated in multiple 4x4 batches. NEVER 3 object-rows.
OBJ_GRID_COLS = 4
OBJ_GRID_BANDS = 2  # object-rows per 4x4 grid (each band = 2 cells tall)


def object_grid_guide(cell=256):
    cols, rows = OBJ_GRID_COLS, OBJ_GRID_BANDS * 2  # 4 cols × 4 cells = the 4x4
    W, H = cols * cell, rows * cell
    img = Image.new('RGBA', (W, H), (242, 242, 242, 255))
    d = ImageDraw.Draw(img)
    FAINT, HEAVY, fw, hw = (196, 196, 196, 255), (60, 60, 60, 255), 3, 9

    def cx(x):
        return min(max(x, hw // 2), W - hw // 2)

    def cy(y):
        return min(max(y, hw // 2), H - hw // 2)

    # Faint: the full 4x4 cell grid (shows every cell, incl. each slot's mid-line).
    for c in range(cols + 1):
        d.line([(c * cell, 0), (c * cell, H)], fill=FAINT, width=fw)
    for r in range(rows + 1):
        d.line([(0, r * cell), (W, r * cell)], fill=FAINT, width=fw)
    # Heavy: the 8 object-slot borders — every column line + outer & MIDDLE rows.
    for c in range(cols + 1):
        x = cx(c * cell)
        d.line([(x, 0), (x, H)], fill=HEAVY, width=hw)
    for y in (cy(0), OBJ_GRID_BANDS * cell, cy(H)):
        d.line([(0, y), (W, y)], fill=HEAVY, width=hw)
    # No diamond tile outline — BiRefNet doesn't always strip it. Just the line
    # grid; the prompt says isometric + base anchored at the cell bottom, and the
    # split bottom-snaps + scales each object so it fits its tile regardless.
    return img, cols, OBJ_GRID_BANDS


def _robust_bbox(im, thresh=40, row_min=8):
    """bbox of the SOLID content, ignoring sparse stray pixels (matte speckles).
    Used only to drop empty cells — NOT to reposition (the diamond is fixed)."""
    a = np.array(im)[:, :, 3]
    mask = a > thresh
    rows = np.where(mask.sum(axis=1) >= row_min)[0]
    cols = np.where(mask.sum(axis=0) >= row_min)[0]
    if len(rows) == 0 or len(cols) == 0:
        return None
    return (int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1)


# Where the object's bottom pixel is parked in the saved 1:2 frame. The renderer
# (world-canvas OBJECT_BOTTOM_FRAC) maps THIS exact line onto the world tile, so
# the two MUST match. A small gap below it = padding (tweak via OBJ_BOTTOM_PAD).
OBJ_BOTTOM_PAD = 0.04
OBJ_BOTTOM_FRAC = 1 - OBJ_BOTTOM_PAD  # 0.96
OBJ_SCALE = 0.75  # shrink each object so it sits comfortably INSIDE its base tile


def _bottom_snap(img):
    """Scale the object down (so it fits inside its tile) and park its true (robust)
    bottom pixel at OBJ_BOTTOM_FRAC of the frame. Cancels any vertical offset the AI
    introduced and guarantees margin. Horizontal centre is preserved (the line grid
    already centres each object in its column)."""
    bb = _robust_bbox(img)
    if not bb:
        return img
    content = img.crop(bb)
    sw = max(1, round(content.width * OBJ_SCALE))
    sh = max(1, round(content.height * OBJ_SCALE))
    content = content.resize((sw, sh), Image.LANCZOS)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    cx = (bb[0] + bb[2]) / 2  # preserve the object's horizontal centre
    out.paste(content, (round(cx - sw / 2), round(FH_OBJ * OBJ_BOTTOM_FRAC) - sh), content)
    return out


def _object_grid_prompt(listing, n):
    return (
        'This image is a reference grid on a plain light background: thick dark lines divide it into '
        'eight rectangular slots arranged four across and two down (a top row of four slots and a '
        'bottom row of four slots). Each slot is one column wide and two cells tall, with a faint line '
        'across its middle splitting it into a top cell and a bottom cell. Keep these grid lines exactly '
        f'as they are — do not move them and do not change the column count. There are exactly {n} '
        f'objects to draw; place one object in each of the first {n} slots in reading order (top row '
        'left to right, then bottom row), and leave every remaining slot completely empty. The objects, '
        f'in order, are: {listing}. Render every object in a strict 2:1 dimetric isometric three-quarter '
        'view, one consistent camera angle for all, with no perspective distortion, no skew and no '
        'tilting. Each object stands planted with its base anchored at the bottom of its slot\'s bottom '
        'cell, centered left to right in the column, and the object rises straight up from there into '
        'the top cell above. Keep every object strictly inside its own slot — do not let objects drift, '
        'shift, recenter or cross the thick lines. Premium stylized 3d mascot-world art, soft warm '
        'palette, lighting from the upper-left. No cast shadow. No text, no numbers.'
    )


def _run_object_grids(folder, out_dir, model, keys):
    """Generate `keys` in 4x4 grids of 8, matte, split + bottom-snap each. Returns
    the keys whose slot came back empty (BiRefNet occasionally drops a low-contrast
    object) so the caller can retry them in a fresh grid."""
    cols, bands = OBJ_GRID_COLS, OBJ_GRID_BANDS
    batch_n = cols * bands  # 8 slots per 4x4 grid — NEVER more (5+ cols mis-split)
    dropped = []
    for bi in range(0, len(keys), batch_n):
        batch = keys[bi:bi + batch_n]
        assert len(batch) <= batch_n, f'batch of {len(batch)} exceeds the {batch_n}-slot grid'
        guide, gc, gb = object_grid_guide()  # always the same 4x4 line grid
        listing = '; '.join(f'{i + 1}) {TILE_OBJECTS[k][2]}' for i, k in enumerate(batch))
        status, url = edit(_object_grid_prompt(listing, len(batch)), to_data_uri(guide), resolution='2K', model=model)
        print('  grid', status, f'({len(batch)} objects)', 'model', model)
        if not url:
            dropped.extend(batch)
            continue
        Image.open(io.BytesIO(urllib.request.urlopen(url).read())).save(
            str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', f'_grid_raw_{folder}.png')))
        matted = matte_grid(url, f'world-objgrid-{folder}')
        grid = Image.open(io.BytesIO(urllib.request.urlopen(matted).read())).convert('RGBA')
        Wc = grid.width / cols  # square cell; grid is 4 cols × (2*bands) cells
        for j, key in enumerate(batch):
            band, col = divmod(j, cols)
            # Slice this object's SLOT = 2 stacked cells (top headroom + bottom
            # base), then bottom-snap so the object's true bottom pixel parks at a
            # fixed line — robust against any vertical offset the AI introduced.
            x0, x1 = round(col * Wc), round((col + 1) * Wc)
            y0, y1 = round(2 * band * Wc), round((2 * band + 2) * Wc)
            out = grid.crop((x0, y0, x1, y1)).resize((FW_OBJ, FH_OBJ), Image.LANCZOS)
            bb = _robust_bbox(out)
            area = (bb[2] - bb[0]) * (bb[3] - bb[1]) if bb else 0
            if area < (FW_OBJ * FH_OBJ) * 0.01:  # empty slot → matte dropped it
                dropped.append(key)
                continue
            _bottom_snap(out).save(os.path.join(out_dir, f'{key}.png'))
    return dropped


def cmd_object_grid(args):
    folder = args.folder
    keys = args.only if args.only else [k for k, v in TILE_OBJECTS.items() if v[0] == folder]
    out_dir = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', folder))
    model = getattr(args, 'model', 'nano')
    pending = list(keys)
    for attempt in range(3):  # matte drops are intermittent — retry in a fresh grid
        print(f'{folder}: attempt {attempt + 1}, {len(pending)} object(s)')
        pending = _run_object_grids(folder, out_dir, model, pending)
        if not pending:
            break
        print(f'  matte-dropped, retrying: {", ".join(pending)}')
    kept = len(keys) - len(pending)
    print(f'kept {kept}/{len(keys)} into {out_dir}')
    if pending:
        print('STILL DROPPED after retries (regen with --only):', ', '.join(pending))


def cmd_fence_strip(args):
    """Generate ONE straight front-facing picket fence strip. The renderer skews
    it (skewY) onto each 2:1 edge, keeping pickets vertical — precise alignment
    without relying on a baked diagonal slope."""
    payload = {
        'renderProfile': {
            'id': 'world_fence_strip',
            'displayName': 'fence-strip',
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': 'fence',
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'fence strip',
            'imagePrompt': (
                'A long straight horizontal row of chunky warm-brown wooden picket fence posts seen '
                'perfectly straight-on from the front (flat front elevation, NO perspective, NO '
                'isometric angle). Tall solid vertical wooden pickets evenly spaced with two '
                'horizontal cross rails, the fence is LARGE and fills most of the image height and '
                'spans the full width edge to edge. Premium stylized 3D mascot-world art, rich '
                'saturated wood color, soft shading, plain flat pale grey background. No text.'
            ),
        },
        'input': {'aspect_ratio': '3:1', 'resolution': '2K'},
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    url = rec.get('image_url')
    print('strip', rec.get('status'), url)
    if not url:
        sys.exit('no image')
    matted = matte_grid(url, 'world-fence-strip')
    out = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'props'))
    raw = os.path.join(out, '_strip_tmp.png')
    urllib.request.urlretrieve(matted, raw)
    im = Image.open(raw).convert('RGBA')
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(os.path.join(out, 'fence_strip.png'))
    os.remove(raw)
    print('saved fence_strip.png', im.size)


def cmd_fence(args):
    out_dir = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'props'))
    for direction in ('l', 'r'):
        guide = fence_guide(direction)
        slope = 'down to the lower-left' if direction == 'r' else 'up to the upper-left'
        prompt = (
            f'Turn the marked guide into a short cozy wooden picket fence running {slope} along the '
            'isometric 2:1 diagonal baseline, with upright wooden pickets and a top rail, premium '
            'stylized 3D mascot-world art, soft warm palette, consistent lighting from the upper-left. '
            'Plain flat neutral background. No text, no numbers.'
        )
        status, url = edit(prompt, to_data_uri(guide), resolution='1K')
        print(f'fence_{direction}', status)
        if not url:
            continue
        matted = matte_grid(url, f'world-fence-{direction}')
        raw = os.path.join(out_dir, f'_fence_{direction}_tmp.png')
        urllib.request.urlretrieve(matted, raw)
        im = Image.open(raw).convert('RGBA')
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
        s = max(im.size)
        framed = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        framed.alpha_composite(im, ((s - im.width) // 2, (s - im.height) // 2))
        framed.save(os.path.join(out_dir, f'fence_{direction}.png'))
        os.remove(raw)
        print(f'  saved fence_{direction}.png')


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
    f = sub.add_parser('fence')
    f.set_defaults(func=cmd_fence)
    fs = sub.add_parser('fence-strip')
    fs.set_defaults(func=cmd_fence_strip)
    to = sub.add_parser('tile-object')
    to.add_argument('--only', nargs='*')
    to.set_defaults(func=cmd_tile_object)
    og = sub.add_parser('object-grid')
    og.add_argument('--folder', required=True, choices=['anchors', 'props', 'memory-nodes'])
    og.add_argument('--only', nargs='*')
    og.add_argument('--model', default='nano', choices=['nano', 'gpt'])
    og.set_defaults(func=cmd_object_grid)
    fp = sub.add_parser('object-fp')
    fp.add_argument('--only', nargs='*')
    fp.set_defaults(func=cmd_object_fp)
    args = p.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
