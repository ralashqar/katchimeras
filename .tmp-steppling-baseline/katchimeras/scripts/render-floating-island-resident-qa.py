from pathlib import Path
from math import sqrt

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HEX_DIR = ROOT / "assets/images/katchimeras/world/hex"
CUTOUT_DIR = ROOT / "assets/images/katchimeras/cutouts"
OUT = ROOT / "design/floating-island-v1/qa-tasklet-feastle-cluster.png"

HEX_W = 490.0
HEX_H = HEX_W * (sqrt(3) / 2) * 0.7
VIEW_SCALE = 1.15
CANVAS = (1400, 1100)
CENTER = (700.0, 365.0)

ASSETS = {
    "empty": ("floating_empty_hex_tile_v1.webp", (16, 158, 1009, 760)),
    "home": ("floating_home_base_hex_tile_v1.webp", (16, 158, 1009, 760)),
    "tasklet": ("floating_tasklet_hex_tile_v1.webp", (106, 190, 921, 716)),
    "feastle": ("floating_feastle_hex_tile_v1.webp", (134, 214, 914, 723)),
}


def center_for(q: int, r: int) -> tuple[float, float]:
    return (
        CENTER[0] + HEX_W * 0.75 * 0.98 * q * VIEW_SCALE,
        CENTER[1] + HEX_H * 0.98 * (r + q / 2) * VIEW_SCALE,
    )


def paste_tile(canvas: Image.Image, key: str, center: tuple[float, float]) -> None:
    filename, face = ASSETS[key]
    image = Image.open(HEX_DIR / filename).convert("RGBA")
    face_left, face_top, face_right, _ = face
    scale = HEX_W * VIEW_SCALE / (face_right - face_left)
    size = round(1024 * scale)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    target_left = center[0] - HEX_W * VIEW_SCALE / 2
    target_top = center[1] - HEX_H * VIEW_SCALE / 2
    left = round(target_left - face_left * scale)
    top = round(target_top - face_top * scale)
    canvas.alpha_composite(image, (left, top))


def paste_creature(canvas: Image.Image, key: str, center: tuple[float, float]) -> None:
    image = Image.open(CUTOUT_DIR / f"{key}.png").convert("RGBA")
    size = round(116 * VIEW_SCALE)
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    anchor_y = center[1] + HEX_H * 0.2 * VIEW_SCALE
    left = round(center[0] - size / 2 + (size - image.width) / 2)
    top = round(anchor_y - 94.54 * VIEW_SCALE + (size - image.height) / 2)
    canvas.alpha_composite(image, (left, top))


def main() -> None:
    canvas = Image.new("RGBA", CANVAS, "#0b1020")
    tiles = [
        (0, -1, "empty", None),
        (-1, 0, "empty", None),
        (1, -1, "empty", None),
        (0, 0, "home", None),
        (-1, 1, "tasklet", "tasklet"),
        (1, 0, "feastle", "feastle"),
        (0, 1, "empty", None),
    ]
    placed = [(center_for(q, r), art, creature) for q, r, art, creature in tiles]
    for center, art, creature in sorted(placed, key=lambda item: (item[0][1], item[0][0])):
        paste_tile(canvas, art, center)
        if creature:
            paste_creature(canvas, creature, center)
    canvas.convert("RGB").save(OUT, quality=94)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
