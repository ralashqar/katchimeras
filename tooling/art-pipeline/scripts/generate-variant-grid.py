from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Generate one creature's 4x4 mood x bond-depth variant grid via gpt-image-2.

Builds the grid prompt straight from data/katchimeras/creature-variants.json
(rows = moods, columns = bond depths), hosts a local reference image (so FAL can
use it for identity), and calls generate-katchimera-art with the GPT Image 2 edit
endpoint at `medium` quality (square_hd `high` blows Supabase's 150s edge limit).

Usage:
  python scripts/generate-variant-grid.py --creature <profileId> --ref-src <local.png>
  python scripts/generate-variant-grid.py --creature <profileId> --ref-url <hosted.png>
Output: assets/images/katchimeras/variant-grids/<visualKey>-grid.png (raw grid).
Then matte + slice with scripts/slice-variant-grid.py.
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error

ROOT = str(game_root())


def load_env():
    env = {}
    with open(str(content_path(ROOT, '.env.local')), encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    url = env.get('EXPO_PUBLIC_SUPABASE_URL')
    key = env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or env.get('EXPO_PUBLIC_SUPABASE_KEY')
    if not url or not key:
        sys.exit('Missing Supabase URL/key in .env.local')
    return url, key


def call(fn, payload, timeout=235):
    url, key = load_env()
    req = urllib.request.Request(
        f'{url}/functions/v1/{fn}',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        sys.exit(f'{fn} HTTP {exc.code}: {exc.read().decode()[:400]}')


def host_ref(local_path):
    with open(local_path, 'rb') as handle:
        data = call('remove-image-background', {
            'imageBase64': base64.b64encode(handle.read()).decode(),
            'outputName': 'variant-ref',
        })
    if not data.get('imageUrl'):
        sys.exit(f'could not host ref: {data}')
    return data['imageUrl']


def build_prompt(spec, creature):
    moods = spec['axes']['moodRows']
    bonds = spec['axes']['bondColumns']
    pose = creature['moodPose']
    detail = creature['bondDetail']
    rows = ' '.join(
        f'Row {i + 1} {m}: {pose[m]}.' for i, m in enumerate(moods)
    )
    cols = ' '.join(
        f'Column {i + 1} {b}: {detail[b]}.' for i, b in enumerate(bonds)
    )
    return (
        'A single clean 4x4 grid: four rows and four columns, sixteen equal square cells '
        'separated by thin neat dark gutters, showing sixteen variations of the SAME character '
        f'from the reference image. The character is {creature["base"]} '
        'Keep the identity, palette, proportions and premium stylized 3D Pixar-like mascot art '
        'style IDENTICAL in every cell; same centered framing, same soft studio key light, same '
        f'dark studio background in every single cell. Each ROW is one mood, top to bottom. {rows} '
        f'Each COLUMN deepens the detail and richness, left to right. {cols} '
        'Sixteen distinct poses, unmistakably the same character. Clean consistent cel-lit 3D '
        'render. Absolutely no text, no numbers, no letters, no labels anywhere.'
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--creature', required=True)
    parser.add_argument('--ref-src', help='local image to host as the identity ref')
    parser.add_argument('--ref-url', help='already-hosted ref URL (skips hosting)')
    parser.add_argument('--quality', default='medium')
    args = parser.parse_args()

    spec = json.load(open(str(content_path(ROOT, 'data/katchimeras/creature-variants.json')), encoding='utf-8'))
    creature = spec['creatures'].get(args.creature)
    if not creature:
        sys.exit(f'no variant spec for {args.creature}')

    ref = args.ref_url or (host_ref(str(content_path(ROOT, args.ref_src))) if args.ref_src else None)
    if not ref:
        sys.exit('provide --ref-src or --ref-url')
    print('ref:', ref)

    prompt = build_prompt(spec, creature)
    payload = {
        'renderProfile': {
            'id': f"{creature['visualKey']}_variant_grid",
            'displayName': f"{creature['visualKey']}_variant_grid",
            'topLevelType': 'concept', 'triggerCategory': 'asset',
            'triggerSubtype': 'variant_grid', 'theme': 'asset', 'creatureKind': 'asset',
            'caption': 'variant grid', 'imagePrompt': prompt,
        },
        'modelId': 'openai/gpt-image-2/edit',
        'input': {'image_urls': [ref], 'image_size': 'square_hd', 'quality': args.quality},
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    print('status:', rec.get('status'))
    if rec.get('status') != 'completed' or not rec.get('image_url'):
        sys.exit(f'grid generation failed: {rec.get("error_message") or rec}')

    out_dir = str(content_path(ROOT, 'assets/images/katchimeras/variant-grids'))
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{creature['visualKey']}-grid.png")
    urllib.request.urlretrieve(rec['image_url'], out)
    print('saved', out)


if __name__ == '__main__':
    main()
