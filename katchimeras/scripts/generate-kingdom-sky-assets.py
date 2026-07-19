#!/usr/bin/env python3
"""Generate the reusable Kingdom daylight cloud set through the FAL pipeline.

The source render is generated on pure black, then sent through the shared
BiRefNet v2 endpoint (BiRefNet_lite / General Use (Heavy), 1024x1024, refined
foreground). Production WebPs are trimmed alpha cutouts at 1024 and 512px.
"""
import argparse
import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESIGN_DIR = os.path.join(ROOT, 'design', 'kingdom-sky')
ASSET_DIR = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'sky')
WORK_DIR = os.path.join(ROOT, '.tmp', 'kingdom-sky')

STYLE = (
    'A single stylized cloud asset for the Katchimeras mobile game. Premium friendly 3D toy-diorama art, '
    'low visual frequency, a few large rounded cloud lobes, strong clean silhouette, broad smooth bevels, '
    'simplified matte material, soft ivory highlights, restrained powder-blue and very subtle warm peach '
    'underside shading, soft daylight from upper left, readable when displayed at 256 pixels. Fully contained '
    'with generous empty padding. Perfectly flat solid pure black #000000 background, no floor, no horizon, '
    'no cast shadow, no external shadow, no background gradient.'
)

NEGATIVE = (
    ' No island, land, grass, stone, building, bridge, creature, egg, character, UI, icon, text, letters, '
    'numbers, watermark, sun, stars, rain, lightning, fog overlay, wispy strands, tiny bubbles, noisy texture, '
    'photorealism, high-frequency detail, or multiple disconnected clouds.'
)

BRIEFS = {
    'kingdom-cloud-far-bank': 'A long low broad distant cloud bank, gently asymmetrical, made from four to six large merged lobes.',
    'kingdom-cloud-mid-wide': 'A wide mid-distance cloud cluster, asymmetrical, made from five to seven large merged lobes.',
    'kingdom-cloud-mid-tall': 'A taller compact rounded cloud cluster, asymmetrical, made from four to six stacked merged lobes.',
    'kingdom-cloud-near-bank': 'A large broad foreground edge cloud bank with a bold simple silhouette and five to seven large merged lobes.',
}


def load_env():
    values = {}
    with open(os.path.join(ROOT, '.env.local'), encoding='utf-8') as handle:
        for raw in handle:
            line = raw.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                values[key] = value
    url = values.get('EXPO_PUBLIC_SUPABASE_URL')
    key = values.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or values.get('EXPO_PUBLIC_SUPABASE_KEY')
    if not url or not key:
        raise RuntimeError('Missing Supabase URL/key in .env.local')
    return url, key


def call(function_name, payload, timeout=300):
    url, key = load_env()
    request = urllib.request.Request(
        f'{url}/functions/v1/{function_name}',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    urllib.request.urlretrieve(url, path)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


def package_alpha(source_path, slug):
    image = Image.open(source_path).convert('RGBA')
    alpha = image.getchannel('A')
    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError(f'{slug}: matte is fully transparent')
    left, top, right, bottom = bounds
    pad = max(12, round(max(right - left, bottom - top) * 0.045))
    crop = image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))
    outputs = {}
    os.makedirs(ASSET_DIR, exist_ok=True)
    for size in (1024, 512):
        ratio = min(size / crop.width, size / crop.height)
        resized = crop.resize((round(crop.width * ratio), round(crop.height * ratio)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
        path = os.path.join(ASSET_DIR, f'{slug}-{size}.webp')
        canvas.save(path, 'WEBP', lossless=True, quality=100, method=6)
        outputs[str(size)] = {'path': os.path.relpath(path, ROOT).replace('\\', '/'), 'sha256': sha256(path)}
    return outputs, {'sourceSize': list(image.size), 'alphaBounds': list(bounds), 'trimmedSize': list(crop.size)}


def process(slug, force):
    source_path = os.path.join(WORK_DIR, f'{slug}-black-source.png')
    matte_path = os.path.join(DESIGN_DIR, f'{slug}-alpha.png')
    prompt = f'{STYLE} {BRIEFS[slug]}{NEGATIVE}'
    production_path = os.path.join(ASSET_DIR, f'{slug}-512.webp')
    if os.path.exists(production_path) and not force:
        return {'id': slug, 'prompt': prompt, 'status': 'skipped-existing'}

    payload = {
        'modelId': 'fal-ai/nano-banana-2',
        'renderProfile': {
            'id': slug,
            'displayName': slug,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': 'kingdom-sky-cloud',
            'theme': 'daylight-sky',
            'creatureKind': 'asset',
            'caption': 'Kingdom sky cloud asset',
            'imagePrompt': prompt,
        },
    }
    record = call('generate-katchimera-art', payload).get('record', {})
    image_url = record.get('image_url')
    if not image_url:
        raise RuntimeError(f'{slug}: generation failed: {record.get("status")}')
    download(image_url, source_path)

    matte = call('remove-image-background', {'imageUrl': image_url, 'outputName': slug})
    matte_url = matte.get('imageUrl')
    if not matte_url:
        raise RuntimeError(f'{slug}: matte failed: {matte}')
    download(matte_url, matte_path)
    outputs, geometry = package_alpha(matte_path, slug)
    return {
        'id': slug,
        'status': 'generated',
        'prompt': prompt,
        'generation': {'provider': 'fal', 'model': 'fal-ai/nano-banana-2', 'sourceUrl': image_url},
        'matte': {
            'modelEnum': 'BiRefNet_lite',
            'falModel': 'General Use (Heavy)',
            'operatingResolution': '1024x1024',
            'refineForeground': True,
            'sourceUrl': matte_url,
        },
        'geometry': geometry,
        'designAlpha': os.path.relpath(matte_path, ROOT).replace('\\', '/'),
        'outputs': outputs,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', choices=BRIEFS.keys())
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    keys = args.only or list(BRIEFS)
    if args.dry_run:
        print(json.dumps({key: f'{STYLE} {BRIEFS[key]}{NEGATIVE}' for key in keys}, indent=2))
        return
    os.makedirs(DESIGN_DIR, exist_ok=True)
    results = []
    for key in keys:
        print(f'Generating {key}...', flush=True)
        results.append(process(key, args.force))
    manifest = {
        'schemaVersion': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'referencePolicy': 'Photo 1 informs composition only and is never passed to generation.',
        'assets': results,
    }
    with open(os.path.join(DESIGN_DIR, 'manifest.json'), 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    print(f'Wrote {os.path.join(DESIGN_DIR, "manifest.json")}')


if __name__ == '__main__':
    main()
