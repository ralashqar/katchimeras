# Reusable prop iso-alignment pipeline: regenerate world objects so they sit
# on the Kingdom's isometric camera (ground axes at the canonical 0.8 slope,
# verticals vertical), using a procedural guide passed to GPT Image 2 edit
# alongside each prop.
#
#   python scripts/iso-align-prop.py --list                     # show asset keys
#   python scripts/iso-align-prop.py --asset home               # one registered asset
#   python scripts/iso-align-prop.py --asset home,crossroads    # batch (parallel queue)
#   python scripts/iso-align-prop.py --source <img> --name x    # arbitrary file
#
# Asset keys resolve from utils/world-visuals.ts require() lines, so the tool
# follows the app's registry automatically. Outputs land in design/props/:
# <name>-iso-guide.png, <name>-aligned.png, <name>-aligned-matted.png, and a
# before/after contact sheet per run. Registration/replacement of app assets
# stays a human decision after QA.

import argparse
import base64
import io
import json
import os
import re
import sys
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'design', 'props')
VISUALS_TS = os.path.join(ROOT, 'utils', 'world-visuals.ts')
SLOPE = 0.8  # the canonical diamond slope — ground axes render at +-0.8


def registered_assets():
    # key -> repo-relative path, parsed from world-visuals.ts require() lines.
    text = open(VISUALS_TS, encoding='utf-8').read()
    out = {}
    for key, rel in re.findall(r"(\w+):\s*require\('\.\./(assets/[^']+)'\)", text):
        out.setdefault(key, rel)
    return out


def build_guide(size, footprint_cells, cell_px, height_px, shape='diamond'):
    img = Image.new('RGB', (size, size), (0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size * 0.62  # footprint centre sits low; cage rises above
    ax = (cell_px, cell_px * SLOPE)      # ground axis a (down-right)
    bx = (-cell_px, cell_px * SLOPE)     # ground axis b (down-left)

    def ground(a, b):
        return (cx + a * ax[0] + b * bx[0], cy + a * ax[1] + b * bx[1])

    n = 4
    for i in range(-n, n + 1):
        d.line([ground(i, -n), ground(i, n)], fill=(60, 60, 60), width=2)
        d.line([ground(-n, i), ground(n, i)], fill=(60, 60, 60), width=2)

    if shape == 'circle':
        # Round footprint: iso ground circle (ellipse, vertical axis x0.8) —
        # for objects with round bases the diamond footprint would square off.
        rx = (2 ** 0.5) * (footprint_cells / 2) * cell_px
        ry = rx * SLOPE
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(255, 255, 255), width=8)
        d.ellipse([cx - rx, cy - ry - height_px, cx + rx, cy + ry - height_px], outline=(170, 170, 170), width=5)
        d.line([(cx - rx, cy), (cx - rx, cy - height_px)], fill=(170, 170, 170), width=5)
        d.line([(cx + rx, cy), (cx + rx, cy - height_px)], fill=(170, 170, 170), width=5)
        return img

    h = footprint_cells / 2
    corners = [ground(-h, -h), ground(h, -h), ground(h, h), ground(-h, h)]
    d.line(corners + [corners[0]], fill=(255, 255, 255), width=8)

    top = [(x, y - height_px) for x, y in corners]
    for (bx_, by_), (tx_, ty_) in zip(corners, top):
        d.line([(bx_, by_), (tx_, ty_)], fill=(170, 170, 170), width=5)
    d.line(top + [top[0]], fill=(170, 170, 170), width=5)
    return img


def flood_matte(img_rgb):
    rgb = np.asarray(img_rgb).astype(np.int16)
    h, w, _ = rgb.shape
    near_black = rgb.max(axis=2) < 28
    bg = np.zeros((h, w), dtype=bool)
    bg[0, :] = near_black[0, :]
    bg[-1, :] = near_black[-1, :]
    bg[:, 0] = near_black[:, 0]
    bg[:, -1] = near_black[:, -1]
    while True:
        grown = bg.copy()
        grown[1:, :] |= bg[:-1, :]
        grown[:-1, :] |= bg[1:, :]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        grown &= near_black
        if grown.sum() == bg.sum():
            break
        bg = grown
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    feathered = np.asarray(Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(1)))
    alpha = np.where(bg & (feathered < 8), 0, np.where(~bg & (feathered > 247), 255, feathered)).astype(np.uint8)
    return Image.merge('RGBA', (*img_rgb.split(), Image.fromarray(alpha, 'L')))


def b64_png(img, size=1024):
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


def flatten_on_black(path):
    src = Image.open(path).convert('RGBA')
    flat = Image.new('RGBA', src.size, (0, 0, 0, 255))
    flat.alpha_composite(src)
    return flat.convert('RGB')


def make_prompt(subject, shape='diamond'):
    footprint = 'bright diamond' if shape == 'diamond' else 'bright ellipse (an isometric ground circle)'
    fill_rule = (
        'the base/footprint sits exactly on the ' + footprint + ' and fills it, '
        + ('the walls and base edges run PARALLEL to the grid directions (the two diagonal grid axes), '
           if shape == 'diamond'
           else 'the base KEEPS ITS ORIGINAL SHAPE (round stays round) seated within the ellipse, ')
    )
    return (
        f'The first image is a {subject} from our game. The second image is an ISOMETRIC CAMERA GUIDE: '
        f'a ground grid, a {footprint} marking the footprint, and a wireframe cage showing the projection. '
        f'Redraw the SAME {subject} — same design, colors, materials, style, details — but re-projected to EXACTLY match '
        f'the guide camera: {fill_rule}'
        'all vertical edges stay perfectly vertical, and the overall view direction matches the wireframe cage. '
        'Premium 3D mascot toy CG rendering, soft studio lighting. '
        'Pure solid black background. Do not draw any of the guide lines, grid, footprint or cage in the output.'
    )


