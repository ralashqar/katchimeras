"""Package existing generated plates and measure opaque egg contact bounds; no image generation.
Run from anywhere: python tooling/art-pipeline/scripts/prepare-egg-snap-stage.py
"""
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'art/assets/images/katchimeras'
STAGE = ART / 'world/backgrounds/duel-stages'

def main():
    source = Image.open(STAGE / 'source/mossprout-duel-v2.png').convert('RGB')
    for label, width in [('full', source.width), ('medium', 640)]:
        image = source.resize((width, round(source.height * width / source.width)), Image.Resampling.LANCZOS)
        image.save(STAGE / f'mossprout-duel-v2-{label}.webp', quality=91, method=6)
    bodies = {}
    for skin in ['classic', 'moss', 'honeycomb', 'frost', 'sunset', 'starglow', 'tide']:
        image = Image.open(ART / 'egg-avatars/bases' / f'{skin}.webp').convert('RGBA')
        bounds = image.getchannel('A').point(lambda a: 255 if a > 160 else 0).getbbox()
        catalog = (ART / 'egg-avatars/catalog/body' / f'{skin}.ts').read_text(encoding='utf-8')
        presentation = json.loads(re.search(r'presentation: (\{[^\n]+\})', catalog).group(1))
        scale, dx, dy = (presentation[k] for k in ('scale', 'offsetX', 'offsetY'))
        x1, y1, x2, y2 = bounds
        x = .5 + (x1 / image.width - .5) * scale + dx
        y = .5 + (y1 / image.height - .5) * scale + dy
        width, height = (x2 - x1) / image.width * scale, (y2 - y1) / image.height * scale
        bodies[skin] = {'anchor': {'x': x + width / 2, 'y': y + height},
                        'bounds': {'x': x, 'y': y, 'width': width, 'height': height}}
    (ROOT / 'apps/egg-snap/data/egg-ground.json').write_text(json.dumps(bodies, indent=2) + '\n', encoding='utf-8')
    print('Prepared stage LODs and calibrated all seven Egg Snap bodies.')

if __name__ == '__main__':
    main()
