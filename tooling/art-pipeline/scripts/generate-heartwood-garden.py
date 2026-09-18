"""Heartwood stages: existing queued FAL Nano Banana hex generation and matte pipeline."""
import os
import sys
import json
import hashlib
import importlib.util
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
OUT = content_path(ROOT, 'design/heartwood-garden-v4')
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
brief = json.loads(content_path(ROOT, 'design/shared-world-discovery-v2/briefs.json').read_text())
reference = content_path(ROOT, 'design/heartwood-garden-v3/dormant/source.png')
original_tree = content_path(ROOT, 'design/heartwood-v1/dormant/source.png')
beds = 'Exactly FIVE empty circular soil beds, ONLY in a symmetric foreground horseshoe. One front-center bed, a front-left and front-right pair, and a far-left and far-right side pair. NO beds behind the Tree, NO beds underneath branches. Approximate soil centers on square canvas: far-left (17%,43%), far-right (83%,43%), front-left (29%,57%), front-right (71%,57%), front-center (50%,63%). Diameter 14 percent of square width; perspective makes circles shallow ellipses. Preserve the island hex cliff, front stairs and camera. The Tree owns the entire CENTER and BACK of the island. Thick twisted intertwined trunk, sweeping asymmetric broad branches, prominent glowing amber heart, magical buttress roots. Reference TWO is original Tree identity. All five soil centers visible, empty, no plants or people. Black background and generous padding. No sixth bed, no rear bed, no tiny sapling or round lollipop tree.'
stages = {
 'dormant': 'Redesign ONLY the top arrangement of reference ONE. REMOVE all six existing beds and replace with the FIVE foreground horseshoe beds described below. Keep the magnificent original Tree, relocate its trunk base slightly back to (50%,40%), broaden and enlarge its sweeping crown across the whole upper half. The thick twisted trunk and glowing heart stay visible behind the foreground beds. Bare dramatic curling branches and violet corruption around roots. Tree is dominant, soil beds secondary. '+beds,
 'stirring': 'Edit ONLY the Tree in image ONE, keeping EXACT five bed positions and island geometry unchanged. Same large sculptural twisted trunk and sweeping branches. One root glows gold, a few large buds and a small cluster of fresh leaves. Most branches bare. '+beds,
 'rooted': 'Edit ONLY the Tree in image ONE, keeping EXACT five bed positions and island geometry unchanged. Same large sculptural twisted trunk and sweeping branches. Several roots glow gold. Separated sage leaf cushions grow along its broad upper and rear branches with visible gaps. '+beds,
 'blooming': 'Edit ONLY the Tree in image ONE, keeping EXACT five bed positions and island geometry unchanged. Same large sculptural twisted trunk and sweeping branches. Full broad asymmetrical layered emerald crown across the upper and rear half with peach-pink blossoms and delicate hanging flowers. Heart and roots glow. Keep foreground and side beds clear. '+beds,
 'awakened': 'CRITICAL FRAMING: canopy top must be at least 6 percent BELOW the top canvas edge. Entire foliage silhouette visible with pure black padding on all four sides. Keep the island and five beds in their exact positions; do not zoom in. Let upper branches bow sideways to fit foliage below y=6 percent. Broad canopy, not taller canopy. Edit ONLY the Tree in image ONE, keeping EXACT five bed positions and island geometry unchanged. Same large sculptural twisted trunk and sweeping branches, glorious broad rich emerald and sage crown, cream-gold blossoms and a few hanging gold seed lights. A radiant ancient Tree of Life filling middle and back. Glowing heart and gold roots, no violet corruption. Keep foreground and side beds clear. '+beds,
}
selected_stage = sys.argv[sys.argv.index('--stage') + 1] if '--stage' in sys.argv else None

