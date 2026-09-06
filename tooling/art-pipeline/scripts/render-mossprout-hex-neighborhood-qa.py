#!/usr/bin/env python3
"""Render the canonical focused Mossprout neighborhood QA sheet."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = game_root()
DESIGN_ROOT = content_path(ROOT, "design") / "mossprout-hex-neighborhood-v1"
RUNTIME_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "hex"
TILE_SIZE = 420
NEIGHBORHOOD_SPACING_SCALE = 1.1
X_PITCH = TILE_SIZE * 0.75 * 1.02 * NEIGHBORHOOD_SPACING_SCALE
Y_PITCH = TILE_SIZE * (math.sqrt(3) / 2) * 0.7 * 1.02 * NEIGHBORHOOD_SPACING_SCALE
PADDING = 120

PLACEMENTS = (
    ("main", 0, 1),
    ("seed-nursery", -1, 1),
    ("bloom-garden", 1, 0),
    ("garden", 0, 2),
    ("pond-sanctuary", -1, 2),
    ("orchard-grove", 1, 1),
    ("ancient-tree-grove", -1, 3),
    ("wildgrowth-grove", 1, 2),
)


def point(q: int, r: int) -> tuple[float, float]:
    return X_PITCH * q, Y_PITCH * (r + q / 2)


def render_canvas(sources: dict[str, Path], background: str) -> Image.Image:
    centers = {key: point(q, r) for key, q, r in PLACEMENTS}
    min_x = min(x for x, _ in centers.values()) - TILE_SIZE / 2
    max_x = max(x for x, _ in centers.values()) + TILE_SIZE / 2
    min_y = min(y for _, y in centers.values()) - TILE_SIZE / 2
    max_y = max(y for _, y in centers.values()) + TILE_SIZE / 2
    size = (round(max_x - min_x + PADDING * 2), round(max_y - min_y + PADDING * 2))
    if background == "checker":
        canvas = Image.new("RGBA", size, (238, 238, 238, 255))
        draw = ImageDraw.Draw(canvas)
        checker_size = 32
        for y in range(0, size[1], checker_size):
            for x in range(0, size[0], checker_size):
                if (x // checker_size + y // checker_size) % 2:
                    draw.rectangle(
                        (x, y, min(x + checker_size - 1, size[0]), min(y + checker_size - 1, size[1])),
                        fill=(184, 184, 184, 255),
                    )
    else:
        color = {
            "dark": (10, 17, 34, 255),
            "light": (246, 242, 232, 255),
            "magenta": (255, 0, 170, 255),
        }[background]
        canvas = Image.new("RGBA", size, color)
    ordered = sorted(PLACEMENTS, key=lambda item: (point(item[1], item[2])[1], item[1]))
    for key, _, _ in ordered:
        tile = Image.open(sources[key]).convert("RGBA").resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS)
        cx, cy = centers[key]
        left = round(cx - min_x + PADDING - TILE_SIZE / 2)
        top = round(cy - min_y + PADDING - TILE_SIZE / 2)
        canvas.alpha_composite(tile, (left, top))
    return canvas


def render(name: str, sources: dict[str, Path], background: str = "dark") -> None:
    render_canvas(sources, background).convert("RGB").save(DESIGN_ROOT / name, quality=94)


def render_alpha_qa(sources: dict[str, Path]) -> None:
    panels = [render_canvas(sources, background) for background in ("dark", "light", "checker", "magenta")]
    width, height = panels[0].size
    sheet = Image.new("RGB", (width * 2, height * 2), (0, 0, 0))
    for index, panel in enumerate(panels):
        sheet.paste(panel.convert("RGB"), ((index % 2) * width, (index // 2) * height))
    sheet.save(DESIGN_ROOT / "qa-alpha-matte-neighborhood.jpg", quality=95)


def render_alpha_detail_qa(sources: dict[str, Path]) -> None:
    tile_size = 512
    sheet = Image.new("RGB", (tile_size * 3, tile_size * len(PLACEMENTS)), (255, 255, 255))
    checker = Image.new("RGBA", (tile_size, tile_size), (238, 238, 238, 255))
    draw = ImageDraw.Draw(checker)
    checker_size = 24
    for y in range(0, tile_size, checker_size):
        for x in range(0, tile_size, checker_size):
            if (x // checker_size + y // checker_size) % 2:
                draw.rectangle((x, y, x + checker_size - 1, y + checker_size - 1), fill=(174, 174, 174, 255))
    for row, (key, _, _) in enumerate(PLACEMENTS):
        tile = Image.open(sources[key]).convert("RGBA").resize((tile_size, tile_size), Image.Resampling.LANCZOS)
        light = Image.new("RGBA", (tile_size, tile_size), (246, 242, 232, 255))
        light.alpha_composite(tile)
        checked = checker.copy()
        checked.alpha_composite(tile)
        sky = Image.new("RGBA", (tile_size, tile_size), (126, 224, 240, 255))
        sky.alpha_composite(tile)
        sheet.paste(light.convert("RGB"), (0, row * tile_size))
        sheet.paste(checked.convert("RGB"), (tile_size, row * tile_size))
        sheet.paste(sky.convert("RGB"), (tile_size * 2, row * tile_size))
    sheet.save(DESIGN_ROOT / "qa-alpha-matte-details.jpg", quality=96)


def main() -> None:
    runtime_sources = {
        key: RUNTIME_ROOT / f"mossprout_focused_v1_{key.replace('-', '_')}_hex_tile.webp"
        for key, _, _ in PLACEMENTS
    }
    alpha_sources = {key: DESIGN_ROOT / f"{key}-alpha.png" for key, _, _ in PLACEMENTS}
    render("qa-complete-neighborhood.jpg", runtime_sources)
    render_alpha_qa(alpha_sources)
    render_alpha_detail_qa(alpha_sources)


if __name__ == "__main__":
    main()
