from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Generate a GRID of variants for ONE world object, in the base tile's art style.

Pipeline (reusable for any new structure/object — just change --name/--subject):
  1. Pass the world BASE tile (assets/.../world/base/<ref>.png) to GPT Image 2 as a
     STYLE REFERENCE (the /edit endpoint conditions on it) so the object matches the
     ground's lighting / materials / palette.
  2. Ask for an N×N grid of variations of the subject (the object ONLY — no egg, no
     creature, nothing placed on top), premium 3D mascot-game isometric style.
  3. BiRefNet matte to remove the background.
  4. Split the grid into N×N cells, trim each to its content, save as individual
     cutouts under assets/.../world/objects/<name>/<name>_NN.png.

Usage:
  python scripts/generate-world-object-grid.py                 # egg_pedestal (default)
  python scripts/generate-world-object-grid.py --name egg_pedestal --force
  python scripts/generate-world-object-grid.py --name lamp_post \
      --subject "a tall cozy iron street lamp post with a warm glowing lantern"
  python scripts/generate-world-object-grid.py --grid 4 --size 1024x1024 --keep-grid
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request

ROOT = str(game_root())
WORLD_DIR = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world'))
OBJECTS_DIR = os.path.join(WORLD_DIR, 'objects')
BASE_DIR = os.path.join(WORLD_DIR, 'base')

# 'cozy' — the original cottagecore catalog look (soft, pastel, simplified).
OBJECT_STYLE = (
    'premium stylized 3D mascot mobile-game asset, isometric 2:1 dimetric three-quarter '
    'top-down view, cozy magical cottagecore mood, soft warm pastel palette, clean simplified '
    'tactile materials, subtle inner glow, soft consistent sunlight from the upper-left, '
    'polished hero-quality render.'
)

# 'premium' — a high-end 3D-CG render (NOT flat cartoon / pastel cottagecore): rich
# detailed PBR materials, dramatic cinematic lighting, atmospheric depth, magical glow,
# deep moody dark-fantasy palette. Aim = AAA mobile RPG / gacha hero-asset quality.
PREMIUM_STYLE = (
    'a PREMIUM high-end 3D CG game asset rendered in stylized REALISM — NOT a flat cartoon, NOT '
    'cottagecore, NOT pastel and NOT a cute mascot look. Richly detailed physically-based '
    'materials (weathered carved stone, aged timber, mossy patina, oxidised metal, leaded glass '
    'glowing with warm interior light), dramatic cinematic lighting with soft global illumination '
    'and gentle rim light, atmospheric depth and subtle volumetric glow, faint floating light '
    'motes and magical embers, a deep moody dark-fantasy palette with rich jewel tones and warm '
    'window glow, intricate hand-crafted ornamentation, crisp ultra-high-detail render, '
    'Octane/Redshift-quality lighting, AAA mobile RPG / gacha hero-asset quality, 2:1 dimetric '
    'isometric three-quarter top-down camera.'
)

# 'collectible' — the Cozy Collectible Diorama master direction (docs/world-
# structures-cozy-direction.md §4). Premium designer-toy look: soft rounded chunky
# silhouettes, smooth ceramic/matte-plastic/painted-wood, warm cream/caramel/honey
# palette + soft-blue/sage/orange accents, oversized iconic features, very few props,
# warm glow. Reference: Monument Valley / Travel Town / Merge Mansion / Royal Match.
COLLECTIBLE_STYLE = (
    'a PREMIUM stylized 3D isometric game asset in a modern COLLECTIBLE DESIGNER-TOY aesthetic — '
    'cozy, minimalist and sophisticated, inspired by premium mobile games (Monument Valley, Travel '
    'Town, Merge Mansion, Royal Match) NOT medieval fantasy and NOT a children\'s toy. Soft rounded '
    'geometry with chunky, instantly-readable silhouettes built from a FEW large clean shapes, not '
    'many tiny details. Smooth matte materials: ceramic, soft matte plastic, polished painted wood, '
    'subtle satin and rubber finishes with gentle rounded bevels — no rough realism, no noisy or '
    'gritty textures, no bricks. Warm cream, caramel, honey, oat and light-walnut palette with a '
    'single muted pastel accent (soft blue, sage green or warm orange). Oversized doors / windows / '
    'props and ONE iconic feature that instantly says what it is. Very few decorative props — no '
    'tiny ropes, railings, banners, signs or clutter. Soft global illumination, warm interior glow, '
    'gentle ambient occlusion, beautiful rim light, clean studio render — like an expensive '
    'collectible figurine. Orthographic isometric top-down camera at about 35 degrees, a modular '
    'asset that sits cleanly on a shared cozy world base.'
)

