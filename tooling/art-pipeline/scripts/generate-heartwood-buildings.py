"""Generate the four Heartwood economy buildings, three looks each, through the existing FAL Nano Banana pipeline.

Each building stands on a Heartwood patch beside the Wisp Lantern, so the Lantern's world art is the style and camera
reference for every first look. A later look is generated from the look before it, so a building keeps its identity
as it grows. Sources and generation records are kept under design/heartwood-buildings-v2 (v1 was too detailed); a look whose source already
exists is only re-matted and re-packaged, never regenerated (delete its source.png to try again).

    python scripts/generate-heartwood-buildings.py                      # everything missing
    python scripts/generate-heartwood-buildings.py --only dew-spring:0  # one look
"""
import argparse, hashlib, importlib.util, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hex_tile_alpha import resize_rgba_premultiplied, postprocess_hex_tile_edges
from incubator_context import game_root, content_path

ROOT = game_root()
OUT = content_path(ROOT, 'design/heartwood-buildings-v2')
ART = content_path(ROOT, 'assets/images/katchimeras/world/heartwood-buildings')
STYLE_REFERENCE = content_path(ROOT, 'assets/images/katchimeras/wisps/cards/lantern-lit-v2.webp')
SIZE = 512

STYLE = (
    'ART STYLE, most important: cozy toy diorama 3D. Soft bevels, cushiony inflated forms, smooth matte clay-like '
    'surfaces, big simple readable shapes, large flat colour blocks. VERY low detail and VERY low texture detail: no '
    'wood grain, no planks, no bricks, no stone cracks, no moss speckles, no leaf veins, no stitching, no tiny '
    'repeated details, no small scattered objects, no surface noise. Count of separate shapes is small; every shape is '
    'big, rounded and thick, like a soft vinyl toy. Simpler and lower in detail than the reference. Warm wood, cream, '
    'leaf green, a little gold. Soft upper-left daylight, gentle ambient occlusion. Same three-quarter camera as the '
    'reference. One single centred garden structure sprite and nothing else: no island, no ground plane, no grass, '
    'no characters, no text, no letters, no numbers, no UI, no watermark. Perfectly flat pure black #000000 background '
    'for matting. The entire silhouette sits inside the canvas with clear padding on all four sides, its base resting '
    'at about 90 percent of canvas height. No drop shadow outside the object. Every shape must read at 96 pixels.'
)

BUILDINGS = {
    'dew-spring': [
        'a small round pool of smooth pale cyan water inside one thick plain rounded cream stone ring, with one big rounded green leaf arching over it holding one large dewdrop',
        'the same round pool, a little wider, with one thick smooth wooden spout pouring a single smooth stream of cyan water into it, one big rounded leaf above, and a plain gold band around the cream ring',
        'a two-tier fountain: one big rounded leaf-shaped upper bowl pouring one wide smooth stream of cyan water into the round lower pool, a plain cream ring with a gold band, and two big rounded leaves',
    ],
    'seed-nursery': [
        'a low chunky rounded wooden table carrying three big rounded terracotta pots, each with one fat two-leaf green sprout, and one chunky cream watering can beside it',
        'a small rounded greenhouse with a thick smooth warm wooden frame, four large plain pale mint glass panes, a rounded wooden door and a plain smooth green roof cap, with nothing visible inside. It stands on its own thick rounded wooden sill: no green base, no ground slab, no platform under it',
        'a taller domed greenhouse with the same thick smooth warm wooden frame, large plain pale mint glass panes, a smooth green dome roof with a small gold finial, and one glowing amber lamp beside the rounded wooden door. It stands on its own thick rounded wooden sill: no green base, no ground slab, no platform under it',
    ],
    'root-cellar': [
        'a smooth rounded green mound with one round wooden door with a gold ring handle, held between two thick smooth tree roots, with one chunky wooden crate beside it',
        'a bigger smooth rounded green mound between two thick smooth roots, with an arched wooden door with two gold hinges, one round glowing amber window, and two chunky stacked crates',
        'a grand cellar entrance: a smooth cream stone arch around double wooden doors with gold trim, set in a smooth green mound between thick roots, three big rounded leaves as a canopy, one amber lantern, one barrel and two crates',
    ],
    'garden-stall': [
        'a chunky rounded wooden table with a plain cream cloth, carrying one big woven-look basket holding three fat green leaves, and one terracotta pot with a single coral flower',
        'a small garden stall: a chunky wooden counter under a simple awning of four wide leaf green and cream stripes with a smooth scalloped edge, two big baskets on the counter (one of three fat orange carrots, one of coral flowers), and one glowing amber lamp',
        'a larger garden stall: a wider awning of wide leaf green and cream stripes with gold trim, a chunky counter with three big baskets, two amber lanterns, and a simple garland of five big leaves along the top',
    ],
}
LOOK_NAMES = {
    'dew-spring': ['Dew Pool', 'Root Spring', 'Heartwood Spring'],
    'seed-nursery': ['Seed Trays', 'Glass Nursery', 'Propagation House'],
    'root-cellar': ['Root Hollow', 'Root Cellar', 'Deep Cellar'],
    'garden-stall': ['Trestle Table', 'Garden Stall', 'Market Stall'],
}

spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)


