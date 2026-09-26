"""Generate the Dark Wisp looks (encounter v2) through the existing FAL Nano Banana edit + BiRefNet pipeline.

Every look is the current corruption wisp (the reference image) with its own silhouette and one prop, so a player can
tell a Snuffer from a Warden at a glance: same glossy purple smoke body, same glowing eyes, same lighting. The intent
chip over a wisp stays the truth of what it does next; the look says what it is.

Sources, mattes and the generation record live under design/dark-wisp-looks-v1 (delete a look's source to try it
again); runtime cutouts go to the cutouts tree as dark-wisps/<look>.webp, with a contact sheet for review.

    python scripts/generate-dark-wisp-looks.py            # every look not yet generated
    python scripts/generate-dark-wisp-looks.py snuffer    # just these
"""
import hashlib, importlib.util, json, sys, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
DESIGN = content_path(ROOT, 'design/dark-wisp-looks-v1')
REFERENCE = content_path(ROOT, 'assets/images/katchimeras/cutouts/corruption-wisp.png')
OUT = content_path(ROOT, 'assets/images/katchimeras/cutouts/dark-wisps')
SIZE = 512

COMMON = (
    'Use the reference image as the exact character and style: the same glossy, soft, cushiony purple smoke creature, '
    'the same deep violet body with a lighter violet rim glow, the same two glowing white-violet angry eyes, the same '
    'soft studio lighting and toy-like 3D finish. Keep it one single creature, centred and large, the whole silhouette '
    'inside the canvas with clear padding, readable at 40 pixels. EXACTLY ONE face with ONE pair of glowing eyes, never a '
    'second face or second pair of eyes anywhere. Change ONLY what is described next, and make the '
    'silhouette clearly different from the reference. '
)
SUFFIX = (
    ' Perfectly flat uniform light grey #D9D9D9 background for background removal. No floor, no cast shadow, no '
    'second creature, no particles outside the body, no text, no letters, no border, no UI, no watermark.'
)
LOOKS: dict[str, str] = {
    'snuffer': 'It wears a tall pointed candle-snuffer cone of darker plum metal on its head like a hat, and one smoke '
               'curl reaches forward like a hand pinching something out. Slightly taller and thinner body.',
    'shrouder': 'It is draped in a wide hooded cloak of thin veil-like mist that trails down in long soft folds on both '
                'sides, the eyes glowing from inside the hood. Wider silhouette, like a small ghost in a shroud.',
    'nibbler': 'A rounder, squatter, hungrier body with a wide open grinning mouth full of small rounded blunt teeth '
               'under the eyes, and two short stubby smoke curls like little arms. Clearly a hungry little thing.',
    'creeper': 'Instead of smoke curls, thick twisting dark purple root tendrils spread out from its base and sides, '
               'with a couple of tiny dark thorns. Low and wide, as if it is creeping along the ground.',
    'warden': 'It holds a big round shield of overlapping dark violet crystal plates in front of its body, like a '
              'turtle shell, with the eyes peering over the top. Sturdy, broad, defensive.',
    'mender': 'A softer, rounder, pudgier body with a glowing stitched seam running across it and a couple of soft wrap '
              'bands like bandages. Calmer curls, less spiky.',
    'caller': 'A tall horn-shaped curl rises from the top of its head like a curled horn it calls through, with three '
              'tiny glowing violet sparks drifting from the horn. Slender body.',
    'mistling': 'A tiny, round, baby version: one small curl on top, a plump round body and big glowing eyes, cute but '
                'mischievous. Much simpler and rounder than the reference.',
    'keeper': 'A large ancient boss wisp with one head: a crown of gnarled dark branches rises from the top of that head, patches of dark moss on '
              'its shoulders, heavy thick curls, deep glowing eyes. Imposing, old and big.',
    'thief': 'A sly boss wisp: its single head wears a hood, with a narrow dark mask across its one pair of glowing eyes, and a long curling tail '
             'wrapped around a small bundle of stolen bright pink, yellow and blue flower petals, the only colour on it.',
    'overgrowth': 'A large boss wisp tangled in thick dark green-black vines with sharp thorns and a few dark leaves, '
                  'vines coiling around its body and out to the sides. Heavy, wild, overgrown.',
    # Lanes variety (Sept 2026): each new kind of wisp reads at a glance by what it does.
    'weaver': 'A sleek, slender, serpent-like body whose tail becomes two long ribbon-like smoke streamers curving away '
              'in an S-shape to the left and right, as if it slithers from side to side. Sly narrowed eyes.',
    'dasher': 'A streamlined teardrop body leaning steeply forward and down, with its smoke swept back into sharp '
              'streaks behind it like speed lines, and fierce narrowed eyes. It looks about to lunge.',
    'bulwark': 'A floating ring of five small glowing violet crystal shards orbits around its body like a halo, and a '
               'faint translucent violet dome of light surrounds it. Round, calm, protective, not holding anything.',
    'frost': 'A pale frosted lavender and icy blue body with a crown of small sharp icicles on its head, frost '
             'crystals on its curls and a thin breath of cold white mist from its mouth. Pale icy blue glowing eyes.',
    'splitter': 'A plump body with a jagged bright glowing crack running straight down its middle from top to bottom, '
                'as if it is about to split into two halves, with a small curl on each half of its head.',
    'snatcher': 'A small crouched body with one long, thin, stretchy smoke arm ending in a little three-fingered claw '
                'hand that clutches a small bright green seed, the only colour on it. Sneaky, mischievous.',
}

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)


