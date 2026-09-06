from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Generate level-up GRID art for the notes + photos objects.

One FAL render per family = a 2x2 grid of the four growth stages (kept visually
consistent because they're one image), matted (BiRefNet), then each quadrant is
sliced out and reframed to the renderer's 384x768 bottom-snapped frame.

Usage:
  python scripts/generate-world-grids.py            # both families
  python scripts/generate-world-grids.py --only memory_tree
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image

ROOT = str(game_root())
PROPS_DIR = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', 'props'))
TMP_DIR = str(content_path(ROOT, 'assets', 'images', 'katchimeras', 'world', '_grids'))

GRID_STYLE = (
    ' Arrange them in a clean 2x2 grid, exactly four cells, ONE object per cell, each object small '
    'and fully contained well inside its own cell with generous empty margin around it and large '
    'gaps between cells so nothing touches or overlaps a neighbour. Every object: 2:1 dimetric '
    'isometric three-quarter top-down view, floating with NO ground tile and NO cast shadow, '
    'consistent identical art style / scale / lighting across all four, soft sunlight from the '
    'upper-left, premium stylized 3D mascot-world render, cozy magical cottagecore mood, soft warm '
    'pastel palette, clean tactile materials, subtle inner glow, plain flat pale neutral studio '
    'background. Absolutely no text, numbers, letters, labels, captions or UI anywhere.'
)

FAMILIES = {
    # Photos = accumulating visual memories. A cozy magical "memory lantern tree"
    # hung with glowing framed photos — grows fuller as more photos are captured.
    'memory_tree': {
        'keys': ['memory_tree_1', 'memory_tree_2', 'memory_tree_3', 'memory_tree_4'],
        'prompt': (
            'Four growth stages of the SAME cozy magical memory-photo tree game prop, a small tree '
            'whose hanging fruit are little glowing framed photographs (glowing photo-lanterns). '
            'Top-left cell: stage one, a tiny sapling in a small clay pot with ONE small glowing '
            'framed photo hanging from it. Top-right cell: stage two, a small young tree with a FEW '
            '(about three) glowing framed photos hanging. Bottom-left cell: stage three, a fuller '
            'leafy tree laden with MANY warm glowing framed photos. Bottom-right cell: stage four, '
            'a radiant lush magical tree overflowing with glowing framed photos and soft floating '
            'sparkles of light.'
        ),
    },
    # Notes = written + spoken thoughts. A cozy journaling / letters family that
    # grows from a single open diary into a little writing-desk shrine.
    'notes_journal': {
        'keys': ['notes_journal_1', 'notes_journal_2', 'notes_journal_3', 'notes_journal_4'],
        'prompt': (
            'Four growth stages of the SAME cozy journaling game prop. Top-left cell: stage one, a '
            'single small open journal book with a feather quill resting on it. Top-right cell: '
            'stage two, an open journal resting on two stacked closed books with a feather quill in '
            'a small inkpot. Bottom-left cell: stage three, a cozy stack of journals and a few tied '
            'rolled parchment scrolls with a quill in an inkpot. Bottom-right cell: stage four, a '
            'little writing-desk shrine of neatly stacked books, rolled scrolls, a softly glowing '
            'inkpot and a few gently floating letters and pages.'
        ),
    },
}

FRAME_W, FRAME_H = 384, 768
BASE_Y = 0.96  # content bottom sits here down the frame
MAX_W, MAX_H = 0.74, 0.62  # how much of the frame an object may fill


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
        raise RuntimeError(f'{fn} HTTP {exc.code}: {body[:500]}') from None


def generate(name, prompt):
    payload = {
        'renderProfile': {
            'id': f'grid_{name}',
            'displayName': name,
            'topLevelType': 'concept',
            'triggerCategory': 'asset',
            'triggerSubtype': name,
            'theme': 'asset',
            'creatureKind': 'asset',
            'caption': 'world grid',
            'imagePrompt': f'A four-panel sprite sheet of game assets. {prompt}{GRID_STYLE}',
        }
    }
    rec = call('generate-katchimera-art', payload).get('record', {})
    if rec.get('status') != 'succeeded' and not rec.get('image_url'):
        raise RuntimeError(f'generate failed: {rec.get("status")}')
    url = rec['image_url']
    os.makedirs(TMP_DIR, exist_ok=True)
    urllib.request.urlretrieve(url, os.path.join(TMP_DIR, f'{name}_raw.png'))
    return url


def matte(name, *, image_url=None, raw_path=None):
    out_name = f'grid-{name}'.replace('_', '-')  # outputName must be [a-z0-9-]+
    if raw_path is not None:
        with open(raw_path, 'rb') as handle:
            payload = {'imageBase64': base64.b64encode(handle.read()).decode(), 'outputName': out_name}
    else:
        payload = {'imageUrl': image_url, 'outputName': out_name}
    data = call('remove-image-background', payload)
    matted_url = data.get('imageUrl')
    if not matted_url:
        raise RuntimeError(f'matte failed: {data}')
    os.makedirs(TMP_DIR, exist_ok=True)
    path = os.path.join(TMP_DIR, f'{name}.png')
    urllib.request.urlretrieve(matted_url, path)
    return path


def reframe_cell(cell):
    bbox = cell.getbbox()
    if not bbox:
        return None
    content = cell.crop(bbox)
    cw, ch = content.size
    scale = min((FRAME_W * MAX_W) / cw, (FRAME_H * MAX_H) / ch)
    sized = content.resize((max(1, round(cw * scale)), max(1, round(ch * scale))), Image.LANCZOS)
    frame = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
    frame.alpha_composite(sized, ((FRAME_W - sized.width) // 2, round(FRAME_H * BASE_Y) - sized.height))
    return frame


def slice_grid(matted_path, keys):
    img = Image.open(matted_path).convert('RGBA')
    w, h = img.size
    hw, hh = w // 2, h // 2
    quads = [(0, 0), (hw, 0), (0, hh), (hw, hh)]  # TL, TR, BL, BR
    out = []
    for (qx, qy), key in zip(quads, keys):
        cell = img.crop((qx, qy, qx + hw, qy + hh))
        frame = reframe_cell(cell)
        if frame is None:
            out.append(f'{key}: EMPTY quadrant')
            continue
        frame.save(os.path.join(PROPS_DIR, f'{key}.png'))
        out.append(f'{key}: ok {frame.split()[3].getbbox()}')
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', help='subset of family names')
    parser.add_argument('--from-raw', action='store_true', help='matte the saved *_raw.png instead of re-rendering')
    args = parser.parse_args()
    names = args.only if args.only else list(FAMILIES.keys())
    for name in names:
        fam = FAMILIES[name]
        print(f'\n== {name} ==')
        if args.from_raw:
            path = matte(name, raw_path=os.path.join(TMP_DIR, f'{name}_raw.png'))
        else:
            url = generate(name, fam['prompt'])
            print('  generated:', url[:80])
            path = matte(name, image_url=url)
        print('  matted:', path)
        for line in slice_grid(path, fam['keys']):
            print('   ', line)


if __name__ == '__main__':
    main()