def contact_sheet(jobs, path):
    # One row per prop: original | aligned.
    cell = 460
    rows = len(jobs)
    sheet = Image.new('RGB', (cell * 2 + 30, rows * (cell + 40) + 10), (24, 20, 34))
    draw = ImageDraw.Draw(sheet)
    for row, job in enumerate(jobs):
        y = 10 + row * (cell + 40)
        for col, img_path in enumerate([job['source_abs'], job['matted']]):
            img = Image.open(img_path).convert('RGBA')
            thumb = img.copy()
            thumb.thumbnail((cell - 20, cell - 20), Image.LANCZOS)
            panel = Image.new('RGBA', (cell, cell), (24, 20, 34, 255))
            panel.alpha_composite(thumb, ((cell - thumb.width) // 2, (cell - thumb.height) // 2))
            sheet.paste(panel.convert('RGB'), (10 + col * (cell + 10), y))
        draw.text((10 + cell // 2, y + cell + 6), f'{job["name"]} (original)', fill=(140, 150, 184), anchor='ma')
        draw.text((20 + cell + cell // 2, y + cell + 6), 'iso-aligned', fill=(255, 195, 107), anchor='ma')
    sheet.save(path)
    print('contact sheet:', path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true', help='print registered asset keys and exit')
    parser.add_argument('--asset', help='comma-separated registered asset key(s) from world-visuals.ts')
    parser.add_argument('--source', help='arbitrary image path (single mode; needs --name)')
    parser.add_argument('--name', help='output slug for --source mode')
    parser.add_argument('--subject', help='what the prop is (single-run override; batch derives from key)')
    parser.add_argument('--footprint', type=int, default=3, help='footprint size in grid cells')
    parser.add_argument('--footprint-shape', choices=['diamond', 'circle'], default='diamond')
    parser.add_argument('--gpt-size', type=int, default=1024)
    args = parser.parse_args()

    assets = registered_assets()
    if args.list:
        for key in sorted(assets):
            print(f'{key:26s} {assets[key]}')
        return

    # Build the job list.
    jobs = []
    if args.asset:
        for key in [k.strip() for k in args.asset.split(',') if k.strip()]:
            if key not in assets:
                sys.exit(f'unknown asset key: {key} (use --list)')
            jobs.append({'name': key, 'source_abs': os.path.join(ROOT, assets[key]),
                         'subject': args.subject or f'{key.replace("_", " ")} game building/object'})
    if args.source:
        if not args.name:
            sys.exit('--source needs --name')
        jobs.append({'name': args.name, 'source_abs': os.path.join(ROOT, args.source),
                     'subject': args.subject or 'game building/object'})
    if not jobs:
        sys.exit('nothing to do: pass --asset or --source (or --list)')

    os.makedirs(OUT_DIR, exist_ok=True)
    env = {}
    for line in open(os.path.join(ROOT, '.env.local'), encoding='utf-8'):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    url = env['EXPO_PUBLIC_SUPABASE_URL'] + '/functions/v1/generate-asset'
    key = env['EXPO_PUBLIC_SUPABASE_KEY']

    def call(payload):
        req = urllib.request.Request(url, data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'apikey': key})
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())

    guide = build_guide(1024, args.footprint, cell_px=95, height_px=int(95 * args.footprint * 1.15), shape=args.footprint_shape)
    guide_b64 = b64_png(guide)

    # Submit everything first (fal queues run in parallel), then poll the set.
    # outputName must be [a-z0-9-]+ for the edge fn — sanitize (underscores!).
    for job in jobs:
        job['outputName'] = re.sub(r'[^a-z0-9-]+', '-', f'iso-align-{job["name"].lower()}').strip('-')
        guide.save(os.path.join(OUT_DIR, f'{job["name"]}-iso-guide.png'))
        try:
            out = call({'action': 'generate', 'model': 'gpt', 'mode': 'single', 'gptImageSize': args.gpt_size,
                        'outputName': job['outputName'], 'prompt': make_prompt(job['subject'], args.footprint_shape),
                        'referenceBase64': b64_png(flatten_on_black(job['source_abs'])), 'referenceMime': 'image/png',
                        'guideBase64': guide_b64, 'guideMime': 'image/png'})
            job['requestId'] = out.get('requestId')
            print('submitted', job['name'], '->', job['requestId'])
        except Exception as cause:
            print('SUBMIT FAILED', job['name'], '-', cause)

    pending = {job['name']: job for job in jobs if job.get('requestId')}
    for i in range(60):
        if not pending:
            break
        time.sleep(20)
        for name in list(pending):
            job = pending[name]
            out = call({'action': 'poll', 'model': 'gpt', 'mode': 'single',
                        'outputName': job['outputName'], 'requestId': job['requestId']})
            print(i, name, out.get('status'), out.get('queueStatus', ''))
            if out.get('status') == 'completed':
                raw_path = os.path.join(OUT_DIR, f'{name}-aligned.png')
                urllib.request.urlretrieve(out['gridUrl'], raw_path)
                matted = flood_matte(Image.open(raw_path).convert('RGB'))
                job['matted'] = os.path.join(OUT_DIR, f'{name}-aligned-matted.png')
                matted.save(job['matted'])
                print('done', name, '->', job['matted'])
                del pending[name]
    if pending:
        sys.exit(f'timed out waiting for: {", ".join(pending)}')

    contact_sheet(jobs, os.path.join(OUT_DIR, f'contact-{"-".join(j["name"] for j in jobs)[:60]}.png'))


if __name__ == '__main__':
    main()
