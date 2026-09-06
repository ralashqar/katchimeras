#!/usr/bin/env python3
"""Render pixel-alignment and focused-world QA for the portrait Mossprout board."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw

from hex_tile_alpha import resize_rgba_premultiplied


ROOT = game_root()
DESIGN_ROOT = content_path(ROOT, "design") / "square-haven-v1"
ASSET_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras"
BOARD = ASSET_ROOT / "world" / "square" / "mossprout-merge-island-portrait-v1.webp"
PLAYFIELD = {
    "top_left": (167, 188),
    "top_right": (836, 188),
    "bottom_left": (143, 1100),
    "bottom_right": (880, 1100),
}


def projected_point(column_fraction: float, row_fraction: float) -> tuple[float, float]:
    top_x = PLAYFIELD["top_left"][0] + (
        PLAYFIELD["top_right"][0] - PLAYFIELD["top_left"][0]
    ) * column_fraction
    bottom_x = PLAYFIELD["bottom_left"][0] + (
        PLAYFIELD["bottom_right"][0] - PLAYFIELD["bottom_left"][0]
    ) * column_fraction
    top_y = PLAYFIELD["top_left"][1]
    bottom_y = PLAYFIELD["bottom_left"][1]
    return (
        top_x + (bottom_x - top_x) * row_fraction,
        top_y + (bottom_y - top_y) * row_fraction,
    )


def board_proof() -> None:
    with Image.open(BOARD) as opened:
        board = opened.convert("RGBA")
    overlay = Image.new("RGBA", board.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for row in range(9):
        for column in range(7):
            points = [
                projected_point(column / 7, row / 9),
                projected_point((column + 1) / 7, row / 9),
                projected_point((column + 1) / 7, (row + 1) / 9),
                projected_point(column / 7, (row + 1) / 9),
            ]
            if (row + column) % 2:
                draw.polygon(points, fill=(38, 61, 10, 48))
            draw.line(points + [points[0]], fill=(255, 247, 205, 34), width=2)
    for point in PLAYFIELD.values():
        x, y = point
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 190, 65, 255))
    proof = Image.alpha_composite(board, overlay)
    output = DESIGN_ROOT / "mossprout-merge-island-portrait-v1-board-proof.png"
    proof.save(output, "PNG", optimize=True)
    print(logical_path(ROOT, output))


def paste_frame(canvas: Image.Image, source_path: Path, frame: tuple[int, int, int, int]) -> None:
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    canvas.alpha_composite(resize_rgba_premultiplied(source, (frame[2], frame[3])), (frame[0], frame[1]))


def world_proof() -> None:
    scale = 0.5
    canvas = Image.new("RGBA", (660, 781), (135, 205, 238, 255))
    square = ASSET_ROOT / "world" / "square"
    islands = [
        ("mossprout-seed-nursery-l4.webp", (30, 190, 300, 300)),
        ("mossprout-bloom-garden-l4.webp", (990, 190, 300, 300)),
        ("mossprout-pond-sanctuary-l4.webp", (30, 650, 300, 300)),
        ("mossprout-orchard-grove-l4.webp", (990, 650, 300, 300)),
        ("mossprout-ancient-tree-grove-l4.webp", (30, 1110, 300, 300)),
        ("mossprout-wildgrowth-grove-l4.webp", (990, 1110, 300, 300)),
    ]
    for name, frame in islands:
        paste_frame(canvas, square / name, tuple(round(value * scale) for value in frame))
    paste_frame(canvas, square / "mossprout-main-environment.webp", (180, 30, 300, 300))
    paste_frame(canvas, BOARD, (180, 315, 300, 436))

    chair_path = ASSET_ROOT / "merge-world" / "ui" / "order-chair.webp"
    tray_path = ASSET_ROOT / "merge-world" / "ui" / "order-service-tray.webp"
    for center_x in (530, 660, 790):
        center = round(center_x * scale)
        top = round(638 * scale)
        paste_frame(canvas, chair_path, (center - 39, top, 77, 77))
        paste_frame(canvas, tray_path, (center - 34, top + 48, 68, 30))

    output = DESIGN_ROOT / "mossprout-merge-island-portrait-v1-world-proof.png"
    canvas.save(output, "PNG", optimize=True)
    print(logical_path(ROOT, output))


def main() -> None:
    board_proof()
    world_proof()


if __name__ == "__main__":
    main()
