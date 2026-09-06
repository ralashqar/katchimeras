"""Render clean and annotated front-isometric guides for the Haven garden board."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = game_root()
OUT_DIR = content_path(ROOT, "design/floating-neighborhood-v2/mossprout-garden-board")
WIDTH = 1024
HEIGHT = 1536

TOP_FACE = [
    (354, 158),
    (670, 158),
    (908, 338),
    (884, 1130),
    (676, 1268),
    (348, 1268),
    (140, 1130),
    (116, 338),
]

# The front half drops farther on screen than the back half. This is the key
# depth cue for the requested straight-on isometric camera.
CLIFF_FACE = [
    (354, 198),
    (670, 198),
    (930, 396),
    (908, 1212),
    (688, 1398),
    (336, 1398),
    (116, 1212),
    (94, 396),
]

GRID_TOP_Y = 444
GRID_BOTTOM_Y = 1010
GRID_TOP_LEFT = 262
GRID_TOP_RIGHT = 762
GRID_BOTTOM_LEFT = 232
GRID_BOTTOM_RIGHT = 792
GRID_COLUMNS = 6
GRID_ROWS = 7


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def lerp(start: float, end: float, amount: float) -> float:
    return start + (end - start) * amount


def grid_point(column: int, row: int) -> tuple[float, float]:
    depth = row / GRID_ROWS
    left = lerp(GRID_TOP_LEFT, GRID_BOTTOM_LEFT, depth)
    right = lerp(GRID_TOP_RIGHT, GRID_BOTTOM_RIGHT, depth)
    return (
        lerp(left, right, column / GRID_COLUMNS),
        lerp(GRID_TOP_Y, GRID_BOTTOM_Y, depth),
    )


def draw_base(annotated: bool) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#101827")
    draw = ImageDraw.Draw(image)

    draw.polygon(CLIFF_FACE, fill="#9B6844", outline="#F0C082", width=8)
    # Broad front-facing cliff bands establish height without adding texture.
    for y, color in [(1236, "#B97C4D"), (1304, "#8B593C")]:
        draw.line([(126, y - 62), (342, y + 42), (682, y + 42), (898, y - 62)], fill=color, width=22)

    draw.polygon(TOP_FACE, fill="#9FCC54", outline="#F7E0A0", width=12)

    # Quiet set-dressing reservations; generation should keep these outside the grid.
    draw.polygon([(214, 284), (810, 284), (854, 408), (170, 408)], fill="#87B844", outline="#D7ED94", width=5)
    draw.polygon([(212, 1050), (812, 1050), (748, 1204), (276, 1204)], fill="#87B844", outline="#D7ED94", width=5)

    # Render each board cell as a projected quadrilateral. The back edge is
    # narrower than the front, while horizontal rows remain level and readable.
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            cell = [
                grid_point(column, row),
                grid_point(column + 1, row),
                grid_point(column + 1, row + 1),
                grid_point(column, row + 1),
            ]
            fill = "#CDEB79" if (row + column) % 2 == 0 else "#BEDC69"
            draw.polygon(cell, fill=fill, outline="#4D712C", width=4)

    grid_outline = [
        grid_point(0, 0),
        grid_point(GRID_COLUMNS, 0),
        grid_point(GRID_COLUMNS, GRID_ROWS),
        grid_point(0, GRID_ROWS),
    ]
    draw.line(grid_outline + [grid_outline[0]], fill="#FFF6D3", width=9, joint="curve")

    # Four legal connection edges only. The long sides deliberately stay solid.
    ports = [
        (TOP_FACE[0], TOP_FACE[7]),
        (TOP_FACE[1], TOP_FACE[2]),
        (TOP_FACE[6], TOP_FACE[5]),
        (TOP_FACE[3], TOP_FACE[4]),
    ]
    for start, end in ports:
        draw.line((start, end), fill="#4CE4D1", width=22)
    draw.line((TOP_FACE[7], TOP_FACE[6]), fill="#F2A65A", width=14)
    draw.line((TOP_FACE[2], TOP_FACE[3]), fill="#F2A65A", width=14)

    if annotated:
        face = font(30, True)
        small = font(22, True)
        draw.text((512, 50), "FRONT-ISOMETRIC 6 x 7 BOARD CONSTRUCTION", font=face, fill="#FFFFFF", anchor="mm")
        draw.text((512, 92), "clean grid plane + visible front cliff depth", font=font(22), fill="#CBD5E1", anchor="mm")
        draw.text((512, 356), "BACK / HIGHER IN FRAME", font=small, fill="#17330F", anchor="mm")
        draw.text((512, 1088), "FRONT / CLOSER TO CAMERA", font=small, fill="#17330F", anchor="mm")
        draw.text((512, 1334), "VISIBLE FRONT CLIFF", font=small, fill="#FFF1D6", anchor="mm")
        draw.text((34, 665), "SEALED\nSIDE", font=small, fill="#F2A65A")
        draw.text((886, 665), "SEALED\nSIDE", font=small, fill="#F2A65A")
        draw.text((54, 238), "PORT", font=small, fill="#4CE4D1")
        draw.text((886, 238), "PORT", font=small, fill="#4CE4D1")
        draw.text((52, 1182), "PORT", font=small, fill="#4CE4D1")
        draw.text((888, 1182), "PORT", font=small, fill="#4CE4D1")

    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clean = OUT_DIR / "geometry-guide-v3-front-isometric-1024x1536.png"
    annotated = OUT_DIR / "geometry-guide-v3-front-isometric-annotated-1024x1536.png"
    draw_base(False).save(clean, optimize=True)
    draw_base(True).save(annotated, optimize=True)
    print(logical_path(ROOT, clean))
    print(logical_path(ROOT, annotated))


if __name__ == "__main__":
    main()
