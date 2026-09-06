from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Generate the TODAY page scene assets (the meadow-home redesign).

Two hero assets, both reference-anchored to base_env2 (THE recipe: img2img via
fal-ai/nano-banana-2/edit with the world base as a style swatch — never fresh
text-to-image, style drifts):

  today_bg        full-bleed portrait background (opaque, NO matting)
  today_pedestal  the egg's garden pedestal, transparent cutout (matted).
                  The real LanternEgg component sits ON TOP — the art must be
                  EMPTY of any egg.

Usage:
  python scripts/generate-today-scene.py --key today_bg
  python scripts/generate-today-scene.py --key today_pedestal
  python scripts/generate-today-scene.py --all [--force]
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request

ROOT = str(game_root())
OUT_DIR = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'today'))
REF_PATH = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'base', 'base_env2.png'))

STYLE = (
    ' premium stylized 3D designer-toy mobile-game render matching the reference image\'s '
    'lighting, palette and material language exactly — cozy magical toy-world mood, soft warm '
    'golden-hour sunlight from the upper-left, saturated warm pastels, clean simplified tactile '
    'materials, soft ambient occlusion, polished hero-quality render.'
)
NO_TEXT = (
    ' Absolutely no text, no numbers, no letters, no typography, no UI overlays, no signage '
    'anywhere in the image.'
)

SCENES = {
    'today_bg': {
        'aspect': '9:16',
        'matte': False,
        'prompt': (
            'Full-screen cozy mobile-game HOME BACKGROUND, portrait orientation: a dreamy meadow '
            'valley at golden hour seen from ground level. Lower half: soft rolling grassy meadow '
            'with scattered tiny wildflowers, gently blurred. Upper half: distant soft blue-green '
            'mountains, a warm glowing sunset sky with soft clouds. A few soft out-of-focus leafy '
            'branches frame the very top corners like a natural vignette. The CENTRE of the image '
            'is calm, open and uncluttered — gentle empty meadow and sky with soft bokeh depth of '
            'field, because UI cards and characters will be composited over it. Muted, softly '
            'darkened tones overall so overlaid UI stays readable. No characters, no animals, no '
            'buildings, no objects in focus.'
        ),
    },
    'today_pedestal': {
        'aspect': '4:3',
        'matte': True,
        'prompt': (
            'A single WIDE, LOW garden display pedestal for a collectible egg: a broad, squat '
            'round stone-brick platform (two very shallow tiers of warm cream cobblestone, much '
            'wider than it is tall), topped with a plump WIDE ring-shaped nest of soft moss, '
            'leafy green vines and small white and pink flowers, the nest opening broad enough '
            'to cradle a large egg. The TOP CENTRE of the nest is EMPTY and slightly concave — '
            'a display stand awaiting its egg. Seen straight-on from a slightly elevated '
            'three-quarter angle, the whole pedestal short and hugging the ground. Single '
            'isolated object centered on a plain neutral studio background for a clean cutout. '
            'ABSOLUTELY NO egg, no characters, no creatures on or near it.'
        ),
    },
    'nav_wood': {
        'aspect': '21:9',
        'matte': True,
        'prompt': (
            'A single long horizontal carved WOODEN BAR — a rounded-rectangle wooden plank UI '
            'panel with softly rounded pill ends, made of polished warm dark walnut wood with '
            'a gentle carved border ridge along its edge, subtle wood grain, a soft warm '
            'highlight along the top edge and a darker underside, like a cozy game\'s bottom '
            'navigation bar carved from a single piece of wood. Perfectly straight and '
            'horizontal, fills most of the frame width. Single isolated object centered on a '
            'plain neutral studio background for a clean cutout. NO buttons, NO icons, NO '
            'carvings of objects — just the smooth empty wooden bar.'
        ),
    },
}


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
    from PIL import Image

    img = Image.open(ref_path).convert('RGBA')
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    flat = Image.new('RGB', img.size, (245, 245, 240))
    flat.paste(img, (0, 0), img)
    buf = io.BytesIO()
    flat.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def generate(key, scene):
    payload = {
        'modelId': 'fal-ai/nano-banana-2/edit',
        'input': {
            'image_urls': [ref_data_uri(REF_PATH)],
            'aspect_ratio': scene['aspect'],
            'resolution': '2K',
        },
        'renderProfile': {
            'id': f'today_scene_{key}',
            'displayName': key,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': key,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'today scene asset',
            'imagePrompt': f'{scene["prompt"]}{STYLE}{NO_TEXT}',
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
    urllib.request.urlretrieve(matted_url, out_path)


def run(key, force):
    scene = SCENES[key]
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f'{key}.png')
    if os.path.exists(out_path) and not force:
        print(f'{key}: exists (use --force) -> {out_path}')
        return
    print(f'generating "{key}" ({scene["aspect"]}, matte={scene["matte"]})...')
    url = generate(key, scene)
    print(f'  generated: {url}')
    if scene['matte']:
        matte(key, url, out_path)
    else:
        urllib.request.urlretrieve(url, out_path)
    print(f'  saved -> {out_path}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--key', choices=list(SCENES.keys()))
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    keys = list(SCENES.keys()) if args.all or not args.key else [args.key]
    for key in keys:
        run(key, args.force)


if __name__ == '__main__':
    main()
