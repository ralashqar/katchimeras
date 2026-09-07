"""Pack approved imagegen RGBA sprites; never infer alpha from shell colour.

Run from any directory with Python + Pillow. Original masters are preserved.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'shell-v1'
SIZE = 128
IDS = ['ignition', 'turbo', 'coolant', 'nitro', 'grip']
COLORS = ['#B78CDE', '#F7CA59', '#91CFF0', '#F1A3B6', '#B8D989']

def normalized(name, overlay=False):
    source = Image.open(ROOT / 'sources' / f'{name}.png').convert('RGBA')
    alpha = source.getchannel('A')
    if alpha.getextrema()[0] > 0:
        raise ValueError(f'{name}: missing transparent background; regenerate source')
    if not overlay:
        # Keep the solid connected sprite and its antialiased edge, excluding
        # disconnected generation debris. Ivory highlights remain opaque.
        core = alpha.point(lambda p: 255 if p > 200 else 0)
        center = (source.width // 2, source.height // 2)
        if core.getpixel(center) != 255:
            raise ValueError(f'{name}: missing opaque center')
        ImageDraw.floodfill(core, center, 128)
        core = core.point(lambda p: 255 if p == 128 else 0)
        bounds = core.getbbox()
        mask = core.filter(ImageFilter.MaxFilter(7))
        source.putalpha(ImageChops.multiply(alpha, mask))
        source = source.crop(bounds)
    out = Image.new('RGBA', (SIZE, SIZE))
    if name.startswith('egg-'):
        source.thumbnail((122, 126), Image.Resampling.LANCZOS)
        out.alpha_composite(source, ((SIZE-source.width)//2, (SIZE-source.height)//2))
    else:
        out.alpha_composite(source.resize((126,126), Image.Resampling.LANCZOS), (1,1))
    return out

tiles = {name: normalized(name) for name in IDS}
normalized('armour-silver').save(ROOT / 'armour-silver.png')
eggs = {name: normalized('egg-'+name) for name in IDS+['bomb']}
for name in ['shield-overlay', 'bomb-overlay']:
    normalized(name, overlay=True).save(ROOT / f'{name}.png')
for name, egg in eggs.items():
    egg.save(ROOT / f'egg-{name}.png')

for clear in [False, True]:
    atlas = Image.new('RGBA', (SIZE*8, SIZE*5))
    for row, name in enumerate(IDS):
        tile = tiles[name].copy()
        if clear:
            a = tile.getchannel('A')
            tile = ImageEnhance.Color(ImageEnhance.Contrast(tile).enhance(1.10)).enhance(1.18)
            tile.putalpha(a)
        tile.save(ROOT / f'{name}{"-clear" if clear else ""}.png')
        atlas.alpha_composite(tile, (0,row*SIZE))
        c = tuple(bytes.fromhex(COLORS[row][1:]))
        ring = Image.new('RGBA',(SIZE,SIZE))
        ImageDraw.Draw(ring).ellipse((10,10,118,118),outline=(*c,225),width=4)
        atlas.alpha_composite(ring,(SIZE,row*SIZE))
        # Broad irregular shell chip with a cream inner edge, not confetti squares.
        chip = Image.new('RGBA',(SIZE,SIZE)); d = ImageDraw.Draw(chip)
        polygon=[(22,28),(66,12),(105,37),(94,85),(52,111),(16,73)]
        d.polygon(polygon,fill=(*c,255));d.line(polygon[:3],fill='#FFF0D4',width=7)
        atlas.alpha_composite(chip,(SIZE*2,row*SIZE))
        # Columns 3/4/5 retain their reserved compatibility positions; no glyphs.
        for col in [4,5]:
            ghost=tile.copy();ghost.putalpha(tile.getchannel('A').point(lambda p:round(p*.18)))
            atlas.alpha_composite(ghost,(SIZE*col,row*SIZE))
        atlas.alpha_composite(eggs[name],(SIZE*6,row*SIZE))
        atlas.alpha_composite(eggs['bomb'],(SIZE*7,row*SIZE))
    atlas.save(ROOT / ('atlas-clear.png' if clear else 'atlas.png'))

# Structural verification runs as part of every packaging operation.
for name in IDS:
    tile=Image.open(ROOT/f'{name}.png')
    assert tile.size==(128,128) and tile.getpixel((0,0))[3]==0
    assert tile.getpixel((64,64))[3]>240
    atlas=Image.open(ROOT/'atlas.png')
    assert atlas.crop((0,IDS.index(name)*128,128,(IDS.index(name)+1)*128)).tobytes()==tile.tobytes()
print('Packed shell-v1: five symbol-free tiles, six egg shots, two overlays, two atlases.')