def matte(image_url: str, name: str) -> str:
    """BiRefNet only (the project's rule for transparency); the source background is flat grey by construction."""
    data = generator.call_function('remove-image-background', {
        'imageUrl': image_url, 'outputName': name, 'model': 'BiRefNet_lite',
        'operatingResolution': '1024x1024', 'refineForeground': True,
    }, timeout=180)
    url = data.get('imageUrl')
    if not url:
        raise RuntimeError(f'{name}: matte failed: {data}')
    return str(url)


def package(matted: Path, out: Path) -> None:
    """Crop to the creature and centre it on a square canvas with a small even margin, like the reference cutout."""
    with Image.open(matted) as raw:
        cut = raw.convert('RGBA')
    box = cut.getchannel('A').point(lambda value: 255 if value > 12 else 0).getbbox()
    if not box:
        raise RuntimeError(f'{matted}: empty matte')
    cut = cut.crop(box)
    side = int(max(cut.size) * 1.1)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
    canvas = canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format='WEBP', quality=95, method=6)


def contact_sheet(looks: list[str]) -> Path:
    cell = 256
    columns = 4
    rows = (len(looks) + 1 + columns - 1) // columns
    sheet = Image.new('RGBA', (columns * cell, rows * (cell + 28)), (38, 30, 52, 255))
    draw = ImageDraw.Draw(sheet)
    entries = [('reference', REFERENCE)] + [(look, OUT / f'{look}.webp') for look in looks]
    for index, (name, path) in enumerate(entries):
        if not path.exists():
            continue
        with Image.open(path) as image:
            thumb = image.convert('RGBA').resize((cell - 16, cell - 16), Image.Resampling.LANCZOS)
        x, y = (index % columns) * cell, (index // columns) * (cell + 28)
        sheet.alpha_composite(thumb, (x + 8, y + 8))
        draw.text((x + 10, y + cell), name, fill=(240, 228, 255, 255))
    target = DESIGN / 'contact-sheet.png'
    sheet.convert('RGB').save(target)
    return target


def main() -> None:
    wanted = sys.argv[1:] or list(LOOKS)
    DESIGN.mkdir(parents=True, exist_ok=True)
    record_path = DESIGN / 'generation.json'
    record = json.loads(record_path.read_text()) if record_path.exists() else {}
    for look in wanted:
        prompt = COMMON + LOOKS[look] + SUFFIX
        source = DESIGN / f'{look}-source.png'
        matted = DESIGN / f'{look}-matte.png'
        out = OUT / f'{look}.webp'
        if source.exists() and matted.exists() and out.exists():
            print(f'{look}: kept'); continue
        print(f'{look}: generating', flush=True)
        url = None
        for attempt in range(1, 4):
            try:
                url = generator.generate_queued_tile(output_name=f'dark-wisp-{look}', prompt=prompt, base_path=REFERENCE, creature_path=None, quality='high', gpt_size=1024, model='nano')
                break
            except (RuntimeError, OSError) as error:
                print(f'  attempt {attempt} failed: {str(error)[:160]}', flush=True)
                time.sleep(4)
        if url is None:
            print(f'{look}: no image after three attempts'); continue
        generator.download(url, source)
        matte_url = matte(url, f'dark-wisp-{look}')
        urllib.request.urlretrieve(matte_url, matted)
        package(matted, out)
        record[look] = {
            'model': 'fal-ai/nano-banana-2/edit', 'matte': 'BiRefNet_lite', 'prompt': prompt,
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'referenceSha256': hashlib.sha256(REFERENCE.read_bytes()).hexdigest(),
        }
        record_path.write_text(json.dumps(record, indent=2))
        print(f'{look}: wrote {out}', flush=True)
    print(f'sheet: {contact_sheet(list(LOOKS))}')


if __name__ == '__main__':
    main()
