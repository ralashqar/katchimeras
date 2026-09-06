#!/usr/bin/env python3
"""Build the exact 6x7 perspective guide used by the Haven merge island."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw

ROOT = game_root()
SOURCE = content_path(ROOT, "artifacts") / "haven-merge-board-reference-direct-6x7-alpha-no-despill.png"
OUTPUT = content_path(ROOT, "artifacts") / "haven-merge-board-perspective-guide.png"

LEFT, TOP, RIGHT, BOTTOM = 254, 236, 993, 932
COLUMNS, ROWS = 6, 7
TOP_WIDTH_RATIO = 0.87


def project(logical_x: float, logical_y: float) -> tuple[float, float]:
    width = RIGHT - LEFT
    height = BOTTOM - TOP
    depth = logical_y / height
    scale = TOP_WIDTH_RATIO + (1 - TOP_WIDTH_RATIO) * depth
    return LEFT + width / 2 + (logical_x - width / 2) * scale, TOP + logical_y


def main() -> None:
    with Image.open(SOURCE) as opened:
        image = opened.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width = RIGHT - LEFT
    height = BOTTOM - TOP
    line = (53, 232, 255, 235)
    outline = (10, 74, 91, 245)
    for column in range(COLUMNS + 1):
        logical_x = width * column / COLUMNS
        points = [project(logical_x, height * row / ROWS) for row in range(ROWS + 1)]
        draw.line(points, fill=outline, width=7, joint="curve")
        draw.line(points, fill=line, width=3, joint="curve")
    for row in range(ROWS + 1):
        logical_y = height * row / ROWS
        points = [project(width * column / COLUMNS, logical_y) for column in range(COLUMNS + 1)]
        draw.line(points, fill=outline, width=7, joint="curve")
        draw.line(points, fill=line, width=3, joint="curve")
    draw.ellipse((508 - 7, TOP - 7, 508 + 7, TOP + 7), fill=(255, 219, 91, 255))
    draw.ellipse((508 - 7, BOTTOM - 7, 508 + 7, BOTTOM + 7), fill=(255, 219, 91, 255))
    guide = Image.alpha_composite(image, overlay)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    guide.save(OUTPUT, optimize=True)
    print(f"Generated {logical_path(ROOT, OUTPUT)} ({guide.width}x{guide.height})")


if __name__ == "__main__":
    main()
