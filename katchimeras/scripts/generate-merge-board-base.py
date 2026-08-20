#!/usr/bin/env python3
"""Generate the single static 7x9 Merge board cell base texture."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "generated" / "merge-board-base.webp"
CELL = 128
COLUMNS = 7
ROWS = 9
SCALE = 4
CORNER_RADIUS = 7
OUTER_RADIUS = 10
BOARD_GUTTER = "#E4C58C"
CELL_LIGHT = "#F0D8AA"
CELL_DARK = "#E8C990"


def main() -> None:
    image = Image.new("RGBA", (COLUMNS * CELL * SCALE, ROWS * CELL * SCALE), BOARD_GUTTER)
    draw = ImageDraw.Draw(image)
    for row in range(ROWS):
        for column in range(COLUMNS):
            left = column * CELL * SCALE
            top = row * CELL * SCALE
            right = (column + 1) * CELL * SCALE
            bottom = (row + 1) * CELL * SCALE
            color = CELL_DARK if (column + row) % 2 else CELL_LIGHT
            draw.rounded_rectangle(
                (left, top, right, bottom),
                radius=CORNER_RADIUS * SCALE,
                fill=color,
            )
    outer_mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(outer_mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1),
        radius=OUTER_RADIUS * SCALE,
        fill=255,
    )
    image.putalpha(outer_mask)
    image = image.resize((COLUMNS * CELL, ROWS * CELL), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "WEBP", lossless=True, method=6)
    print(f"Generated Merge board base: {image.width}x{image.height}, {OUTPUT.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
