"""Normalize the generated RGBA button sources for 48pt controls. Pillow required."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[1] / 'assets' / 'controls'
for name in ['pause', 'settings']:
    source = Image.open(root/'sources'/f'{name}.png').convert('RGBA')
    alpha = source.getchannel('A')
    mask = alpha.point(lambda p: 255 if p > 128 else 0)
    ImageDraw.floodfill(mask, (source.width//2, source.height//2), 128)
    mask = mask.point(lambda p: 255 if p == 128 else 0)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.5))
    bounds = mask.point(lambda p: 255 if p > 128 else 0).getbbox()
    assert bounds and bounds[2]-bounds[0] > source.width*.7
    source.putalpha(mask)
    canvas = Image.new('RGBA', (144,144))
    canvas.alpha_composite(source.crop(bounds).resize((140,140), Image.Resampling.LANCZOS), (2,2))
    canvas.save(root/f'{name}.png')
print('Packaged pause and settings art')
