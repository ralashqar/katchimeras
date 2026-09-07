"""Package imagegen masters into aligned sprites and the existing runtime atlas.

Only alpha extraction, normalization and readability adjustment happen here;
the tile material/symbol artwork comes from sources/, never procedural repainting.
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'blocks'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 128
PALETTE = [('ignition','#B185EA','star'),('turbo','#F8C43B','sun'),('coolant','#39BBF2','drop'),('nitro','#F370A2','heart'),('grip','#93DB3A','leaf')]

def packaged_tile(name):
    source = Image.open(OUT/'sources'/f'{name}.png').convert('RGBA')
    # Some imagegen masters contain a neutral checkerboard despite requesting
    # transparency. Extract the connected chromatic tile, preserving enclosed
    # white highlights; the outside neutral background is never shipped.
    red, green, blue, alpha = source.split()
    chroma = ImageChops.subtract(ImageChops.lighter(ImageChops.lighter(red,green),blue),
                                ImageChops.darker(ImageChops.darker(red,green),blue))
    mask = ImageChops.multiply(chroma.point(lambda p:255 if p>25 else 0),
                              alpha.point(lambda p:255 if p>128 else 0))
    ImageDraw.floodfill(mask, (source.width//2, source.height//2), 128)
    mask = mask.point(lambda p:255 if p==128 else 0)
    ImageDraw.floodfill(mask,(0,0),128)
    mask = mask.point(lambda p:0 if p==128 else 255)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.6))
    bounds = mask.point(lambda p:255 if p>128 else 0).getbbox()
    if not bounds or bounds[2]-bounds[0] < source.width*.65:
        raise ValueError(f'{name}: incomplete silhouette; inspect source before packaging')
    source.putalpha(mask)
    tile = Image.new('RGBA',(SIZE,SIZE))
    # One-pixel sampling gutter keeps neighbours close without atlas bleed.
    tile.alpha_composite(source.crop(bounds).resize((126,126),Image.Resampling.LANCZOS),(1,1))
    assert tile.getpixel((0,0))[3] == 0
    return tile

TILES = {name:packaged_tile(name) for name,_,_ in PALETTE}
def rgb(h): return tuple(bytes.fromhex(h[1:]))
def mix(c, target, t): return tuple(round(v+(target-v)*t) for v in c)
def glyph(symbol):
    im=Image.new('L',(SIZE,SIZE));d=ImageDraw.Draw(im)
    if symbol=='star':
        pts=[(64+math.cos(-math.pi/2+i*math.pi/5)*(23 if i%2==0 else 11),64+math.sin(-math.pi/2+i*math.pi/5)*(23 if i%2==0 else 11)) for i in range(10)]
        d.polygon(pts,fill=255)
    elif symbol=='sun':
        d.ellipse((52,52,76,76),fill=255)
        for i in range(8):
            a=i*math.pi/4;d.line((64+math.cos(a)*18,64+math.sin(a)*18,64+math.cos(a)*24,64+math.sin(a)*24),fill=255,width=4)
    elif symbol=='drop':
        d.polygon([(64,39),(46,64),(82,64)],fill=255);d.ellipse((46,53,82,87),fill=255)
    elif symbol=='heart':
        d.ellipse((41,45,65,70),fill=255);d.ellipse((63,45,87,70),fill=255);d.polygon([(41,58),(87,58),(64,87)],fill=255)
    else:
        d.ellipse((45,40,83,88),fill=255);d.line((51,81,77,47),fill=0,width=4)
    return im
for strong in [False, True]:
    atlas=Image.new('RGBA',(SIZE*6,SIZE*5))
    for row,(name,hexcolor,symbol) in enumerate(PALETTE):
        c=rgb(hexcolor);tile=TILES[name].copy()
        if strong:
            a=tile.getchannel('A')
            tile=ImageEnhance.Contrast(tile).enhance(1.25)
            tile.putalpha(a)
        gm=glyph(symbol)
        suffix='-clear' if strong else ''
        tile.save(OUT/f'{name}{suffix}.png');atlas.alpha_composite(tile,(0,row*SIZE))
        ring=Image.new('RGBA',(SIZE,SIZE));ImageDraw.Draw(ring).ellipse((9,9,119,119),outline=(*mix(c,255,.55),240),width=5);atlas.alpha_composite(ring,(SIZE,row*SIZE))
        shard=Image.new('RGBA',(SIZE,SIZE));ImageDraw.Draw(shard).rounded_rectangle((7,7,121,121),radius=24,fill=(*mix(c,255,.38),255));atlas.alpha_composite(shard,(SIZE*2,row*SIZE))
        badge=Image.new('RGBA',(SIZE,SIZE),(*mix(c,255,.58),0));badge.putalpha(gm);badge.save(OUT/f'{name}-symbol.png');atlas.alpha_composite(badge,(SIZE*3,row*SIZE))
        socket=Image.new('RGBA',(SIZE,SIZE));sd=ImageDraw.Draw(socket)
        sd.rounded_rectangle((3,3,125,125),radius=25,fill=(17,35,29,185 if strong else 155),outline=(*mix(c,255,.4),255 if strong else 220),width=6 if strong else 4)
        atlas.alpha_composite(socket,(SIZE*5,row*SIZE))  # Miniature rival socket, one badge per shape.
        badge.putalpha(gm.point(lambda p:round(p*(.95 if strong else .58))));socket.alpha_composite(badge)
        atlas.alpha_composite(socket,(SIZE*4,row*SIZE))
    atlas.save(OUT/('atlas-clear.png' if strong else 'atlas.png'))
print('Imagegen toy block assets packaged:',OUT)