STYLES = {'cozy': OBJECT_STYLE, 'premium': PREMIUM_STYLE, 'collectible': COLLECTIBLE_STYLE}

# Objects must NOT sit on a patch of terrain (that reads as a ground tile in-world):
# they stand alone or on their OWN small integral base/pedestal, never on scenery.
NO_GROUND = (
    ' Do NOT place the object on any ground tile, grass patch, dirt, soil, terrain, moss bed, lawn, '
    'garden plot, scenery diorama base or floor texture — there must be NO piece of landscape or '
    'ground underneath it. The object MAY have its own small integral base or pedestal (e.g. a '
    'little wooden tray or a small round stone plinth) as part of the object, but nothing that '
    'reads as a patch of ground.'
)

# A flat, high-contrast chroma backdrop so BiRefNet mattes cleanly WITHOUT cutting
# into light parts of the object (a low-contrast neutral bg was eating cream paper /
# pale wood). The model picks a bold solid colour the object does not use.
BACKDROP = (
    'a single completely FLAT, smooth, perfectly uniform solid CHROMA-KEY background — one bold '
    'solid colour fill like a green screen (e.g. vivid green, teal or magenta) that shares NO '
    'colour with the object and strongly contrasts with it, with no gradient, no texture, no '
    'pattern, no shadow and no vignette, so the background mattes out cleanly without cutting into '
    'the object'
)

# Saved subjects so a known object can be re-run by name. --subject overrides this.
CONFIG = {
    'egg_pedestal': (
        'a small circular raised isometric PEDESTAL / dais base for an egg to rest on later — '
        'a round platform (variations in material: smooth stone, mossy stone, carved wood, '
        'polished marble with gold trim, glowing crystal, woven nest-ring) with a gently '
        'recessed or domed round top and a decorative rim, small and wide and low'
    ),
}


def progression_prompt(subject, grid, style):
    return (
        f'A clean {grid} by {grid} grid of the SAME object shown as {grid * grid} sequential GROWTH '
        'STAGES in reading order (left to right, top to bottom): smallest / simplest in the '
        'top-left, growing fuller and a bit larger each step, biggest / richest in the bottom-right. '
        f'{subject} Keep ONE consistent identity, art style, palette and materials across ALL '
        f'stages — only the size and richness change. Fill EVERY one of the {grid * grid} cells, '
        'exactly ONE object per cell, no empty cells. Each stage centered in its own cell, with '
        f'generous even spacing and nothing touching the cell edges. The WHOLE image is set on '
        f'{BACKDROP}. Do NOT draw any egg, creature or unrelated object. Match the lighting and '
        f'world of the reference image(s). {style}{NO_GROUND} Do NOT '
        'caption or label the stages — absolutely NO words, NO text, NO numbers, NO titles, NO '
        "descriptions and NO labels (e.g. no 'stage 1') written anywhere in the image, and no "
        'visible grid lines.'
    )


def grid_prompt(subject, grid, style):
    return (
        f'A clean {grid} by {grid} grid ({grid * grid} cells, evenly spaced) of distinct VARIATIONS '
        f'of {subject}. Fill EVERY one of the {grid * grid} cells — exactly ONE object per cell, no '
        'empty cells. Each cell contains a single object centered in its own cell, with generous '
        f'even spacing so nothing touches the cell edges or its neighbours. The WHOLE image is set '
        f'on {BACKDROP}. ONLY the single object itself in each cell, nothing stacked or piled on '
        f'top of it. Match the lighting and world of the reference image(s). {style}{NO_GROUND} '
        'Absolutely no text, no numbers, no labels, no captions and no visible grid lines anywhere.'
    )


