#!/usr/bin/env python3
"""Generate the single static 7x9 Merge board checker base texture."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw

ROOT = game_root()
OUTPUT = content_path(ROOT, "assets") / "images" / "katchimeras" / "merge-world" / "generated" / "merge-board-base.webp"
CELL = 128
COLUMNS = 7
ROWS = 9
SCALE = 4
CORNER_RADIUS = 14
OUTER_RADIUS = 10
CELL_LIGHT = "#E8CC98"
CELL_DARK = "#D5AD72"
CELL_INSET = 4


def main() -> None:
    # One uninterrupted light board surface sits underneath the checker. Only
    # alternating cells are darkened, avoiding a visible line lattice.
    image = Image.new("RGBA", (COLUMNS * CELL * SCALE, ROWS * CELL * SCALE), CELL_LIGHT)
    draw = ImageDraw.Draw(image)
    for row in range(ROWS):
        for column in range(COLUMNS):
            if (column + row) % 2 == 0:
                continue
            left = (column * CELL + CELL_INSET) * SCALE
            top = (row * CELL + CELL_INSET) * SCALE
            right = ((column + 1) * CELL - CELL_INSET) * SCALE
            bottom = ((row + 1) * CELL - CELL_INSET) * SCALE
            draw.rounded_rectangle(
                (left, top, right, bottom),
                radius=CORNER_RADIUS * SCALE,
                fill=CELL_DARK,
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
