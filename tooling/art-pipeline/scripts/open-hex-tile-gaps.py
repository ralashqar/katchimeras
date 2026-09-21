"""Re-open real gaps the hex pipeline's interior restore filled with black (an arch you can see through).

The restore gives back every area the object encloses, which is right for a flat pale surface the matting model cut
out, and wrong for a true opening, which it paints with the source's black background. The background is pure black
by construction, so a restored pixel is kept only where the source has colour there. Run between `matte` and `package`:

    python scripts/open-hex-tile-gaps.py --tile rush-track
"""
import argparse, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

parser = argparse.ArgumentParser()
parser.add_argument('--tile', required=True)
args = parser.parse_args()
ROOT = game_root()
folder = content_path(ROOT, f'design/shared-world-discovery-v2/{args.tile}')
work = ROOT / '.tmp' / 'shared-world-discovery-v2' / args.tile
final = Image.open(folder / 'alpha.png').convert('RGBA')
raw = Image.open(work / 'matted.png').convert('RGBA').resize(final.size, Image.LANCZOS)
source = Image.open(folder / 'source.png').convert('RGB').resize(final.size, Image.LANCZOS)
pixels = np.array(final)
restored = (pixels[..., 3] > 0) & (np.array(raw)[..., 3] < 128)
presence = np.clip((np.array(source).max(axis=2).astype(np.float32) - 20.0) / 40.0, 0.0, 1.0)
opened = restored & (presence < 1.0)
pixels[..., 3] = np.where(opened, (pixels[..., 3] * presence).astype(np.uint8), pixels[..., 3])
Image.fromarray(pixels, 'RGBA').save(folder / 'alpha.png')
print(f'opened {int(opened.sum())} px of filled gap in {folder / "alpha.png"}')