def prompt_for(building: str, look: int) -> str:
    subject = BUILDINGS[building][look]
    if look == 0:
        return f'Replace the lantern in the reference with a different garden structure: {subject}. It is about the same size on the canvas as the lantern. {STYLE}'
    return (
        f'The reference is the previous level of one garden building. Upgrade that same building into its next level: {subject}. '
        f'Keep its identity, materials, palette, camera and footprint so it is clearly the same building, about 15 percent bigger on the canvas. '
        f'It grows by getting bigger and adding at most two new big shapes, never by adding small details. {STYLE}'
    )


def restore_enclosed(matted: Image.Image, source: Image.Image) -> Image.Image:
    """Give back the parts of the object the matte read as holes.

    A flat, pale surface inside a ring (the Spring's water) looks like background to the matting model and is cut
    out. The hex pipeline's own repair fills every enclosed area, which also paints real gaps (behind a stall's
    baskets, under a table) solid black. This fills an enclosed area only where the source has colour there: the
    background is pure black by construction, so anything enclosed and not black is the object. The matte's outer
    edge and every real gap are left exactly as the matting model made them.
    """
    source = source.convert('RGB').resize(matted.size, Image.LANCZOS)
    alpha = np.array(matted.getchannel('A'))
    # Transparent pixels reachable from the canvas edge are outside; the rest of the transparent pixels are enclosed.
    open_mask = Image.fromarray(np.where(alpha < 128, 255, 0).astype(np.uint8))
    padded = Image.new('L', (open_mask.width + 2, open_mask.height + 2), 255)
    padded.paste(open_mask, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    outside = np.array(padded)[1:-1, 1:-1] == 128
    enclosed = (alpha < 255) & ~outside
    # How far a source pixel is from the black background, as a soft 0..1 so a gap's edge does not turn into a hard line.
    brightness = np.array(source).max(axis=2).astype(np.float32)
    presence = np.clip((brightness - 20.0) / 40.0, 0.0, 1.0)
    restored = np.where(enclosed, np.maximum(alpha, presence * 255.0), alpha).astype(np.uint8)
    rgb = np.array(matted.convert('RGB'))
    fill = enclosed & (restored > alpha)
    rgb[fill] = np.array(source)[fill]
    return Image.fromarray(np.dstack([rgb, restored]), 'RGBA')


def build(building: str, look: int) -> None:
    folder = OUT / building / f'look-{look + 1}'
    folder.mkdir(parents=True, exist_ok=True)
    source = folder / 'source.png'
    reference = STYLE_REFERENCE if look == 0 else OUT / building / f'look-{look}' / 'source.png'
    if not reference.exists():
        raise SystemExit(f'{building} look {look + 1} needs look {look} first: {reference}')
    prompt = prompt_for(building, look)
    if not source.exists():
        print(f'Generating {building} look {look + 1} ({LOOK_NAMES[building][look]})', flush=True)
        url = None
        for attempt in range(1, 4):
            # The model now and then returns nothing for a prompt it accepts on the next try.
            try:
                url = generator.generate_queued_tile(output_name=f'heartwood-{building}-{look + 1}', prompt=prompt, base_path=reference, creature_path=None, quality='high', gpt_size=1024, model='nano')
                break
            except (RuntimeError, OSError) as error:  # OSError covers a network timeout
                print(f'  attempt {attempt} failed: {str(error)[:160]}', flush=True)
        if url is None:
            raise RuntimeError(f'{building} look {look + 1}: no image after three attempts')
        generator.download(url, source)
        (folder / 'generation.json').write_text(json.dumps({
            'model': 'fal-ai/nano-banana-2/edit', 'prompt': prompt,
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
        }, indent=2))
    key = f"{building.replace('-', '_')}_{look + 1}"
    # Matting is a paid remote call: a look that is already matted is only packaged again.
    if not (folder / 'matte/matted.png').exists():
      subprocess.run([sys.executable, 'scripts/hex-tile-pipeline.py', '--source', str(source), '--key', key, '--desc', LOOK_NAMES[building][look],
                      '--skip-rerender', '--size', str(SIZE), '--preserve-canvas', '--skip-package', '--skip-bounds', '--workdir', str(folder / 'matte')], cwd=ROOT, check=True)
    # A sprite, not a solid hex island: package the matte itself (see generate-connection-plant.py), with the
    # object's own enclosed surfaces given back.
    ART.mkdir(parents=True, exist_ok=True)
    with Image.open(folder / 'matte/matted.png') as image, Image.open(source) as original:
        assert image.mode == 'RGBA'
        clean = postprocess_hex_tile_edges(restore_enclosed(image, original), original)
        resize_rgba_premultiplied(clean, (SIZE, SIZE)).save(ART / f'{key}.webp', format='WEBP', quality=95)
    print(f'  wrote {ART / (key + ".webp")}', flush=True)


parser = argparse.ArgumentParser()
parser.add_argument('--only', action='append', help='building or building:look (0-based), repeatable')
args = parser.parse_args()
wanted = []
for entry in args.only or list(BUILDINGS):
    building, _, look = entry.partition(':')
    if building not in BUILDINGS:
        raise SystemExit(f'Unknown building {building}; choose from {", ".join(BUILDINGS)}')
    wanted += [(building, int(look))] if look else [(building, index) for index in range(3)]
failed = []
for building, look in wanted:
    # A building's later looks are generated from the one before, so a failure skips the rest of that building only.
    if any(name == building for name, _ in failed):
        continue
    try:
        build(building, look)
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f'FAILED {building} look {look + 1}: {error}', flush=True)
        failed.append((building, look))
if failed:
    raise SystemExit('Not generated: ' + ', '.join(f'{name}:{look}' for name, look in failed))
