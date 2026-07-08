"""Tile pipeline — turn any tile render into a canonical Kingdom base asset.

    python scripts/tile-pipeline.py --source <image> --key <base_id> --desc "<materials>"

Steps (docs/tile-pipeline.md):
  0. hi-res re-render: gpt image edit reproduces the tile at 2048 (exact
     recreate; background color auto-detected from the source corners)
  1. BiRefNet heavy matte (transparency comes from BiRefNet ONLY)
  2. initial face-quad fit from the silhouette + wall-band corners
  3. corrective homography passes measuring the PAINTED edges in canvas
     space until the corners sit on the canonical diamond (<2px early exit)
  4. clip gate: zero opaque pixels on all four canvas borders, or abort
  5. bundle webp q82 to assets/.../world/base/<key>.webp + QA sheets

After it passes, wire the key in THREE places (see the doc):
  utils/world-visuals.ts WORLD_BASE_SOURCES, constants/world-asset-catalog.ts
  base section, app/dev-tile-lab.tsx BASE_IDS.
"""
import argparse
import base64
import io
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CANVAS = 2048
T0, R0, B0, L0 = (1024.0, 201.0), (1959.0, 949.0), (1024.0, 1697.0), (89.0, 949.0)
W_OFF, H_OFF = 0.4565, 0.3652

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, help='input tile render (any background)')
parser.add_argument('--key', required=True, help='base id, e.g. base_garden_nest')
parser.add_argument('--desc', required=True, help='materials line for the re-render prompt')
parser.add_argument('--skip-rerender', action='store_true', help='matte + warp the source directly')
parser.add_argument('--passes', type=int, default=4)
parser.add_argument('--workdir', default=None)
args = parser.parse_args()

work = args.workdir or os.path.join(tempfile.gettempdir(), 'tile-pipeline', args.key)
os.makedirs(work, exist_ok=True)
OUT = os.path.join(ROOT, 'assets', 'images', 'katchimeras', 'world', 'base', f'{args.key}.webp')

env = {}
for line in open(os.path.join(ROOT, '.env.local'), encoding='utf-8'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
base_url = env['EXPO_PUBLIC_SUPABASE_URL']
key = env['EXPO_PUBLIC_SUPABASE_KEY']


def call_retry(fn, payload, tries=6, timeout=240):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(f'{base_url}/functions/v1/{fn}', data=json.dumps(payload).encode(),
                headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'apikey': key})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as cause:
            print('  retry', fn, attempt + 1, str(cause)[:70])
            time.sleep(8)
    raise RuntimeError(f'{fn} failed after {tries} tries')


