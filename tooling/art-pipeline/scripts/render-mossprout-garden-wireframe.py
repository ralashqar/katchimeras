"""Render a raster construction guide for the two-cell Mossprout garden board."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = game_root()
OUT = (
    content_path(ROOT, "design/floating-neighborhood-v2/mossprout-garden-board")
    / "geometry-guide-v2-1024x1536.png"
)

WIDTH = 1024
HEIGHT = 1536


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = ["arialbd.ttf" if bold else "arial.ttf", "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, size: int, fill: str, bold: bool = False) -> None:
    face = font(size, bold)
    box = draw.textbbox((0, 0), text, font=face)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, y), text, font=face, fill=fill)


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#101827")
    draw = ImageDraw.Draw(image)

    # The outer silhouette is one landmass, two standard hex faces tall. Only
    # the four diagonal end edges are ports; the vertical sides are natural cliff.
    top_face = [
        (350, 170),
        (674, 170),
        (900, 360),
        (900, 1170),
        (674, 1360),
        (350, 1360),
        (124, 1170),
        (124, 360),
    ]
    cliff = [(x, y + 58) for x, y in top_face]

    draw.polygon(cliff, fill="#9a6846", outline="#efc08d", width=9)
    draw.polygon(top_face, fill="#a8cf67", outline="#f8e4bd", width=12)

    # Keep the playable top open. The dashed inset is an overlay-safe region,
    # not an architectural border.
    safe = [(316, 395), (708, 395), (790, 470), (790, 1050), (708, 1135), (316, 1135), (234, 1050), (234, 470)]
    draw.line(safe + [safe[0]], fill="#ffffff", width=7, joint="curve")

    # Legal end-edge joins. Matching colours mean matching full edge segments.
    ports = [
        ((350, 170), (124, 360)),
        ((674, 170), (900, 360)),
        ((124, 1170), (350, 1360)),
        ((900, 1170), (674, 1360)),
    ]
    for start, end in ports:
        draw.line((start, end), fill="#48e5d2", width=30)
        draw.ellipse((start[0] - 15, start[1] - 15, start[0] + 15, start[1] + 15), fill="#48e5d2")
        draw.ellipse((end[0] - 15, end[1] - 15, end[0] + 15, end[1] + 15), fill="#48e5d2")

    # Explicitly mark the long side edges as smooth, uninterrupted natural edge.
    draw.line(((124, 360), (124, 1170)), fill="#f4a261", width=18)
    draw.line(((900, 360), (900, 1170)), fill="#f4a261", width=18)

    # Sparse prop zones leave the central surface clear and communicate scale.
    for x, y, radius in [(300, 330, 44), (730, 330, 36), (270, 1200, 38), (750, 1190, 46)]:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#477b3a", outline="#d9efac", width=5)
    draw.ellipse((620, 1000, 730, 1065), fill="#78c7c4", outline="#d8ffff", width=5)

    centered(draw, 32, "TWO-HEX OPEN GARDEN PLATFORM", 36, "#ffffff", True)
    centered(draw, 82, "one continuous top surface - no wall or perimeter barrier", 25, "#cbd5e1")
    centered(draw, 720, "CLEAR 6 x 7 PLAY AREA", 40, "#17330f", True)
    centered(draw, 773, "dashed line is only an overlay guide", 24, "#294f26")

    draw.text((38, 266), "UPPER-LEFT\nFUTURE PORT", font=font(22, True), fill="#48e5d2")
    draw.text((712, 262), "UPPER-RIGHT\nHOME JOIN", font=font(22, True), fill="#48e5d2")
    draw.text((28, 1260), "LOWER-LEFT\nMOSSPROUT JOIN", font=font(22, True), fill="#48e5d2")
    draw.text((718, 1260), "LOWER-RIGHT\nFUTURE PORT", font=font(22, True), fill="#48e5d2")
    draw.text((140, 745), "SMOOTH\nCLIFF EDGE", font=font(20, True), fill="#f4a261")
    draw.text((735, 745), "SMOOTH\nCLIFF EDGE", font=font(20, True), fill="#f4a261")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT)
    print(logical_path(ROOT, OUT))


if __name__ == "__main__":
    main()
