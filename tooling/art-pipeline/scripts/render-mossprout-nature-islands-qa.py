#!/usr/bin/env python3
"""Render Mossprout's production nature-island layout for visual QA."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from pathlib import Path

from PIL import Image, ImageDraw

from hex_tile_alpha import resize_rgba_premultiplied


ROOT = game_root()
ASSET_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "square"
DESIGN_ROOT = content_path(ROOT, "design") / "mossprout-nature-islands-v1"
OUTPUT_ROOT = content_path(ROOT, "artifacts") / "mossprout-nature-islands-v1"

SCENE_SIZE = (1320, 1562)
ENVIRONMENT_FRAME = (360, 60, 600, 600)
GARDEN_FRAME = (360, 630, 600, 872)
ISLAND_SIZE = 300
THUMBNAIL_SIZE = 256
THUMBNAIL_CELL = (320, 308)
COLUMN_CENTERS = (180, 1140)
ROW_CENTERS = (340, 660, 1040)

ISLANDS = (
    ("seed-nursery", "Seed Nursery", 0, 0),
    ("bloom-garden", "Bloom Garden", 1, 0),
    ("pond-sanctuary", "Pond Sanctuary", 0, 1),
    ("orchard-grove", "Orchard Grove", 1, 1),
    ("ancient-tree-grove", "Ancient Tree Grove", 0, 2),
    ("wildgrowth-grove", "Wildgrowth Grove", 1, 2),
)


def sky_plate() -> Image.Image:
    width, height = SCENE_SIZE
    image = Image.new("RGBA", SCENE_SIZE)
    draw = ImageDraw.Draw(image)
    top = (55, 187, 237)
    bottom = (154, 222, 246)
    for y in range(height):
        amount = y / max(1, height - 1)
        color = tuple(round(start + (end - start) * amount) for start, end in zip(top, bottom))
        draw.line((0, y, width, y), fill=(*color, 255))
    return image


def composite_asset(canvas: Image.Image, filename: str, frame: tuple[int, int, int, int]) -> None:
    left, top, width, height = frame
    with Image.open(ASSET_ROOT / filename) as opened:
        sprite = resize_rgba_premultiplied(opened.convert("RGBA"), (width, height))
    canvas.alpha_composite(sprite, (left, top))


def island_frame(column: int, row: int) -> tuple[int, int, int, int]:
    return (
        COLUMN_CENTERS[column] - ISLAND_SIZE // 2,
        ROW_CENTERS[row] - ISLAND_SIZE // 2,
        ISLAND_SIZE,
        ISLAND_SIZE,
    )


def label_islands(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    for _, label, column, row in ISLANDS:
        left, top, width, _ = island_frame(column, row)
        box = draw.textbbox((0, 0), label)
        text_width = box[2] - box[0]
        x = left + (width - text_width) // 2
        y = top + 4
        draw.rounded_rectangle((x - 7, y - 3, x + text_width + 7, y + 14), 7, fill=(30, 48, 26, 190))
        draw.text((x, y), label, fill=(255, 250, 220, 255))


def render_world() -> Image.Image:
    canvas = sky_plate()
    composite_asset(canvas, "mossprout-main-environment.webp", ENVIRONMENT_FRAME)
    composite_asset(canvas, "mossprout-merge-island-portrait-v1.webp", GARDEN_FRAME)
    for key, _, column, row in ISLANDS:
        composite_asset(canvas, f"mossprout-{key}-l4.webp", island_frame(column, row))
    label_islands(canvas)
    return canvas


def render_thumbnail_sheet() -> Image.Image:
    cell_width, cell_height = THUMBNAIL_CELL
    canvas = Image.new("RGBA", (cell_width * 3, cell_height * 2), (133, 210, 240, 255))
    draw = ImageDraw.Draw(canvas)
    for index, (key, label, _, _) in enumerate(ISLANDS):
        column = index % 3
        row = index // 3
        x = column * cell_width + (cell_width - THUMBNAIL_SIZE) // 2
        y = row * cell_height + 8
        with Image.open(ASSET_ROOT / f"mossprout-{key}-l4-256.webp") as opened:
            sprite = opened.convert("RGBA")
        canvas.alpha_composite(sprite, (x, y))
        box = draw.textbbox((0, 0), label)
        text_width = box[2] - box[0]
        text_x = column * cell_width + (cell_width - text_width) // 2
        text_y = row * cell_height + THUMBNAIL_SIZE + 18
        draw.rounded_rectangle(
            (text_x - 8, text_y - 4, text_x + text_width + 8, text_y + 15),
            8,
            fill=(30, 48, 26, 190),
        )
        draw.text((text_x, text_y), label, fill=(255, 250, 220, 255))
    return canvas


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    world = render_world()
    world_path = OUTPUT_ROOT / "level-4-world-layout.png"
    world.save(world_path, "PNG", optimize=True)

    with Image.open(DESIGN_ROOT / "references" / "layout-guide.jpg") as opened:
        reference = opened.convert("RGBA")
    reference = resize_rgba_premultiplied(reference, (SCENE_SIZE[0], SCENE_SIZE[0]))
    reference_panel = sky_plate()
    reference_panel.alpha_composite(reference, (0, (SCENE_SIZE[1] - reference.height) // 2))
    comparison = Image.new("RGBA", (SCENE_SIZE[0] * 2, SCENE_SIZE[1]))
    comparison.alpha_composite(reference_panel, (0, 0))
    comparison.alpha_composite(world, (SCENE_SIZE[0], 0))
    comparison_path = OUTPUT_ROOT / "layout-reference-comparison.png"
    comparison.save(comparison_path, "PNG", optimize=True)

    thumbnail_path = OUTPUT_ROOT / "level-4-thumbnail-sheet.png"
    render_thumbnail_sheet().save(thumbnail_path, "PNG", optimize=True)

    print(logical_path(ROOT, world_path))
    print(logical_path(ROOT, comparison_path))
    print(logical_path(ROOT, thumbnail_path))


if __name__ == "__main__":
    main()
