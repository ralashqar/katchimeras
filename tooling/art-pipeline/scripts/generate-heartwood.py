"""Heartwood stages: existing queued FAL Nano Banana hex generation and matte pipeline."""
import os
import sys
import json
import hashlib
import importlib.util
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from incubator_context import game_root, content_path

ROOT = game_root()
OUT = content_path(ROOT, 'design/heartwood-v1')
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
brief = json.loads(content_path(ROOT, 'design/shared-world-discovery-v2/briefs.json').read_text())
reference = content_path(ROOT, 'design/mossprout-hex-neighborhood-v1/main-source.png')
stages = {
    'dormant': 'Replace all top-face content with ONE ancient magical Heart Tree, large rounded twisting trunk with a small amber living heart hollow, broad bare rounded branches. Restrained violet corruption coils around roots, pale lavender mist hugs the ground. The tree is dormant but alive, poignant and hopeful, never frightening. No buildings, characters or text. Keep branches inside the square and leave black padding. Retain the exact hex cliff and camera of the reference.',
    'stirring': 'Edit the SAME Heart Tree in exactly the same position, size, camera, trunk shape and hex footprint. The first thick root is now warm luminous gold, corruption has withdrawn from that root, a few large fresh green buds and ONE small leaf cluster appear. Amber heart hollow glows more warmly. Most branches remain bare. Preserve everything else.',
    'rooted': 'Edit the SAME Heart Tree in exactly the same position, size, camera, trunk shape and hex footprint. Several thick roots are now warm luminous gold and connected through the ground. A modest lower canopy of broad rounded sage-green leaf cushions has grown, upper branches remain partly bare for future growth. Ground is greener, corruption retreats to the edges. Amber heart glows warmly. Preserve all geometry and framing.',
}
for stage, subject in stages.items():
    if '--verify-only' in sys.argv:
        continue
    folder = OUT / stage
    folder.mkdir(exist_ok=True)
    source = folder / 'source.png'
    base = reference if stage == 'dormant' else OUT / 'dormant/source.png'
    prompt = '\n\n'.join([brief['geometry'], brief['style'], subject])
    if not source.exists():
        print('Generating ' + stage, flush=True)
        url = generator.generate_queued_tile(output_name='heartwood-' + stage, prompt=prompt, base_path=base, creature_path=None, quality='high', gpt_size=2048, model='nano')
        generator.download(url, source)
        (folder / 'generation.json').write_text(json.dumps({'model': 'fal-ai/nano-banana-2/edit', 'prompt': prompt, 'reference': str(base), 'referenceSha256': hashlib.sha256(base.read_bytes()).hexdigest(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest()}, indent=2))
    if '--generate-only' in sys.argv:
        continue
    subprocess.run([sys.executable, 'scripts/hex-tile-pipeline.py', '--source', str(source), '--key', 'heartwood_' + stage, '--desc', subject, '--skip-rerender', '--size', '2048', '--preserve-canvas', '--skip-package', '--skip-bounds', '--workdir', str(folder / 'matte')], cwd=ROOT, check=True)
    subprocess.run([sys.executable, 'scripts/package-transparent-hex-tile.py', '--source', str(folder / 'matte/final.png'), '--key', 'heartwood_' + stage], cwd=ROOT, check=True)

if '--generate-only' not in sys.argv:
    bounds = {}
    sheet = Image.new('RGB', (1536, 560), '#253c38')
    draw = ImageDraw.Draw(sheet)
    for column, stage in enumerate(stages):
        record = json.loads((OUT / stage / 'generation.json').read_text())
        assert record['model'] == 'fal-ai/nano-banana-2/edit'
        assert hashlib.sha256((OUT / stage / 'source.png').read_bytes()).hexdigest() == record['sourceSha256']
        for size, suffix in [(1024, ''), (512, '_512'), (256, '_256')]:
            path = content_path(ROOT, f'assets/images/katchimeras/world/hex/heartwood_{stage}{suffix}.webp')
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
    bounds_path = ROOT / 'constants/heartwood-bounds.gen.json'
    if '--verify-only' in sys.argv:
        assert json.loads(bounds_path.read_text()) == bounds
    else:
        bounds_path.write_text(json.dumps(bounds, indent=2) + '\n')
        sheet.save(OUT / 'review.png')
    print('PASS: three Nano Banana stages, nine padded transparent LODs, source hashes and bounds.', flush=True)
