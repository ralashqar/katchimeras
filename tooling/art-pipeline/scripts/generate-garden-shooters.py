"""Generate the garden chain as shooter plants (Lanes, `docs/encounter-lanes.md`) through FAL Nano Banana edit + BiRefNet.

In a Lanes battle every garden piece from the Sprout up shoots Glow straight up its column, so each one is redrawn as a
plant that plainly shoots: a mouth open at the top. The first image is the tier's current art (the project's own
chunky clay-toy merge item: its style, scale, lighting and soil mound); the second is the design sheet the shooters
follow (design/garden-shooters-v1/guide.png, a 3x3 sheet), one cell per tier. The Seed stays as it is: it does not
shoot. The bullet is generated here too: one round Glow seed.

Sources, mattes and the generation record live under design/garden-shooters-v1/<name> (delete a source to try it
again); runtime cutouts go beside the other items as nature-garden-<tier>-shooter.webp (and glow-seed-bullet.webp),
padded to the items' own canvas, with a contact sheet for review.

    python scripts/generate-garden-shooters.py              # everything not yet generated
    python scripts/generate-garden-shooters.py tier-4       # just these
"""
import hashlib, importlib.util, json, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
DESIGN = content_path(ROOT, 'design/garden-shooters-v1')
ITEMS = content_path(ROOT, 'assets/images/katchimeras/merge-world/items')
GUIDE = DESIGN / 'guide.png'

STYLE = (
    'Use the FIRST image only for its art style, scale, lighting and camera: the same chunky, soft, glossy clay-toy 3D '
    'merge item for a cozy merge game, the same three-quarter top-down view, the same round brown soil mound base with '
    'a couple of small grey pebbles, warm soft lighting, rounded forms, simple readable shapes. Use the SECOND image, a '
    'sheet of nine plant designs, only for the design idea named below. Draw ONE plant that plainly shoots: its mouth '
    'is a clearly open round hole at the very top, facing up, dark inside, like a little cannon, so it reads at a glance '
    'as a plant that fires things upward. Centred and large, the whole object inside the canvas with clear padding. '
    'Perfectly flat uniform light grey #D9D9D9 background for background removal. No floor, no cast shadow, no second '
    'object, no projectile, no text, no letters, no border, no UI, no watermark.'
)

# Each tier: its current art (the style reference), the guide cell it follows, and what it is.
TIERS = {
    'tier-2': ('nature-garden-2-sprout.webp', 'nature-garden-2-shooter.webp',
               'the TOP-LEFT design: a small young bright-green sprout with two round leaves, its short stem ending in a '
               'little open green tube mouth pointing straight up. The smallest and simplest of the shooters.'),
    'tier-3': ('nature-garden-3-plant.webp', 'nature-garden-3-shooter.webp',
               'the TOP-MIDDLE design: a plump golden-yellow tulip bud on a bed of green leaves, its petals curling '
               'into a deep round open cup mouth at the top.'),
    'tier-4': ('nature-garden-4-flower.webp', 'nature-garden-4-shooter.webp',
               'the CENTRE design: a white daisy with soft cream petals around a raised golden-orange tube in its '
               'middle, the tube open at the top.'),
    'tier-5': ('nature-garden-5-rare-flower.webp', 'nature-garden-5-shooter.webp',
               'the TOP-RIGHT design: a tall sky-blue bellflower trumpet on green leaves, its wide flared mouth open '
               'at the top. Grander than the daisy.'),
    'tier-6': ('nature-garden-6-magical-plant.webp', 'nature-garden-6-shooter.webp',
               'the MIDDLE-RIGHT design: a magical violet plant with three tube mouths, a tall one in the middle and '
               'a shorter one either side, all open at the top, on broad green leaves.'),
    'tier-7': ('nature-garden-7-ancient-tree.webp', 'nature-garden-7-shooter.webp',
               'the BOTTOM-RIGHT design made into an ANCIENT TREE: a short stout gnarled mossy tree trunk whose top '
               'opens into a wide hollow mouth, crowned with glowing crystal-blue and violet crystal petals like the '
               'crystal lotus, a small glowing violet pearl of light deep in the mouth. The grandest of all.'),
}
BULLET = ('nature-garden-1-seed.webp', 'glow-seed-bullet.webp', (
    'Use the FIRST image only for its art style and lighting (the chunky, soft, glossy clay-toy 3D style of a cozy '
    'merge game). Draw ONE small round Glow seed, a projectile: a perfect sphere of warm golden-cream light, glossy, '
    'with a bright soft white highlight near the top and a gentle inner glow, the edge crisp and round. Nothing else: '
    'no soil, no leaves, no stem. Centred, filling most of the canvas with clear padding. Perfectly flat uniform light '
    'grey #D9D9D9 background for background removal. No floor, no cast shadow, no text, no border, no watermark.'
))

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)


def generate(name: str, reference: Path, prompt: str, guide: Path | None) -> Path:
    folder = DESIGN / name
    folder.mkdir(parents=True, exist_ok=True)
    source, matted = folder / 'source.png', folder / 'matte.png'
    if source.exists() and matted.exists():
        return matted
    url = None
    for attempt in range(1, 4):
        try:
            url = generator.generate_queued_tile(output_name=f'garden-shooter-{name}', prompt=prompt, base_path=reference, creature_path=guide, quality='high', gpt_size=1024, model='nano')
            break
        except (RuntimeError, OSError) as error:
            print(f'  {name}: attempt {attempt} failed: {str(error)[:160]}', flush=True)
    if url is None:
        raise SystemExit(f'{name}: no image after three attempts')
    generator.download(url, source)
    data = generator.call_function('remove-image-background', {
        'imageUrl': url, 'outputName': f'garden-shooter-{name}', 'model': 'BiRefNet_lite',
        'operatingResolution': '1024x1024', 'refineForeground': True,
    }, timeout=180)
    if not data.get('imageUrl'):
        raise SystemExit(f'{name}: matte failed: {data}')
    urllib.request.urlretrieve(str(data['imageUrl']), matted)
    (folder / 'generation.json').write_text(json.dumps({
        'model': 'fal-ai/nano-banana-2/edit', 'matte': 'BiRefNet_lite', 'prompt': prompt,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
        **({'guideSha256': hashlib.sha256(guide.read_bytes()).hexdigest()} if guide else {}),
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
    matted = generate(name, reference, f'{STYLE} The design: {design}', GUIDE)
    cut_out(matted, reference, ITEMS / out_name, 1.06)
    done.append(ITEMS / out_name)
if not wanted or 'bullet' in wanted:
    reference = ITEMS / BULLET[0]
    matted = generate('bullet', reference, BULLET[2], None)
    cut_out(matted, reference, ITEMS / BULLET[1], 1.12)
    done.append(ITEMS / BULLET[1])

# A contact sheet of everything this run wrote, on the board's green, for review.
if done:
    cell = 256
    sheet = Image.new('RGBA', (cell * len(done), cell), (104, 132, 70, 255))
    for index, path in enumerate(done):
        with Image.open(path) as image:
            sheet.alpha_composite(image.convert('RGBA').resize((cell, cell)), (index * cell, 0))
    ImageDraw.Draw(sheet)
    sheet.save(DESIGN / 'contact-sheet.png')
    print(f'contact sheet: {DESIGN / "contact-sheet.png"}')
