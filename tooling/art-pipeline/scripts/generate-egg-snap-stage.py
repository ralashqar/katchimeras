"""Restyle the approved duel composition through the existing FAL/Nano Banana 2 pipeline."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tooling/art-pipeline'))
os.environ.setdefault('INCUBATOR_GAME_ROOT', str(ROOT / 'apps/katchimeras'))
spec = importlib.util.spec_from_file_location('exploration_pipeline', Path(__file__).with_name('generate-exploration-background.py'))
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)
STAGE = ROOT / 'art/assets/images/katchimeras/world/backgrounds/duel-stages'
NAME = 'mossprout-duel-v4-nano'
PROMPT = '''Image 1 is the exact composition to restyle. Image 2 is a MATERIAL AND SHAPE STYLE reference only, not a camera or layout reference.
Regenerate image 1 as a cozy toy diorama 3D game environment: soft bevels, cushiony rounded shapes, low detail and VERY LOW TEXTURE DETAIL. Strongly simplify all surfaces and vegetation. Smooth matte molded clay and vinyl materials, broad clean color gradients, pillowy tree crowns, chunky rounded trunks, a few plump leaf clusters, simple pebble bushes and sparse toy flowers. No bark grooves, tiny leaves, mottling, grain, pores, scratches, cracks, noisy ground, realistic moss or photographic detail. Match image 2's friendly warm cream stone and rounded designer-toy shapes, simplifying texture even further.
Keep image 1's camera angle, perspective, composition and both platform positions EXACTLY. Low camera, shallow elliptical tops. The far platform standing center remains at 50% horizontal, 30.6% vertical. Near standing center remains at 50% horizontal, 67.4% vertical. Preserve their sizes, top ellipses and low rims. Keep the lantern left, rounded cottage upper right, woodland framing and warm golden light, but simplify them into soft toy forms. Preserve calm open pathway and empty gameplay spaces. Full-bleed portrait 9:16 background. Both platforms completely EMPTY. No eggs, creatures, characters, character shadows, text, signage, symbols, UI or puzzle pieces.'''

def main():
    receipt = STAGE / 'source' / f'{NAME}.json'
    output = STAGE / 'source' / f'{NAME}.png'
    if output.exists():
        print(f'Already generated: {output}')
        return
    if receipt.exists():
        record = json.loads(receipt.read_text())
        data = record['response']
    else:
        reference, mime = pipeline.image_b64(STAGE / 'source/mossprout-duel-v3.png', max_side=1672, jpeg=True)
        guide, guide_mime = pipeline.image_b64(ROOT / 'art/assets/images/katchimeras/world/base/base_env2.png', max_side=768, jpeg=False)
        data = pipeline.call_function('generate-asset', {
            'action': 'generate', 'model': 'nano', 'mode': 'single', 'outputName': NAME,
            'prompt': PROMPT, 'referenceBase64': reference, 'referenceMime': mime,
            'guideBase64': guide, 'guideMime': guide_mime, 'aspectRatio': '9:16', 'resolution': '2K',
        }, timeout=240, retries=1)
        record = {'provider': 'fal', 'model': 'fal-ai/nano-banana-2/edit', 'prompt': PROMPT, 'response': data}
        receipt.write_text(json.dumps(record, indent=2), encoding='utf-8')
    for _ in range(120):
        if data.get('status') == 'completed':
            url = data.get('imageUrl') or data.get('gridUrl')
            if not url:
                raise RuntimeError('Completed without image URL')
            pipeline.download(url, output)
            record['response'] = data
            receipt.write_text(json.dumps(record, indent=2), encoding='utf-8')
            print(f'Saved {output}', flush=True)
            return
        if not data.get('requestId'):
            raise RuntimeError(f'Generation failed: {data.get("status")}')
        request_id = data['requestId']
        time.sleep(8)
        data = pipeline.call_function('generate-asset', {'action': 'poll', 'model': 'nano', 'mode': 'single',
            'outputName': NAME, 'requestId': request_id, 'rawResult': True}, retries=1)
        data.setdefault('requestId', request_id)
        print(f'Generation: {data.get("status")}', flush=True)
    raise TimeoutError('Generation pending; rerun to resume the saved request')

if __name__ == '__main__':
    main()
