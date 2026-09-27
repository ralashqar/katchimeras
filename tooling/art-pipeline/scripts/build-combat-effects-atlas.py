"""Pack the current shooter bullet and small effect sprites; no generated artwork needed."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'art/assets/images/katchimeras/merge-world'
atlas = Image.new('RGBA', (256, 128))
with Image.open(ART / 'items/glow-seed-bullet.webp') as bullet:
    atlas.paste(bullet.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS), (0, 0))
for x, colour in [(128, (255, 233, 161, 255)), (192, (201, 166, 255, 255))]:
    # Render at four times size for clean downsampling on high density phones.
    ring = Image.new('RGBA', (256, 256))
    ImageDraw.Draw(ring).ellipse((12, 12, 244, 244), outline=colour, width=12)
    atlas.paste(ring.resize((64, 64), Image.Resampling.LANCZOS), (x, 0))
    mote = Image.new('RGBA', (64, 64))
    ImageDraw.Draw(mote).ellipse((8, 8, 56, 56), fill=colour)
    atlas.paste(mote.resize((16, 16), Image.Resampling.LANCZOS), (x, 64))
target = ART / 'generated/combat-effects-atlas.webp'
atlas.save(target, lossless=True)
print(f'{target}: {atlas.width}x{atlas.height}, {target.stat().st_size} bytes')