def load_env():
    env = {}
    with open(str(content_path(ROOT, '.env.local')), encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                env[key] = value
    url = env.get('EXPO_PUBLIC_SUPABASE_URL')
    key = env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or env.get('EXPO_PUBLIC_SUPABASE_KEY')
    if not url or not key:
        sys.exit('Missing EXPO_PUBLIC_SUPABASE_URL / key in .env.local')
    return url, key


SUPABASE_URL, SUPABASE_KEY = load_env()


def call(fn, payload, timeout=300):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors='replace')
        raise RuntimeError(f'{fn} HTTP {exc.code}: {body[:600]}') from None


def ref_data_uri(ref_path, max_side=512):
    """The base tile, downscaled, as a data: URI (the edge fn uploads it for FAL)."""
    from PIL import Image

    img = Image.open(ref_path).convert('RGBA')
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    # Flatten onto white so the reference reads as a clean style swatch.
    flat = Image.new('RGB', img.size, (245, 245, 240))
    flat.paste(img, (0, 0), img)
    buf = io.BytesIO()
    flat.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def parse_size(size):
    if 'x' in size:
        w, h = size.lower().split('x')
        return {'width': int(w), 'height': int(h)}
    return size


def build_input(model, ref_path, size, style_ref=None):
    # The base tile gives world lighting/palette; an optional STYLE-GUIDE image
    # (e.g. the premium mockup) is added as a 2nd reference to pull the look toward it.
    image_urls = [ref_data_uri(ref_path)]
    if style_ref:
        image_urls.append(ref_data_uri(style_ref, max_side=768))
    if model == 'gpt':
        # GPT Image 2: image_size preset or {width,height} dict + quality.
        return {'image_urls': image_urls, 'image_size': parse_size(size), 'quality': 'high'}
    # nano-banana-2 (Gemini): aspect_ratio + resolution (0.5K|1K|2K|4K).
    resolution = size if size in ('0.5K', '1K', '2K', '4K') else '2K'
    return {'image_urls': image_urls, 'aspect_ratio': '1:1', 'resolution': resolution}


