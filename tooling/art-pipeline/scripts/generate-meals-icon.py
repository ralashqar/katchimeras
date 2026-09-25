"""Generate the Meals currency icon through the existing FAL Nano Banana pipeline.

Meals are the team's food, earned serving orders at Baristabbit's Café and spent training heroes. The Glow swirl is
the style reference (same chunky toy family as the currency icons), but Meals is its own shape and colour: one plump
bowl of warm stew (no steam: a curl above it read as a question mark). Sources and the generation record are kept under design/meals-icon-v1; delete source.png to try
again.

    python scripts/generate-meals-icon.py
"""
import hashlib, importlib.util, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hex_tile_alpha import resize_rgba_premultiplied
from incubator_context import game_root, content_path

ROOT = game_root()
OUT = content_path(ROOT, 'design/meals-icon-v1')
ART = content_path(ROOT, 'assets/images/katchimeras/merge-world/ui/meals-v1.webp')
REFERENCE = content_path(ROOT, 'assets/images/katchimeras/merge-world/ui/glow-swirl-v3.png')
SIZE = 512

PROMPT = (
    'Use the reference only for its art style: one chunky, glossy, cushiony 3D toy icon with soft bevels, a single '
    'soft highlight, large flat colour blocks, very low detail and no texture. Replace the golden swirl with a '
    'DIFFERENT icon: ONE plump round bowl of warm stew seen from a slight three-quarter angle, centred and very large. '
    'The bowl is a solid warm cream with one broad rosy-red band around it; the stew is one smooth rounded golden-orange '
    'mound with two simple round green pea dots on top, heaped slightly above the rim. At most four '
    'colours: cream, rosy red, golden orange, green. No steam, no smoke, no curls, no symbols above the bowl. No spoon, no chopsticks, no table, no pattern, no tiny '
    'details. It must be unmistakable at 20 pixels and clearly different from a golden swirl or wooden logs. Perfectly '
    'flat pure black #000000 background for matting, the whole silhouette inside the canvas with clear padding. No '
    'second object, no ring, no coin, no sparkles, no particles, no aura, no face, no text, no letters, no border, no '
    'UI, no watermark, no floor, no cast shadow.'
)

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)

OUT.mkdir(parents=True, exist_ok=True)
source = OUT / 'source.png'
if not source.exists():
    url = None
    for attempt in range(1, 4):
        try:
            url = generator.generate_queued_tile(output_name='meals-icon', prompt=PROMPT, base_path=REFERENCE, creature_path=None, quality='high', gpt_size=1024, model='nano')
            break
        except (RuntimeError, OSError) as error:
            print(f'  attempt {attempt} failed: {str(error)[:160]}', flush=True)
    if url is None:
        raise SystemExit('No image after three attempts')
    generator.download(url, source)
    (OUT / 'generation.json').write_text(json.dumps({
        'model': 'fal-ai/nano-banana-2/edit', 'prompt': PROMPT,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    }, indent=2))
def lift_off_black(original: Image.Image) -> Image.Image:
    """Take the icon off its black background exactly.

    The matting model keeps the cream bolt and throws the flat cyan drop away with the background. But the background
    is pure black by construction and nothing in the icon is, so no model is needed: over black, a pixel is
    `colour * alpha`, so alpha is how far the pixel is from black (against the darkest the icon itself gets) and the
    colour is the pixel divided by that alpha. Interior pixels stay untouched; only the soft edge is unmixed.
    """
    rgb = np.array(original.convert('RGB')).astype(np.float32)
    alpha = np.clip(rgb.max(axis=2) / 64.0, 0.0, 1.0)
    colour = np.clip(rgb / np.maximum(alpha, 1e-3)[..., None], 0, 255)
    return Image.fromarray(np.dstack([colour, alpha * 255.0]).astype(np.uint8), 'RGBA')


with Image.open(source) as original:
    clean = lift_off_black(original)
    # An icon fills its box: crop to the painted bowl, then centre it with a small even margin.
    box = clean.getchannel('A').point(lambda value: 255 if value > 16 else 0).getbbox()
    drop = clean.crop(box)
    side = int(max(drop.size) * 1.08)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(drop, ((side - drop.width) // 2, (side - drop.height) // 2))
    resize_rgba_premultiplied(canvas, (SIZE, SIZE)).save(ART, format='WEBP', quality=96, method=6)
print(f'wrote {ART}')
