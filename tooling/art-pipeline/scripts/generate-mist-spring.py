"""Generate the Mist Spring item maker (encounter v2) through the FAL Nano Banana edit + BiRefNet pipeline.

The Garden Basket is the style reference: the same chunky clay-toy item maker on the merge board. The Spring is a small
round stone well brimming with bright blue water, a couple of Pebbles on its rim. Source and matte are kept under
design/mist-spring-v1 (delete source.png to try again); the cutout goes beside the other item makers.

    python scripts/generate-mist-spring.py
"""
import hashlib, importlib.util, json, sys, urllib.request
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
DESIGN = content_path(ROOT, 'design/mist-spring-v1')
REFERENCE = content_path(ROOT, 'assets/images/katchimeras/merge-world/generators/wild-garden.webp')
OUT = content_path(ROOT, 'assets/images/katchimeras/merge-world/generators/mist-spring.webp')

PROMPT = (
    'Use the reference only for its art style and scale: the same chunky, soft, clay-toy 3D item maker for a cozy merge '
    'game, warm soft lighting, rounded forms, simple readable shapes, the same three-quarter view. Replace the basket '
    'with a DIFFERENT object: ONE small round old stone spring well, low and wide, of soft grey-beige rounded stones, '
    'brimming with bright clear sky-blue water with a gentle ripple and a small bubbling spout in the middle, two small '
    'smooth grey pebbles resting on its rim and a little green moss. It must read instantly as a spring of water that '
    'makes pebbles. Centred and large, the whole object inside the canvas with clear padding. Perfectly flat uniform '
    'light grey #D9D9D9 background for background removal. No floor, no cast shadow, no second object, no text, no '
    'letters, no border, no UI, no watermark.'
)

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)

DESIGN.mkdir(parents=True, exist_ok=True)
source = DESIGN / 'source.png'
matted = DESIGN / 'matte.png'
if not source.exists():
    url = None
    for attempt in range(1, 4):
        try:
            url = generator.generate_queued_tile(output_name='mist-spring', prompt=PROMPT, base_path=REFERENCE, creature_path=None, quality='high', gpt_size=1024, model='nano')
            break
        except (RuntimeError, OSError) as error:
            print(f'  attempt {attempt} failed: {str(error)[:160]}', flush=True)
    if url is None:
        raise SystemExit('No image after three attempts')
    generator.download(url, source)
    data = generator.call_function('remove-image-background', {
        'imageUrl': url, 'outputName': 'mist-spring', 'model': 'BiRefNet_lite',
        'operatingResolution': '1024x1024', 'refineForeground': True,
    }, timeout=180)
    if not data.get('imageUrl'):
        raise SystemExit(f'matte failed: {data}')
    urllib.request.urlretrieve(str(data['imageUrl']), matted)
    (DESIGN / 'generation.json').write_text(json.dumps({
        'model': 'fal-ai/nano-banana-2/edit', 'matte': 'BiRefNet_lite', 'prompt': PROMPT,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
    }, indent=2))

# Sized and padded like the other item makers: the reference's own canvas.
with Image.open(REFERENCE) as reference:
    size = reference.size
with Image.open(matted) as raw:
    cut = raw.convert('RGBA')
box = cut.getchannel('A').point(lambda value: 255 if value > 12 else 0).getbbox()
cut = cut.crop(box)
side = int(max(cut.size) * 1.06)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
canvas.resize(size, Image.Resampling.LANCZOS).save(OUT, format='WEBP', quality=95, method=6)
print(f'wrote {OUT}')
