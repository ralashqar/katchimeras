"""Generate Connection growth sprites through the existing FAL Nano Banana pipeline."""
import sys, json, hashlib, importlib.util, subprocess
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hex_tile_alpha import resize_rgba_premultiplied, postprocess_hex_tile_edges
from incubator_context import game_root, content_path
ROOT = game_root()
OUT = content_path(ROOT, 'design/heartwood-garden-v2/connection')
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('generator', Path(__file__).with_name('generate-katchimera-hex-tile.py'))
generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
for stage, subject in [('seed', 'one rounded violet seed with two small interlocking heart marks'), ('sprout', 'two short green stems leaning together with tiny violet heart-shaped leaves'), ('bloom', 'two friendly violet bell flowers leaning together over broad green leaves')]:
 folder = OUT / stage; folder.mkdir(exist_ok=True)
 source = folder / 'source.png'
 reference = content_path(ROOT, f'assets/images/katchimeras/world/memory-plants/warmth_{stage}.webp')
 prompt = f'Replace this plant with {subject}. Match the reference smooth chunky cozy 3D toy style, same camera, single centered plant sprite, no planter or island or text. Pure black background for matting. Entire silhouette inside canvas with padding. The base of the stem touches soil at 95 percent of canvas height. Plant fills similar proportion of canvas as reference. No baked shadow outside plant.'
 if not source.exists():
  print('Generating Connection '+stage, flush=True)
  url = generator.generate_queued_tile(output_name='connection-'+stage, prompt=prompt, base_path=reference, creature_path=None, quality='high', gpt_size=1024, model='nano')
  generator.download(url, source)
  (folder/'generation.json').write_text(json.dumps({'model':'fal-ai/nano-banana-2/edit','prompt':prompt,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'referenceSha256':hashlib.sha256(reference.read_bytes()).hexdigest()},indent=2))
 subprocess.run([sys.executable,'scripts/hex-tile-pipeline.py','--source',str(source),'--key','connection_'+stage,'--desc',subject,'--skip-rerender','--size','384','--preserve-canvas','--skip-package','--skip-bounds','--workdir',str(folder/'matte')],cwd=ROOT,check=True)
 # A plant has real holes between stems. The hex pass restores enclosed
 # interiors for solid islands, so package the original matte for sprites.
 with Image.open(folder/'matte/matted.png') as image, Image.open(source) as original:
  assert image.mode == 'RGBA'
  clean = postprocess_hex_tile_edges(image, original)
  resize_rgba_premultiplied(clean, (384, 384)).save(content_path(ROOT, f'assets/images/katchimeras/world/memory-plants/connection_{stage}.webp'),format='WEBP',quality=95)