def file_b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def background_name(path):
    img = Image.open(path).convert('RGB')
    w, h = img.size
    corners = [img.getpixel(p) for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    mean = np.mean(corners, axis=0)
    if mean.mean() > 200:
        return 'white'
    if mean.mean() < 40:
        return 'black'
    return 'plain'


# --- 0) hi-res re-render (cached) ----------------------------------------------
SRC = os.path.join(work, 'source-2k.png')
if args.skip_rerender:
    SRC = args.source
elif not os.path.exists(SRC):
    bg = background_name(args.source)
    prompt = (
        f'Recreate this exact isometric game ground tile at maximum fidelity: SAME geometry, SAME camera angle, '
        f'SAME proportions, SAME colors and materials — {args.desc}. '
        f'Ultra-crisp, high resolution, premium 3D mascot toy CG render, soft studio lighting. '
        f'Solid pure {bg} background exactly like the reference. '
        f'Do not add, remove, move or restyle any element.'
    )
    out = call_retry('generate-asset', {'action': 'generate', 'model': 'gpt', 'mode': 'single',
                                        'gptImageSize': 2048, 'outputName': args.key.replace('_', '-'),
                                        'prompt': prompt, 'referenceBase64': file_b64(args.source),
                                        'referenceMime': 'image/png'})
    request_id = out.get('requestId')
    print('submitted re-render', request_id)
    image_url = None
    while image_url is None:
        time.sleep(15)
        try:
            poll = call_retry('generate-asset', {'action': 'poll', 'model': 'gpt', 'mode': 'single',
                                                 'outputName': args.key.replace('_', '-'),
                                                 'requestId': request_id, 'rawResult': True}, tries=1)
        except RuntimeError:
            continue
        print('re-render', poll.get('status'), poll.get('queueStatus', ''))
        if poll.get('status') == 'completed':
            image_url = poll['imageUrl']
    with urllib.request.urlopen(image_url, timeout=300) as resp:
        data = resp.read()
    with open(SRC, 'wb') as f:
        f.write(data)
print('source', Image.open(SRC).size)

# --- 1) BiRefNet heavy matte (cached) --------------------------------------------
matte_path = os.path.join(work, 'matted.png')
if not os.path.exists(matte_path):
    matte = call_retry('remove-image-background', {
        'imageBase64': file_b64(SRC),
        'outputName': args.key.replace('_', '-') + '-matte',
        'model': 'General Use (Heavy)',
        'operatingResolution': '2048x2048',
        'refineForeground': True,
    })
    assert matte.get('status') == 'completed', matte
    with urllib.request.urlopen(matte['imageUrl'], timeout=180) as resp:
        rgba = Image.open(io.BytesIO(resp.read())).convert('RGBA')
    if rgba.size != (CANVAS, CANVAS):
        rgba = rgba.resize((CANVAS, CANVAS), Image.LANCZOS)
    rgba.save(matte_path)
rgba = Image.open(matte_path).convert('RGBA')

# Hole fill: a ground tile is SOLID — BiRefNet sometimes hallucinates holes
# and semi-transparent smudges in enclosed regions (a grass circle ringed by
# paving reads as "background"). Flood the NOT-fully-opaque mask from the
# borders: whatever it reaches is genuine outside (incl. the anti-aliased
# silhouette edge, which stays soft); every unreached low-alpha pixel is
# interior and gets restored from the source render. Only ever ADDS pixels.
alpha_arr = np.asarray(rgba.getchannel('A')).copy()
not_opaque = alpha_arr < 250
outside = np.zeros_like(not_opaque)
outside[0, :] = not_opaque[0, :]
outside[-1, :] = not_opaque[-1, :]
outside[:, 0] = not_opaque[:, 0]
outside[:, -1] = not_opaque[:, -1]
while True:
    grown = outside.copy()
    grown[1:, :] |= outside[:-1, :]
    grown[:-1, :] |= outside[1:, :]
    grown[:, 1:] |= outside[:, :-1]
    grown[:, :-1] |= outside[:, 1:]
    grown &= not_opaque
    if grown.sum() == outside.sum():
        break
    outside = grown
holes = not_opaque & ~outside
if holes.sum() > 0:
    print('hole fill: restoring', int(holes.sum()), 'px from the source render')
    source_rgb = np.asarray(Image.open(SRC).convert('RGB').resize((CANVAS, CANVAS), Image.LANCZOS))
    fixed = np.asarray(rgba).copy()
    fixed[..., :3] = np.where(holes[..., None], source_rgb, fixed[..., :3])
    fixed[..., 3] = np.where(holes, 255, fixed[..., 3])
    rgba = Image.fromarray(fixed)
print('matted', rgba.size)


def robust_line(xs, ys):
    slope, intercept = np.polyfit(xs, ys, 1)
    for _ in range(2):
        residual = np.abs(ys - (slope * xs + intercept))
        keep = residual < max(3.0, 2.0 * residual.std())
        xs, ys = xs[keep], ys[keep]
        slope, intercept = np.polyfit(xs, ys, 1)
    return slope, intercept


# --- 2) initial quad --------------------------------------------------------------
arr = np.asarray(rgba)
mask = arr[..., 3] > 128
w, h = rgba.size
top_y = np.array([np.argmax(mask[:, x]) if mask[:, x].any() else -1 for x in range(w)])
cols = np.where(mask.any(axis=0))[0]
x_min, x_max = int(cols[0]), int(cols[-1])
apex_x = int(np.argmin(np.where(top_y >= 0, top_y, 10 ** 9)))


def top_edge(x_from, x_to):
    xs = np.arange(int(x_from), int(x_to))
    xs = xs[top_y[xs] >= 0]
    return robust_line(xs.astype(float), top_y[xs].astype(float))


span_l, span_r = apex_x - x_min, x_max - apex_x
lm, lc = top_edge(x_min + span_l * 0.18, apex_x - span_l * 0.18)
rm, rc = top_edge(apex_x + span_r * 0.18, x_max - span_r * 0.18)

left_bound = np.array([np.argmax(mask[y]) if mask[y].any() else w for y in range(h)])
right_bound = np.array([w - 1 - np.argmax(mask[y][::-1]) if mask[y].any() else -1 for y in range(h)])
Ly_est = lm * x_min + lc
Ry_est = rm * x_max + rc
band_l = np.arange(int(Ly_est + 60), int(Ly_est + 160))
band_r = np.arange(int(Ry_est + 60), int(Ry_est + 160))
Lx = float(np.median(left_bound[band_l][left_bound[band_l] < w]))
Rx = float(np.median(right_bound[band_r][right_bound[band_r] >= 0]))
L = (Lx, lm * Lx + lc)
R = (Rx, rm * Rx + rc)
t_x = (rc - lc) / (lm - rm)
T = (float(t_x), float(lm * t_x + lc))

bottom_y = np.array([h - 1 - np.argmax(mask[:, x][::-1]) if mask[:, x].any() else -1 for x in range(w)])
valid = np.where(bottom_y >= 0)[0]
b_apex = int(np.argmax(np.where(bottom_y >= 0, bottom_y, -1)))
span_bl, span_br = b_apex - valid[0], valid[-1] - b_apex


def bottom_edge(x_from, x_to):
    xs = np.arange(int(x_from), int(x_to))
    xs = xs[bottom_y[xs] >= 0]
    return robust_line(xs.astype(float), bottom_y[xs].astype(float))


blm, blc = bottom_edge(valid[0] + span_bl * 0.2, b_apex - span_bl * 0.2)
brm, brc = bottom_edge(b_apex + span_br * 0.2, valid[-1] - span_br * 0.2)
h_wall = ((blm * L[0] + blc - L[1]) + (brm * R[0] + brc - R[1])) / 2
b_x = ((brc - h_wall) - (blc - h_wall)) / (blm - brm)
B = (float(b_x), float(blm * b_x + blc - h_wall))
print('initial quad wall', round(h_wall, 1))


def perspective_coeffs(dest_pts, src_pts):
    matrix = []
    for (dx, dy), (sx, sy) in zip(dest_pts, src_pts):
        matrix.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        matrix.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    A = np.array(matrix, dtype=float)
    rhs = np.array([c for p in src_pts for c in p], dtype=float)
    return np.linalg.solve(A, rhs)


current = rgba.transform((CANVAS, CANVAS), Image.PERSPECTIVE,
                         tuple(perspective_coeffs([T0, R0, B0, L0], [T, R, B, L])), resample=Image.BICUBIC)

# --- 3) corrective passes -----------------------------------------------------------
for pass_index in range(args.passes):
    carr = np.asarray(current)
    calpha = carr[..., 3] > 128
    clum = carr[..., :3].astype(np.float32).mean(axis=2)
    clum[~calpha] = np.nan
    ctop = np.full(CANVAS, -1)
    for x in range(CANVAS):
        col = calpha[:, x]
        if col.any():
            ctop[x] = np.argmax(col)

    def c_top_edge(x_from, x_to):
        xs = np.arange(int(x_from), int(x_to))
        xs = xs[ctop[xs] >= 0]
        return robust_line(xs.astype(float), ctop[xs].astype(float))

    ul = c_top_edge(L0[0] + 0.2 * (T0[0] - L0[0]), T0[0] - 0.2 * (T0[0] - L0[0]))
    ur = c_top_edge(T0[0] + 0.2 * (R0[0] - T0[0]), R0[0] - 0.2 * (R0[0] - T0[0]))

    def c_lower_edge(corner_a, corner_b):
        xs, ys = [], []
        for t in np.linspace(0.18, 0.82, 46):
            x = int(round(corner_a[0] + t * (corner_b[0] - corner_a[0])))
            y_line = corner_a[1] + t * (corner_b[1] - corner_a[1])
            lo, hi = int(y_line - 45), int(y_line + 45)
            profile = clum[lo:hi, x]
            ok = ~np.isnan(profile)
            if ok.sum() < 60:
                continue
            filled = profile.copy()
            idxs = np.where(ok, np.arange(len(profile)), -1)
            np.maximum.accumulate(idxs, out=idxs)
            idxs[idxs < 0] = int(np.argmax(ok))
            filled = filled[idxs]
            smooth = np.convolve(filled, np.ones(5) / 5, mode='same')
            gradient = np.diff(smooth)
            ys.append(float(lo + int(np.argmin(gradient[8:-8])) + 8))
            xs.append(float(x))
        return robust_line(np.array(xs), np.array(ys))

    ll = c_lower_edge(B0, L0)
    lr = c_lower_edge(B0, R0)

    def isect(a, bl):
        x = (bl[1] - a[1]) / (a[0] - bl[0])
        return (float(x), float(a[0] * x + a[1]))

    Tm, Lm, Rm, Bm = isect(ul, ur), isect(ul, ll), isect(ur, lr), isect(ll, lr)
    err = max(abs(Tm[0] - T0[0]), abs(Tm[1] - T0[1]), abs(Rm[0] - R0[0]), abs(Rm[1] - R0[1]),
              abs(Lm[0] - L0[0]), abs(Lm[1] - L0[1]), abs(Bm[0] - B0[0]), abs(Bm[1] - B0[1]))
    print(f'pass {pass_index + 1} max corner err {err:.1f}px')
    if err > 300:
        print(f'pass {pass_index + 1} SKIPPED (measurement rejected)')
        continue
    if err < 2.0:
        print('geometry canonical — done correcting')
        break
    current = current.transform((CANVAS, CANVAS), Image.PERSPECTIVE,
                                tuple(perspective_coeffs([T0, R0, B0, L0], [Tm, Rm, Bm, Lm])),
                                resample=Image.BICUBIC)

# --- 4) clip gate --------------------------------------------------------------------
a = np.asarray(current.getchannel('A')) > 8
borders = int(a[0].sum() + a[-1].sum() + a[:, 0].sum() + a[:, -1].sum())
rows = np.where(a.any(axis=1))[0]
cols2 = np.where(a.any(axis=0))[0]
print('alpha bbox rows', rows[0], rows[-1], 'cols', cols2[0], cols2[-1], '| border opaque px', borders)
if borders > 0:
    print('CLIP GATE FAILED — content would be cut; NOT bundling.')
    sys.exit(1)

# --- 5) bundle + QA -------------------------------------------------------------------
current.save(os.path.join(work, 'final.png'))
current.save(OUT, format='WEBP', quality=82)
print('bundled', OUT, os.path.getsize(OUT) // 1024, 'KB')

solo = Image.new('RGB', (CANVAS, CANVAS), (18, 22, 40))
solo.paste(current, (0, 0), current)
solo.thumbnail((1100, 1100), Image.LANCZOS)
solo.save(os.path.join(work, 'qa-solo.png'))

step_x, step_y = W_OFF * CANVAS, H_OFF * CANVAS
sheet_size = int(CANVAS * 2.1)
sheet = Image.new('RGB', (sheet_size, sheet_size), (18, 22, 40))
origin = (sheet_size / 2 - CANVAS / 2 - step_x / 2, sheet_size / 2 - CANVAS / 2)
for ne, se in [(1, 0), (0, 0), (1, 1), (0, 1)]:
    px = origin[0] + ne * step_x + se * step_x
    py = origin[1] - ne * step_y + se * step_y
    sheet.paste(current, (int(px), int(py)), current)
c1x = int(origin[0] + CANVAS / 2 + step_x / 2)
c1y_ne = int(origin[1] + CANVAS * 0.4635 - step_y / 2)
c1y_se = int(origin[1] + CANVAS * 0.4635 + step_y / 2)
crop_ne = sheet.crop((c1x - 340, c1y_ne - 340, c1x + 340, c1y_ne + 340)).resize((640, 640), Image.LANCZOS)
crop_se = sheet.crop((c1x - 340, c1y_se - 340, c1x + 340, c1y_se + 340)).resize((640, 640), Image.LANCZOS)
qa = Image.new('RGB', (1300, 660), (18, 22, 40))
qa.paste(crop_ne, (5, 10))
qa.paste(crop_se, (655, 10))
qa.save(os.path.join(work, 'qa-seams.png'))
sheet.thumbnail((1400, 1400), Image.LANCZOS)
sheet.save(os.path.join(work, 'qa-tessellation.png'))
print('QA sheets in', work)
print('DONE')
