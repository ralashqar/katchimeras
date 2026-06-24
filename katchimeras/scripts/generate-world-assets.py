#!/usr/bin/env python3
"""Batch-generate the Katchimera World asset catalog.

Pipelines each catalog entry through the deployed Supabase edge functions:
  generate-katchimera-art (FAL nano-banana-2) -> matte (BiRefNet) -> alpha verify.

Reuses the isometric style formula locked in the asset spike. Writes true-alpha
cutouts to assets/images/katchimeras/world/{anchors,props,memory-nodes}/.

Usage:
  python scripts/generate-world-assets.py            # everything missing
  python scripts/generate-world-assets.py --only calm_tree prop_bench
  python scripts/generate-world-assets.py --force    # regenerate even if present
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD_DIR = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world')

# The proven isometric formula from the spike: shadowless single object on a
# clean background, fixed 2:1 dimetric camera, cozy premium stylized 3D.
STYLE = (
    ' 2:1 dimetric isometric camera angle, high three-quarter top-down view, single object '
    'centered and floating with NO ground tile and NO cast shadow beneath it, plain flat pale '
    'neutral studio background for a clean cutout, soft consistent sunlight from the upper-left, '
    'premium stylized 3D mascot-world render, cozy magical cottagecore mood, soft warm pastel '
    'palette, clean simplified tactile materials, subtle inner glow, polished mobile-game '
    'hero-quality render, one object that belongs to a single cohesive cozy isometric world.'
)
NO_TEXT = (
    ' Absolutely no text, no numbers, no letters, no typography, no monograms, no UI overlays, '
    'no signage anywhere in the image.'
)

# Decals are flat ground-hugging patches, not standing objects — a flatter,
# top-down framing so they read as terrain lying on the tile, not props.
DECAL_STYLE = (
    ' a flat ground-cover decal shaped like a single ISOMETRIC DIAMOND floor tile (a rhombus / '
    'lozenge footprint, NOT a square and NOT a horizontal rectangle), drawn at a 2:1 dimetric '
    'isometric top-down angle, the ground cover fills the whole diamond tile footprint edge to edge '
    'so the four diamond points reach the corners, completely flat and low and ground-hugging with '
    'NO tall standing object and NO cast shadow, plain flat pale neutral studio background for a '
    'clean cutout, soft consistent sunlight from the upper-left, premium stylized 3D cozy '
    'cottagecore render, soft warm pastel palette, clean simplified materials, polished mobile-game '
    'quality, part of one cohesive cozy isometric world.'
)

# key -> (folder, subject). Subjects are deliberately concrete + cozy so the set
# stays on-model with the three spike anchors.
CATALOG = {
    # --- Anchors (remaining; calm_pond / social_campfire / focus_cafe already exist) ---
    'calm_tree': ('anchors', 'a single big cozy rounded tree with soft round foliage and a small grassy mound base'),
    'calm_flower_grove': ('anchors', 'a small grove of soft wildflowers and tufts of grass clustered on a little mound'),
    'active_trail_marker': ('anchors', 'a wooden hiking trail marker post with a small blank directional arrow and a stone at its base'),
    'active_bridge': ('anchors', 'a small cute arched wooden footbridge over a tiny trickling stream'),
    'active_windmill': ('anchors', 'a small charming windmill with rounded sails and a cozy stone base'),
    'social_plaza': ('anchors', 'a small cozy round cobblestone plaza with a low central stone planter of flowers'),
    'social_picnic_table': ('anchors', 'a cozy wooden picnic table with two attached benches and a little basket on top'),
    'exploration_tower': ('anchors', 'a small cute wooden lookout tower with a ladder and a tiny blank pennant on top'),
    'exploration_signpost': ('anchors', 'a wooden signpost with a couple of blank directional arrow boards pointing different ways'),
    'exploration_lookout': ('anchors', 'a rocky lookout point with a wooden railing and a small brass telescope on a stand'),
    'focus_workshop': ('anchors', 'a cozy little workbench workshop with simple tools, a small wooden stool and a desk lamp'),
    'focus_library': ('anchors', 'a cozy reading nook with a small soft armchair, a neat stack of books and a floor lamp'),
    'meaningful_shrine': ('anchors', 'a small serene stone shrine with a softly glowing orb and tiny offering bowls'),
    'meaningful_crystal': ('anchors', 'a large softly glowing magical crystal cluster rising from a mossy stone base'),
    'meaningful_ancient_tree': ('anchors', 'a majestic ancient tree with gnarled roots, broad canopy and a gentle warm inner glow'),
    # --- Props ---
    'prop_flower': ('props', 'a small cluster of cute colorful wildflowers'),
    'prop_bush': ('props', 'a small round leafy green bush'),
    'prop_bench': ('props', 'a cozy little wooden park bench'),
    'prop_lantern': ('props', 'a warm softly glowing standing lantern on a small wooden post'),
    'prop_rock': ('props', 'a small mossy grey boulder rock'),
    'prop_log': ('props', 'a short fallen mossy wooden log'),
    'prop_fence': ('props', 'a short section of low wooden picket fence'),
    'prop_coffee_table': ('props', 'a small round wooden coffee table with a steaming mug on top'),
    # --- Seed-object rewards (Daily Seeds, Today Patch V2) ---
    'seed_water_lily': ('props', 'a single cozy water lily with a round green lily pad and a soft pink blooming lotus flower resting on a small still pool of calm water'),
    # --- Memory Vault chest stages (Diorama Time Capsule, Today Patch V2) ---
    'vault_chest_small': ('props', 'a small cute closed wooden treasure chest with rounded lid and warm brass trim and corners'),
    'vault_chest': ('props', 'a cozy wooden treasure chest with the lid slightly open and a soft warm golden glow spilling out'),
    'vault_chest_treasure': ('props', 'an ornate open treasure chest overflowing with glowing gems, gold coins and soft magical sparkles rising out'),
    # --- Memory nodes (slightly magical, glowing) ---
    'memory_photo_bloom': ('memory-nodes', 'a magical glowing flower bloom with a softly floating glassy photo-frame petal and gentle sparkles'),
    'memory_landmark_stone': ('memory-nodes', 'a carved standing landmark stone with a smooth softly glowing face beside a small cairn of pebbles'),
    'memory_monument': ('memory-nodes', 'a small triumphant tiered stone monument pedestal with a soft golden glow'),
    'memory_crystal': ('memory-nodes', 'a softly glowing violet memory crystal gem floating just above a small round stone pedestal'),
    'memory_lantern_shrine': ('memory-nodes', 'a cozy little shrine base ringed by several warm glowing paper lanterns'),
    # --- Decals (flat ground patches; rendered between the slab and the props) ---
    'flowers': ('decals', 'a small flat patch of cute colorful wildflowers and little grass tufts'),
    'moss': ('decals', 'a small flat patch of soft green moss with a few tiny pebbles'),
    'grass': ('decals', 'a small flat cluster of green grass blades and tufts'),
    'path': ('decals', 'a small flat patch of a worn light dirt path with a few flat stepping stones'),
    'cobble': ('decals', 'a small flat patch of rounded cobblestones set into the ground'),
    'rock': ('decals', 'a few small flat pebbles and a little rock scattered on the ground'),
    'wood': ('decals', 'a small flat patch of warm wooden deck planks'),
    'glow': ('decals', 'a small flat patch of softly glowing violet magical light and faint sparkles on the ground'),
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


def call(fn, payload, timeout=240):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def generate(key, subject):
    folder = CATALOG[key][0]
    style = DECAL_STYLE if folder == 'decals' else STYLE
    payload = {
        'renderProfile': {
            'id': f'world_{key}',
            'displayName': key,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': key,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'world asset',
            'imagePrompt': f'Isometric game asset of {subject}.{style}{NO_TEXT}',
        }
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
    return 'ok' if all(c == 0 for c in corners) and center > 200 else 'SUSPECT'


def process(key, force):
    folder, subject = CATALOG[key]
    out_path = os.path.join(WORLD_DIR, folder, f'{key}.png')
    if os.path.exists(out_path) and not force:
        return key, 'skip (exists)'
    try:
        url = generate(key, subject)
        matte(key, url, out_path)
        return key, f'done [{verify_alpha(out_path)}]'
    except Exception as exc:  # noqa: BLE001 - report per-item, keep batch going
        return key, f'FAIL: {exc}'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', help='subset of keys')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()

    keys = args.only if args.only else list(CATALOG.keys())
    bad = [k for k in keys if k not in CATALOG]
    if bad:
        sys.exit(f'unknown keys: {bad}')

    print(f'generating {len(keys)} world asset(s) with {args.workers} workers...\n')
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process, key, args.force): key for key in keys}
        for future in as_completed(futures):
            key, status = future.result()
            print(f'  {key:26s} {status}')
            results.append((key, status))

    failed = [r for r in results if r[1].startswith('FAIL')]
    print(f'\n{len(results) - len(failed)}/{len(results)} succeeded.')
    if failed:
        print('failed:', ', '.join(k for k, _ in failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
