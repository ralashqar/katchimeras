#!/usr/bin/env python3
"""Generate the large isometric WORLD PATCH BASE (the ground island).

Unlike the catalog objects (small floating cutouts), the base is ONE big
isometric ground tile/island onto which POI objects get planted afterward. So it
uses its own style: a full terrain island, EMPTY of buildings/characters, matted
to true alpha so the island floats on the app's dark ambient background.

Pipeline (same edge functions as generate-world-assets.py):
  generate-katchimera-art (FAL nano-banana-2) -> remove-image-background (BiRefNet).

Usage:
  python scripts/generate-world-base.py                 # base_meadow (default)
  python scripts/generate-world-base.py --key base_meadow --force
"""
import argparse
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'base')

# The base shares the world's lighting/material language with the catalog objects
# (upper-left sun, cozy cottagecore, premium stylized 3D) so planted POIs sit in
# the same world — but it is a LARGE, EXPANSIVE, NATURAL island landmass with an
# ORGANIC irregular shape (no square tile / no stone retaining walls), seen from
# far enough that detail reads small and the space feels vast. It is deliberately
# EMPTY of structures so the app composites POI objects on top.
BASE_STYLE = (
    ' three-quarter top-down isometric-style aerial camera, wide establishing view from high '
    'above and far away so the land reads VAST and EXPANSIVE, a single big natural floating '
    'island landmass made of smooth BARE GROUND ONLY, with an ORGANIC IRREGULAR coastline and '
    'arbitrary natural edges (NOT a square, NOT a neat tile grid, NO stone retaining walls, NO '
    'hard border), the surface is gentle rolling green grassy meadows and soft hills where the '
    'grass is a flat smooth even ground texture, a winding river and a few small ponds of calm '
    'water, soft meandering bare dirt footpaths, and gentle smooth terrain contours, soft earthy '
    'cliffs along the floating edges with a bare rocky soil underside so it reads as a floating '
    'world, single isolated island centered on a plain flat pale neutral studio background with '
    'nothing else in the scene for a clean cutout, soft consistent sunlight from the upper-left, '
    'premium stylized 3D mascot-world render, cozy magical cottagecore mood, soft warm pastel '
    'palette, clean simplified tactile materials, subtle inner glow, polished mobile-game '
    'hero-quality render. The surface is EMPTY BARE GROUND with NOTHING standing on it: '
    'absolutely NO trees, NO bushes, NO shrubs, NO plants, NO flowers, NO grass tufts or clumps, '
    'NO rocks, NO boulders, NO pebbles, NO logs, NO buildings, NO structures, NO fences, NO '
    'characters, NO creatures and NO props of any kind on top — ONLY the smooth open ground, '
    'water and dirt paths, with lots of clear room to place objects on later.'
)
NO_TEXT = (
    ' Absolutely no text, no numbers, no letters, no typography, no monograms, no UI overlays, '
    'no signage anywhere in the image.'
)

BASES = {
    'base_meadow': 'a vast expansive natural floating island of smooth bare grassy ground, a winding river and small ponds, with an organic irregular coastline and bare dirt paths',
}

# Model families. nano-banana-2 (Gemini): aspect_ratio + resolution (up to 4K).
# gpt-image-2 (OpenAI via FAL): image_size preset + quality (square caps ~1024,
# landscape 1536x1024) — richer detail but smaller, so we upscale if chosen.
def _gpt_size(size):
    # gpt-image-2 wants a preset name OR a {width,height} dict (NOT a 'WxH' string).
    if 'x' in size:
        w, h = size.lower().split('x')
        return {'width': int(w), 'height': int(h)}
    return size


MODELS = {
    'nano': ('fal-ai/nano-banana-2', lambda res, size: {'resolution': res, 'aspect_ratio': '1:1'}),
    'gpt': ('openai/gpt-image-2', lambda res, size: {'image_size': _gpt_size(size), 'quality': 'high'}),
}


def load_env():
    env = {}
    with open(os.path.join(ROOT, '.env.local'), encoding='utf-8') as handle:
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
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def generate(key, subject, model, resolution, size):
    model_id, input_fn = MODELS[model]
    payload = {
        'modelId': model_id,
        # Override the model size defaults so the base is large enough to pan/zoom
        # and seat many POIs on. nano: 2K/4K; gpt: 1536x1024 then upscale.
        'input': input_fn(resolution, size),
        'renderProfile': {
            'id': f'world_{key}',
            'displayName': key,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': key,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'world base',
            'imagePrompt': f'Expansive game world ground base: {subject}.{BASE_STYLE}{NO_TEXT}',
        },
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    if rec.get('status') != 'succeeded' and not rec.get('image_url'):
        raise RuntimeError(f'generate failed: {rec.get("status")}')
    return rec['image_url']


def matte(key, image_url, out_path):
    name = key.replace('_', '-')
    data = call('remove-image-background', {'imageUrl': image_url, 'outputName': name})
    matted_url = data.get('imageUrl')
    if not matted_url:
        raise RuntimeError(f'matte failed: {data}')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    urllib.request.urlretrieve(matted_url, out_path)


def verify_alpha(path):
    try:
        from PIL import Image
    except ImportError:
        return 'no-pillow'
    img = Image.open(path)
    if img.mode != 'RGBA':
        return 'NOT-RGBA'
    w, h = img.size
    corners = [img.getpixel(p)[3] for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    center = img.getpixel((w // 2, h // 2))[3]
    return f'ok {w}x{h}' if all(c == 0 for c in corners) and center > 200 else f'SUSPECT {w}x{h}'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--key', default='base_meadow', choices=list(BASES.keys()))
    parser.add_argument('--model', default='nano', choices=list(MODELS.keys()))
    parser.add_argument('--resolution', default='2K', help='nano resolution: 0.5K | 1K | 2K | 4K')
    parser.add_argument('--size', default='1536x1024', help='gpt image_size, e.g. 1024x1024 | 1536x1024')
    # Skip generation and just matte an image you already have (e.g. a fal.media
    # URL you picked) into the base. The fast path for "replace the base with this".
    parser.add_argument('--matte-url', help='matte an existing image URL into the base (no generation)')
    # By default writes a per-model candidate (base_meadow__nano.png) so the live
    # base_meadow.png is only replaced when you pick a winner with --promote.
    parser.add_argument('--promote', action='store_true', help='write straight to {key}.png (the live base)')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    # --- Matte an existing image (no generation) into the live base. ---
    if args.matte_url:
        out_path = os.path.join(BASE_DIR, f'{args.key}.png')
        print(f'matting external image -> "{args.key}" ...')
        matte(args.key, args.matte_url, out_path)
        print(f'  matted -> {out_path}  [{verify_alpha(out_path)}]')
        return

    name = args.key if args.promote else f'{args.key}__{args.model}'
    out_path = os.path.join(BASE_DIR, f'{name}.png')
    if os.path.exists(out_path) and not args.force:
        print(f'{name}: exists (use --force to regenerate) -> {out_path}')
        return
    print(f'generating "{name}" via {args.model} ({args.resolution if args.model == "nano" else args.size})...')
    url = generate(args.key, BASES[args.key], args.model, args.resolution, args.size)
    print(f'  generated: {url}')
    matte(name, url, out_path)
    print(f'  matted -> {out_path}  [{verify_alpha(out_path)}]')


if __name__ == '__main__':
    main()
