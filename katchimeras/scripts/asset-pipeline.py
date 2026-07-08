#!/usr/bin/env python3
"""Katchimera asset pipeline CLI.

Drives the deployed Supabase edge functions to produce real production art:
  generate -> FAL text-to-image (nano-banana-2), stored in the art bucket
  edit     -> FAL image edit (nano-banana-2/edit), for consistent frame variants
  matte    -> FAL BiRefNet v2 background removal -> true-alpha cutout
  verify   -> local alpha check (corners transparent, subject opaque)

Reads Supabase URL + anon key from katchimeras/.env.local. The FAL key and
Supabase service role live server-side as function secrets - never needed here.

Examples:
  python scripts/asset-pipeline.py generate \
    --id location_cafe_lattelet --prompt "$(...)" --out /tmp/lattelet.png
  python scripts/asset-pipeline.py edit \
    --id egg_crack --prompt "same egg, glowing cracks" \
    --image-url https://.../egg.png --out /tmp/crack.png
  python scripts/asset-pipeline.py matte \
    --name lattelet --in /tmp/lattelet.png --out assets/images/katchimeras/cutouts/lattelet.png
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env():
    env = {}
    path = os.path.join(ROOT, '.env.local')
    with open(path, encoding='utf-8') as handle:
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


def call(fn, payload, timeout=180):
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


def download(image_url, out_path):
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    urllib.request.urlretrieve(image_url, out_path)
    print(f'saved {out_path}')


# Always-on negatives the art bible enforces; appended to every prompt.
NO_TEXT = (
    ' Absolutely no text, no numbers, no letters, no typography, no monograms, '
    'no UI overlays, no signage anywhere in the image.'
)


def cmd_generate(args):
    payload = {
        'renderProfile': {
            'id': args.id,
            'displayName': args.id,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': args.id,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'pipeline asset',
            'imagePrompt': args.prompt + ('' if args.allow_text else NO_TEXT),
        }
    }
    if args.model:
        payload['modelId'] = args.model
    rec = call('generate-katchimera-art', payload).get('record', {})
    print('status:', rec.get('status'), 'url:', rec.get('image_url'))
    if rec.get('image_url') and args.out:
        download(rec['image_url'], args.out)


def cmd_edit(args):
    payload = {
        'renderProfile': {
            'id': args.id,
            'displayName': args.id,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': args.id,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'pipeline edit',
            'imagePrompt': args.prompt + ('' if args.allow_text else NO_TEXT),
        },
        'modelId': args.model or 'fal-ai/nano-banana-2/edit',
        'input': {'image_urls': [args.image_url]},
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    print('status:', rec.get('status'), 'url:', rec.get('image_url'))
    if rec.get('image_url') and args.out:
        download(rec['image_url'], args.out)


def cmd_matte(args):
    if args.image_url:
        payload = {'imageUrl': args.image_url, 'outputName': args.name}
    else:
        with open(args.in_path, 'rb') as handle:
            payload = {
                'imageBase64': base64.b64encode(handle.read()).decode(),
                'outputName': args.name,
            }
    data = call('remove-image-background', payload)
    print('status:', data.get('status'), 'url:', data.get('imageUrl'))
    if data.get('imageUrl') and args.out:
        download(data['imageUrl'], args.out)
        if not args.no_verify:
            verify(args.out)


def verify(path):
    try:
        from PIL import Image
    except ImportError:
        print('(install pillow to verify alpha)')
        return
    img = Image.open(path)
    if img.mode != 'RGBA':
        print('ALPHA SUSPECT: not RGBA')
        return
    w, h = img.size
    corners = [img.getpixel(p)[3] for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    center = img.getpixel((w // 2, h // 2))[3]
    ok = all(c == 0 for c in corners) and center > 200
    print(f'alpha {"OK" if ok else "SUSPECT"}: corners {corners} center {center} size {img.size}')


def cmd_verify(args):
    verify(args.in_path)


def main():
    parser = argparse.ArgumentParser(description='Katchimera asset pipeline')
    sub = parser.add_subparsers(dest='command', required=True)

    g = sub.add_parser('generate', help='FAL text-to-image')
    g.add_argument('--id', required=True)
    g.add_argument('--prompt', required=True)
    g.add_argument('--model')
    g.add_argument('--out')
    g.add_argument('--allow-text', action='store_true')
    g.set_defaults(func=cmd_generate)

    e = sub.add_parser('edit', help='FAL image edit from a source image')
    e.add_argument('--id', required=True)
    e.add_argument('--prompt', required=True)
    e.add_argument('--image-url', required=True)
    e.add_argument('--model')
    e.add_argument('--out')
    e.add_argument('--allow-text', action='store_true')
    e.set_defaults(func=cmd_edit)

    m = sub.add_parser('matte', help='BiRefNet background removal -> alpha cutout')
    m.add_argument('--name', required=True)
    m.add_argument('--image-url')
    m.add_argument('--in', dest='in_path')
    m.add_argument('--out')
    m.add_argument('--no-verify', action='store_true')
    m.set_defaults(func=cmd_matte)

    v = sub.add_parser('verify', help='check a PNG has true alpha')
    v.add_argument('--in', dest='in_path', required=True)
    v.set_defaults(func=cmd_verify)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