def generate_grid(name, subject, ref_path, model, model_id, size, grid, mode, style, style_ref):
    style_block = STYLES.get(style, OBJECT_STYLE)
    prompt = (
        progression_prompt(subject, grid, style_block)
        if mode == 'progression'
        else grid_prompt(subject, grid, style_block)
    )
    payload = {
        'modelId': model_id,
        'input': build_input(model, ref_path, size, style_ref),
        'renderProfile': {
            'id': f'world_obj_{name}',
            'displayName': name,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': name,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'world object grid',
            'imagePrompt': prompt,
        },
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    if rec.get('status') != 'succeeded' and not rec.get('image_url'):
        raise RuntimeError(f'generate failed: {rec.get("status")}')
    return rec['image_url']


# All production matting uses the slower, more accurate BiRefNet Heavy variant.
BIREFNET_MODEL = 'BiRefNet_lite'


def matte(image_url, out_name):
    # outputName must match [a-z0-9-]+ (no underscores).
    safe = out_name.replace('_', '-').lower()
    data = call('remove-image-background', {
        'imageUrl': image_url,
        'outputName': safe,
        'model': BIREFNET_MODEL,
        'operatingResolution': '1024x1024',
        'refineForeground': True,
    })
    matted = data.get('imageUrl')
    if not matted:
        raise RuntimeError(f'matte failed: {data}')
    return matted


# How far down the frame the object's bottom pixel sits (matches OBJECT_BOTTOM_FRAC
# in world-canvas.tsx so SpriteView seats it on the tile).
BOTTOM_FRAC = 0.96


def square_frame_for(obj, _cells=None):
    """Place a trimmed object into a TIGHT 1:1 SQUARE sized to THIS object's own bbox
    (the object fills the square — no excess empty space), bottom pixel planted at
    BOTTOM_FRAC, horizontally centred. Per-object (not a shared set frame), so every
    cutout is cropped tightly. SpriteView renders a square box to match; growth in a
    level set is conveyed by per-level sizeScale in the engine, not frame padding."""
    from PIL import Image

    # Side fits the object's width and its height (with the bottom at BOTTOM_FRAC),
    # plus a tiny uniform margin.
    side = max(int(round(obj.width * 1.04)), int(round(obj.height / BOTTOM_FRAC)))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(obj, ((side - obj.width) // 2, int(BOTTOM_FRAC * side) - obj.height), obj)
    return out


def detect_bands(alpha, min_run):
    """Find content bands along one axis by the FULLY-TRANSPARENT gutters between
    cells. `alpha` is a 1-D list of per-line max-alpha (a line = a column or a row).
    Returns [(start, end), ...] runs where there's content, ignoring runs shorter
    than `min_run` (specks). Robust to any grid layout (4×4, 5×5, irregular)."""
    bands = []
    start = None
    for i, v in enumerate(alpha):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_run:
                bands.append((start, i))
            start = None
    if start is not None and len(alpha) - start >= min_run:
        bands.append((start, len(alpha)))
    return bands


def split_grid(grid_png_path, name, grid, frame):
    """Split the matted grid into cells (reading order), trim, and frame each.

    The grid is AUTO-DETECTED from the transparent gutters between cells (so a model
    that returns a 5×5 instead of the requested 4×4 still splits cleanly — no more
    mid-object slices). Falls back to a fixed `grid`×`grid` split if detection fails.
    - 'iso'/'square': SHARED 1:1 square frame, each object bottom-anchored at BOTTOM_FRAC.
    - 'trim': natural cutout + a little transparent pad (manually-placed art).
    """
    from PIL import Image

    img = Image.open(grid_png_path).convert('RGBA')
    W, H = img.size
    out_dir = os.path.join(OBJECTS_DIR, name)
    os.makedirs(out_dir, exist_ok=True)

    # Per-column / per-row max alpha → where the image has content (threshold 8/255).
    alpha = img.split()[3]
    try:
        import numpy as np

        a = np.asarray(alpha)
        col_has = (a.max(axis=0) > 8).astype(int).tolist()
        row_has = (a.max(axis=1) > 8).astype(int).tolist()
    except Exception:  # pure-Python fallback (slower)
        px = alpha.load()
        col_has = [0] * W
        row_has = [0] * H
        for y in range(H):
            for x in range(W):
                if px[x, y] > 8:
                    col_has[x] = 1
                    row_has[y] = 1
    col_bands = detect_bands(col_has, max(8, W // 50))
    row_bands = detect_bands(row_has, max(8, H // 50))

    regions = []  # (left, top, right, bottom) in reading order
    if len(col_bands) >= 2 and len(row_bands) >= 2:
        print(f'  auto-split: detected {len(col_bands)}×{len(row_bands)} grid')
        for (top, bottom) in row_bands:
            for (left, right) in col_bands:
                regions.append((left, top, right, bottom))
    else:  # fallback: assume the requested fixed grid
        print(f'  auto-split: gutters unclear, falling back to fixed {grid}×{grid}')
        cw, ch = W // grid, H // grid
        for r in range(grid):
            for c in range(grid):
                regions.append((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))

    # Trim each region to its object; number sequentially over NON-EMPTY cells.
    cells = []  # (idx, trimmed object)
    for left, top, right, bottom in regions:
        cell = img.crop((left, top, right, bottom))
        bbox = cell.split()[3].getbbox()
        if bbox:
            cells.append((len(cells) + 1, cell.crop(bbox)))

    saved = []
    # 'iso' and 'square' both target SpriteView and produce the same SHARED 1:1
    # square frame (object bottom-anchored at BOTTOM_FRAC). SpriteView renders a
    # matching square box. (The names are kept for callers; both behave the same.)
    if frame in ('iso', 'square') and cells:
        framed = [(i, square_frame_for(obj, cells)) for i, obj in cells]
        for i, out in framed:
            out_path = os.path.join(out_dir, f'{name}_{i:02d}.png')
            out.save(out_path)
            saved.append(out_path)
    else:  # 'trim' — natural cutout for manually-placed art (e.g. the egg pedestal)
        pad = 8
        for i, obj in cells:
            out = Image.new('RGBA', (obj.width + pad * 2, obj.height + pad * 2), (0, 0, 0, 0))
            out.paste(obj, (pad, pad), obj)
            out_path = os.path.join(out_dir, f'{name}_{i:02d}.png')
            out.save(out_path)
            saved.append(out_path)
    return saved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', default='egg_pedestal', help='object key → assets/.../objects/<name>/')
    parser.add_argument('--subject', help='override the subject description (else CONFIG[name])')
    parser.add_argument('--ref', default='base_meadow', help='style-reference base tile key')
    # nano-banana edit is the default: GPT Image 2's edit endpoint runs too long for
    # the synchronous edge function (504s) and caps square output at 1024. nano is
    # fast and does 2K, so grid cells come out higher-res.
    parser.add_argument('--model', default='nano', choices=['gpt', 'nano'])
    parser.add_argument('--size', default='2K', help='nano: 0.5K|1K|2K|4K · gpt: 1024x1024 etc')
    parser.add_argument('--grid', type=int, default=4, help='grid is GRID×GRID')
    parser.add_argument('--mode', default='variants', choices=['variants', 'progression'],
                        help='variants = distinct options · progression = N×N growth stages in reading order')
    parser.add_argument('--frame', default='trim', choices=['trim', 'iso', 'square'],
                        help='trim = natural cutout · iso = 1:2 bottom-anchored (upright catalog objects) · square = 1:1 scene tile (sleep/food)')
    parser.add_argument('--style', default='cozy', choices=list(STYLES.keys()),
                        help='cozy = cottagecore catalog look · premium = high-end 3D-CG render')
    parser.add_argument('--style-ref', help='optional extra style-guide image (path, relative to repo root) — e.g. a premium mockup')
    parser.add_argument('--keep-grid', action='store_true', help='keep the raw + matted grid pngs')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    subject = args.subject or CONFIG.get(args.name)
    if not subject:
        sys.exit(f'No subject for "{args.name}" — pass --subject "..."')
    ref_path = os.path.join(BASE_DIR, f'{args.ref}.png')
    if not os.path.exists(ref_path):
        sys.exit(f'reference base not found: {ref_path}')
    style_ref = None
    if args.style_ref:
        style_ref = args.style_ref if os.path.isabs(args.style_ref) else str(content_path(ROOT, args.style_ref))
        if not os.path.exists(style_ref):
            sys.exit(f'style-ref image not found: {style_ref}')

    out_dir = os.path.join(OBJECTS_DIR, args.name)
    if os.path.isdir(out_dir) and os.listdir(out_dir) and not args.force:
        print(f'{args.name}: already has cutouts (use --force) -> {out_dir}')
        return
    # On --force, clear old cutouts first so a run with fewer cells can't leave stale files.
    if args.force and os.path.isdir(out_dir):
        for f in os.listdir(out_dir):
            if f.endswith('.png'):
                os.remove(os.path.join(out_dir, f))

    model_id = 'openai/gpt-image-2/edit' if args.model == 'gpt' else 'fal-ai/nano-banana-2/edit'
    print(f'generating {args.grid}×{args.grid} {args.mode} grid for "{args.name}" via {args.model} '
          f'({args.size}, {args.style} style{", +style-ref" if style_ref else ""})...')
    grid_url = generate_grid(
        args.name, subject, ref_path, args.model, model_id, args.size, args.grid, args.mode, args.style, style_ref
    )
    print(f'  generated grid: {grid_url}')

    matted_url = matte(grid_url, f'{args.name}-grid')
    grid_png = os.path.join(OBJECTS_DIR, f'_{args.name}_grid.png')
    os.makedirs(OBJECTS_DIR, exist_ok=True)
    urllib.request.urlretrieve(matted_url, grid_png)
    print(f'  matted grid -> {grid_png}')

    saved = split_grid(grid_png, args.name, args.grid, args.frame)
    print(f'  split -> {len(saved)} cutouts in {out_dir}')
    if not args.keep_grid:
        os.remove(grid_png)


if __name__ == '__main__':
    main()