for stage, subject in stages.items():
    if selected_stage and stage != selected_stage:
        continue
    if '--verify-only' in sys.argv:
        continue
    folder = OUT / stage
    folder.mkdir(exist_ok=True)
    source = folder / 'source.png'
    base = reference if stage == 'dormant' else OUT / 'dormant/source.png'
    prompt = '\n\n'.join([brief['geometry'], brief['style'], subject])
    if not source.exists():
        print('Generating ' + stage, flush=True)
        url = generator.generate_queued_tile(output_name='heartwood-garden-v4-' + stage, prompt=prompt, base_path=base, creature_path=original_tree, quality='high', gpt_size=2048, model='nano')
        generator.download(url, source)
        (folder / 'generation.json').write_text(json.dumps({'model': 'fal-ai/nano-banana-2/edit', 'prompt': prompt, 'reference': str(base), 'treeReferenceSha256': hashlib.sha256(original_tree.read_bytes()).hexdigest(), 'referenceSha256': hashlib.sha256(base.read_bytes()).hexdigest(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest()}, indent=2))
    if '--generate-only' in sys.argv:
        continue
    subprocess.run([sys.executable, 'scripts/hex-tile-pipeline.py', '--source', str(source), '--key', 'heartwood_garden_' + stage, '--desc', subject, '--skip-rerender', '--size', '2048', '--preserve-canvas', '--skip-package', '--skip-bounds', '--workdir', str(folder / 'matte')], cwd=ROOT, check=True)
    # Solid-island restoration fills enclosed shapes. Tree branches also enclose
    # real sky holes: preserve the original matte where the source is black sky.
    with Image.open(source) as src, Image.open(folder / 'matte/matted.png') as matte, Image.open(folder / 'matte/final.png') as final:
        rgb = np.array(src.convert('RGB'))
        original_alpha = np.array(matte.convert('RGBA'))[:, :, 3]
        pixels = np.array(final.convert('RGBA'))
        sky = (rgb.max(axis=2) <= 20) & (rgb.max(axis=2) - rgb.min(axis=2) <= 6) & (original_alpha < 128)
        pixels[:, :, 3] = np.where(sky, np.minimum(pixels[:, :, 3], original_alpha), pixels[:, :, 3])
        Image.fromarray(pixels).save(folder / 'matte/final.png')
    subprocess.run([sys.executable, 'scripts/package-transparent-hex-tile.py', '--source', str(folder / 'matte/final.png'), '--key', 'heartwood_garden_' + stage], cwd=ROOT, check=True)

if '--generate-only' not in sys.argv and not selected_stage:
    bounds = {}
    sheet = Image.new('RGB', (2560, 560), '#253c38')
    draw = ImageDraw.Draw(sheet)
    for column, stage in enumerate(stages):
        record = json.loads((OUT / stage / 'generation.json').read_text())
        assert record['model'] == 'fal-ai/nano-banana-2/edit'
        assert hashlib.sha256((OUT / stage / 'source.png').read_bytes()).hexdigest() == record['sourceSha256']
        for size, suffix in [(1024, ''), (512, '_512'), (256, '_256')]:
            path = content_path(ROOT, f'assets/images/katchimeras/world/hex/heartwood_garden_{stage}{suffix}.webp')
            with Image.open(path) as tile:
                assert tile.size == (size, size) and tile.mode == 'RGBA', path
                alpha = tile.getchannel('A')
                box = alpha.getbbox()
                assert box and box[0] > 0 and box[1] > 0 and box[2] < size and box[3] < size, path
                assert alpha.getextrema() == (0, 255), path
                if size == 1024:
                    bounds[stage] = dict(zip(['left', 'top', 'right', 'bottom'], box))
                if size == 512:
                    sheet.paste(tile, (column * 512, 40), tile)
        draw.text((column * 512 + 24, 12), stage, fill='white')
    bounds_path = ROOT / 'constants/heartwood-garden-bounds.gen.json'
    if '--verify-only' in sys.argv:
        assert json.loads(bounds_path.read_text()) == bounds
    else:
        bounds_path.write_text(json.dumps(bounds, indent=2) + '\n')
        sheet.save(OUT / 'review.png')
    print('PASS: five Nano Banana garden stages, transparent LODs, source hashes and bounds.', flush=True)
