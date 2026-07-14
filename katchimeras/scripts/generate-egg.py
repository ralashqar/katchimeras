#!/usr/bin/env python3
"""Generate the cozy-collectible EGG: a base + 2 PIXEL-ALIGNED crack phases.

EggShell (components/.../home/egg-shell.tsx) overlays egg-base.png + egg-crack-1.png +
egg-crack-2.png and crossfades them by hatch stage, so the three must share a bounding
box. Flow: generate the base egg (nano edit, base_env2 as a style ref, flat chroma bg) →
EDIT the base twice (subtle cracks, then bursting) so the egg stays put → BiRefNet matte
all three → crop ALL to the UNION alpha bbox (keeps them aligned).

Saves to assets/images/katchimeras/cutouts/{egg-base,egg-crack-1,egg-crack-2}.png.
"""
import base64
import io
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOUTS = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'cutouts')
BASE_REF = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'base', 'base_env2.png')

STYLE = (
    'premium stylized 3D collectible designer-toy aesthetic, cozy and minimalist, soft rounded '
    'chunky silhouette, smooth matte ceramic material with gentle bevels, warm soft inner glow, '
    'soft global illumination and gentle rim light, clean studio render, expensive collectible '
    'figurine quality, NOT a flat cartoon, NO medieval fantasy.'
)
BACKDROP = (
    'a single completely FLAT, smooth, perfectly uniform solid CHROMA-KEY green-screen background '
    '(one bold solid green fill, no gradient, no texture, no shadow) so it mattes out cleanly. '
    'There must be NO ground, NO landscape, NO island, NO scenery and NO platform — ONLY the egg '
    'floating centred on the flat green background.'
)


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
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors='replace')
        raise RuntimeError(f'{fn} HTTP {exc.code}: {body[:600]}') from None


def data_uri(path, max_side=640, flatten=True):
    from PIL import Image

    img = Image.open(path).convert('RGBA')
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    if flatten:
        flat = Image.new('RGB', img.size, (245, 245, 240))
        flat.paste(img, (0, 0), img)
        img = flat
    else:
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def gen(prompt, image_uris):
    payload = {
        'modelId': 'fal-ai/nano-banana-2/edit',
        'input': {'image_urls': image_uris, 'aspect_ratio': '1:1', 'resolution': '2K'},
        'renderProfile': {
            'id': 'world_egg', 'displayName': 'egg', 'topLevelType': 'concept',
            'triggerCategory': 'asset', 'triggerSubtype': 'egg', 'theme': 'asset',
            'creatureKind': 'asset', 'caption': 'egg', 'imagePrompt': prompt,
        },
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    if rec.get('status') != 'succeeded' and not rec.get('image_url'):
        raise RuntimeError(f'gen failed: {rec.get("status")}')
    return rec['image_url']


def matte(image_url, out_name):
    data = call('remove-image-background', {
        'imageUrl': image_url, 'outputName': out_name,
        'model': 'General Use (Heavy)', 'operatingResolution': '2048x2048', 'refineForeground': True,
    })
    m = data.get('imageUrl')
    if not m:
        raise RuntimeError(f'matte failed: {data}')
    return m


def fetch(url, path):
    urllib.request.urlretrieve(url, path)


def main():
    os.makedirs(CUTOUTS, exist_ok=True)
    base_ref = data_uri(BASE_REF)

    egg = (
        'a single COLLECTIBLE DESIGNER-TOY EGG — a smooth rounded matte-ceramic egg shell in soft '
        'cream with gentle mint-green and honey speckles, a warm soft inner glow, subtle bevels, '
        'standing upright and centred, WHOLE with NO cracks. '
    )
    print('generating base egg...')
    base_url = gen(f'{egg}{STYLE} The whole image is set on {BACKDROP}', [base_ref])
    print('  base:', base_url)
    base_raw = os.path.join(CUTOUTS, '_egg_raw.png')
    fetch(base_url, base_raw)
    base_edit = data_uri(base_raw, max_side=768, flatten=False)

    crack1 = (
        'Add a few SUBTLE glowing hairline CRACKS spreading across the egg shell, with soft warm '
        'light leaking faintly from the thin cracks. Keep the egg shape, size, position, colour, '
        'speckles, lighting and the flat green background COMPLETELY IDENTICAL — ONLY add the thin '
        'glowing cracks, do not move or resize the egg.'
    )
    crack2 = (
        'The egg is BURSTING: bigger bright glowing CRACKS split the shell with warm light pouring '
        'out and one small shard lifting. Keep the egg silhouette, size, position and the flat '
        'green background COMPLETELY IDENTICAL — ONLY intensify the cracks and the glow, do not move '
        'or resize the egg.'
    )
    print('generating crack-1...')
    c1_url = gen(crack1, [base_edit])
    print('generating crack-2...')
    c2_url = gen(crack2, [base_edit])

    print('matting...')
    matted = {
        'egg-base': matte(base_url, 'egg-base'),
        'egg-crack-1': matte(c1_url, 'egg-crack-one'),
        'egg-crack-2': matte(c2_url, 'egg-crack-two'),
    }

    from PIL import Image

    imgs = {}
    for name, url in matted.items():
        p = os.path.join(CUTOUTS, f'_{name}_m.png')
        fetch(url, p)
        imgs[name] = Image.open(p).convert('RGBA')

    # Normalise to a common canvas (they should already match), then crop ALL three to
    # the UNION alpha bbox so the overlays stay pixel-aligned.
    w = min(im.width for im in imgs.values())
    h = min(im.height for im in imgs.values())
    for name in imgs:
        if imgs[name].size != (w, h):
            imgs[name] = imgs[name].resize((w, h), Image.LANCZOS)
    boxes = [im.split()[3].getbbox() for im in imgs.values()]
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes),
             max(b[2] for b in boxes), max(b[3] for b in boxes))
    print('  union bbox:', union)
    for name, im in imgs.items():
        out = im.crop(union)
        out.save(os.path.join(CUTOUTS, f'{name}.png'))
        print('  saved', name, out.size)

    for f in os.listdir(CUTOUTS):
        if f.startswith('_egg'):
            os.remove(os.path.join(CUTOUTS, f))
    print('done.')


if __name__ == '__main__':
    main()
