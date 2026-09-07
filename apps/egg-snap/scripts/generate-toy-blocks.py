"""Deterministic low-detail toy material. Requires Pillow; no downloaded/generated texture."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'blocks'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 128
PALETTE = [('ignition','#AA91E8','star'),('turbo','#F4BE62','sun'),('coolant','#76A9EF','drop'),('nitro','#E58DB7','heart'),('grip','#70CFB5','leaf')]
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
        c=rgb(hexcolor);tile=Image.new('RGBA',(SIZE,SIZE));d=ImageDraw.Draw(tile)
        d.rounded_rectangle((3,6,125,126),radius=26,fill=(*mix(c,0,.40),220))
        face=Image.new('RGBA',(SIZE,SIZE));fd=ImageDraw.Draw(face)
        for y in range(SIZE):
            t=max(0,min(1,(y-5)/115));shade=mix(c,255,.32*(1-t/.6)) if t<.6 else mix(c,0,(t-.6)*.34)
            fd.line((0,y,SIZE,y),fill=(*shade,255))
        mask=Image.new('L',(SIZE,SIZE));ImageDraw.Draw(mask).rounded_rectangle((4,3,124,119),radius=25,fill=255)
        tile.alpha_composite(Image.composite(face,Image.new('RGBA',(SIZE,SIZE)),mask))
        sheen=Image.new('RGBA',(SIZE,SIZE));sd=ImageDraw.Draw(sheen);sd.rounded_rectangle((17,11,109,32),radius=13,fill=(255,255,255,46));tile.alpha_composite(sheen.filter(ImageFilter.GaussianBlur(3)))
        gm=glyph(symbol)
        shadow=Image.new('RGBA',(SIZE,SIZE),(*mix(c,0,.57),0));shadow.putalpha(gm.point(lambda p:round(p*(.90 if strong else .40))))
        highlight=Image.new('RGBA',(SIZE,SIZE),(255,255,255,0));highlight.putalpha(gm.point(lambda p:round(p*.42)))
        tile.alpha_composite(highlight,(0,2));tile.alpha_composite(shadow)
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
print('Toy block assets generated:',OUT)
