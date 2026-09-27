"""Generate the Spark chain (the Storm Pot's plants, `docs/lanes-variety-design.md`) through FAL Nano Banana edit + BiRefNet.

The Lanes battle's second chain. A Spark plant does not shoot up its column: every so often it zaps the nearest wisp
within a cell or two, in any direction, and from the Thunder Bulb the zap jumps on to another. So each is drawn as a
plant that plainly holds electricity: a glass bulb or coil where the garden shooters have an open mouth. The reference
is the garden shooter of the same tier (the project's own chunky clay-toy merge item: its style, scale, lighting and
soil mound), so the two chains sit side by side on the board.

Sources, mattes and the generation record live under design/storm-chain-v1/<tier> (delete a source to try again);
runtime cutouts go beside the other items as nature-storm-<tier>.webp, with a contact sheet for review.

    python scripts/generate-storm-chain.py              # everything not yet generated
    python scripts/generate-storm-chain.py tier-3       # just these
"""
import hashlib, importlib.util, json, sys, urllib.request
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
DESIGN = content_path(ROOT, 'design/storm-chain-v1')
ITEMS = content_path(ROOT, 'assets/images/katchimeras/merge-world/items')

STYLE = (
    'Use the reference only for its art style, scale, lighting and camera: the same chunky, soft, glossy clay-toy 3D '
    'merge item for a cozy merge game, the same three-quarter top-down view, the same round brown soil mound base with '
    'a couple of small grey pebbles, warm soft lighting, rounded forms, simple readable shapes. Replace the plant with '
    'a DIFFERENT one, an ELECTRIC storm plant in deep stormy blue, violet and bright electric yellow, so it reads at a '
    'glance as a plant that zaps with lightning, not one that shoots. It has NO open mouth or tube. Draw exactly this: '
)
SUFFIX = (
    ' Centred and large, the whole object inside the canvas with clear padding. Perfectly flat uniform light grey '
    '#D9D9D9 background for background removal. No floor, no cast shadow, no second object, no projectile, no text, '
    'no letters, no border, no UI, no watermark.'
)
# Each tier: the garden piece it sits beside (the style reference), and what it is.
TIERS = {
    'tier-1': ('nature-garden-1-seed.webp', 'nature-storm-1.webp',
               'a SPARK SEED: one plump glossy seed in bright electric yellow with a zig-zag lightning-bolt stripe '
               'down it, a single tiny blue-white spark crackling on its tip, sitting on the soil mound. The smallest.'),
    'tier-2': ('nature-garden-2-shooter.webp', 'nature-storm-2.webp',
               'a STATIC SPROUT: a small young sprout with two stormy blue-violet leaves and a short stem topped by a '
               'little round clear glass bulb with a tiny yellow spark flickering inside.'),
    'tier-3': ('nature-garden-3-shooter.webp', 'nature-storm-3.webp',
               'a THUNDER BULB: a plump round translucent violet flower bulb, closed like a lantern, glowing from '
               'within, with two little forks of bright yellow lightning arcing between its petals, on blue leaves.'),
    'tier-4': ('nature-garden-4-shooter.webp', 'nature-storm-4.webp',
               'a STORM LILY: a tall elegant deep-blue lily whose curled petal tips each end in a small copper coil, '
               'bright yellow sparks leaping between the coils, a glowing electric-yellow heart. Grander than the bulb.'),
    'tier-5': ('nature-garden-5-shooter.webp', 'nature-storm-5.webp',
               'a TEMPEST BLOOM: a big magnificent storm flower with a tiny friendly round thundercloud floating just '
               'above its open crystal-violet petals, a soft bolt of yellow lightning joining the cloud to the flower '
               'heart, blue and violet leaves. The grandest of the chain.'),
}

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)


def generate(name: str, reference: Path, prompt: str) -> Path:
    folder = DESIGN / name
    folder.mkdir(parents=True, exist_ok=True)
    source, matted = folder / 'source.png', folder / 'matte.png'
    if source.exists() and matted.exists():
        return matted
    url = None
    for attempt in range(1, 4):
        try:
            url = generator.generate_queued_tile(output_name=f'storm-chain-{name}', prompt=prompt, base_path=reference, creature_path=None, quality='high', gpt_size=1024, model='nano')
            break
        except (RuntimeError, OSError) as error:
            print(f'  {name}: attempt {attempt} failed: {str(error)[:160]}', flush=True)
    if url is None:
        raise SystemExit(f'{name}: no image after three attempts')
    generator.download(url, source)
    data = generator.call_function('remove-image-background', {
        'imageUrl': url, 'outputName': f'storm-chain-{name}', 'model': 'BiRefNet_lite',
        'operatingResolution': '1024x1024', 'refineForeground': True,
    }, timeout=180)
    if not data.get('imageUrl'):
        raise SystemExit(f'{name}: matte failed: {data}')
    urllib.request.urlretrieve(str(data['imageUrl']), matted)
    (folder / 'generation.json').write_text(json.dumps({
        'model': 'fal-ai/nano-banana-2/edit', 'matte': 'BiRefNet_lite', 'prompt': prompt,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
    }, indent=2))
    return matted


def cut_out(matted: Path, reference: Path, out: Path, pad: float) -> None:
    """Sized and padded like the other items: the reference's own canvas, the object centred."""
    with Image.open(reference) as image:
        size = image.size
    with Image.open(matted) as raw:
        cut = raw.convert('RGBA')
    box = cut.getchannel('A').point(lambda value: 255 if value > 12 else 0).getbbox()
    cut = cut.crop(box)
    side = int(max(cut.size) * pad)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
    canvas.resize(size, Image.Resampling.LANCZOS).save(out, format='WEBP', quality=95, method=6)
    print(f'wrote {out}', flush=True)


wanted = set(sys.argv[1:])
done = []
for name, (reference_name, out_name, design) in TIERS.items():
    if wanted and name not in wanted:
        continue
    reference = ITEMS / reference_name
    matted = generate(name, reference, STYLE + design + SUFFIX)
    cut_out(matted, reference, ITEMS / out_name, 1.06)
    done.append((ITEMS / out_name, ITEMS / reference_name))

# A contact sheet of everything this run wrote above the garden piece of the same tier, on the board's green.
if done:
    cell = 256
    sheet = Image.new('RGBA', (cell * len(done), cell * 2), (104, 132, 70, 255))
    for index, pair in enumerate(done):
        for row, source in enumerate(pair):
            with Image.open(source) as image:
                sheet.alpha_composite(image.convert('RGBA').resize((cell, cell)), (index * cell, row * cell))
    DESIGN.mkdir(parents=True, exist_ok=True)
    sheet.save(DESIGN / 'contact-sheet.png')
    print(f'contact sheet: {DESIGN / "contact-sheet.png"}')
