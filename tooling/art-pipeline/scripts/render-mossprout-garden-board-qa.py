"""Render the home -> tall garden -> Mossprout branch with production geometry."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import json
from math import sqrt
from pathlib import Path

from PIL import Image


ROOT = game_root()
HEX_DIR = content_path(ROOT, "assets/images/katchimeras/world/hex")
OUT_DIR = content_path(ROOT, "design/floating-neighborhood-v2/mossprout-garden-board")
CONFIG = json.loads((content_path(ROOT, "constants/kingdom-world-view.json")).read_text(encoding="utf-8"))

HEX_W = float(CONFIG["hexTiles"]["width"])
HEX_H = HEX_W * (sqrt(3) / 2) * float(CONFIG["hexTiles"]["projectionTilt"])
SPACING = CONFIG["hexTiles"]["layoutProfiles"]["floating-neighborhood-v2"]
VIEW_SCALE = 0.82
CANVAS = (1300, 1450)
CENTER = (850.0, 310.0)
TILE_FACE_BOUNDS = (46, 167, 978, 697)
GARDEN_ALPHA_BOUNDS = (57 / 2, 60 / 2, 967 / 2, 1487 / 2)


def center_for(q: int, r: int) -> tuple[float, float]:
    return (
        CENTER[0] + HEX_W * 0.75 * float(SPACING["horizontalSpacing"]) * q * VIEW_SCALE,
        CENTER[1] + HEX_H * float(SPACING["verticalSpacing"]) * (r + q / 2) * VIEW_SCALE,
    )


def paste_tile(canvas: Image.Image, filename: str, center: tuple[float, float]) -> None:
    image = Image.open(HEX_DIR / filename).convert("RGBA")
    face_left, face_top, face_right, _ = TILE_FACE_BOUNDS
    scale = HEX_W * VIEW_SCALE / (face_right - face_left)
    size = round(1024 * scale)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    left = round(center[0] - HEX_W * VIEW_SCALE / 2 - face_left * scale)
    top = round(center[1] - HEX_H * VIEW_SCALE / 2 - face_top * scale)
    canvas.alpha_composite(image, (left, top))


def paste_garden(canvas: Image.Image, locked: bool, front_isometric: bool = False) -> None:
    suffix = "_locked" if locked else ""
    if front_isometric:
        image = Image.open(
            OUT_DIR / "mossprout-garden-board-v3-front-isometric-alpha.png"
        ).convert("RGBA")
    else:
        image = Image.open(
            HEX_DIR / f"floating_neighborhood_v2_mossprout_garden_board{suffix}_512x768.webp"
        ).convert("RGBA")
    left_bound, top_bound, right_bound, _ = (
        (61, 86, 970, 1487) if front_isometric else GARDEN_ALPHA_BOUNDS
    )
    scale = HEX_W * VIEW_SCALE / (right_bound - left_bound)
    size = (round(image.width * scale), round(image.height * scale))
    image = image.resize(size, Image.Resampling.LANCZOS)
    top_center = center_for(-1, 1)
    target_left = top_center[0] - HEX_W * VIEW_SCALE / 2
    target_top = top_center[1] - HEX_H * VIEW_SCALE / 2
    canvas.alpha_composite(
        image,
        (round(target_left - left_bound * scale), round(target_top - top_bound * scale)),
    )
    if not locked and not front_isometric:
        overlay = Image.open(
            HEX_DIR / "floating_neighborhood_v2_mossprout_garden_board_merge_overlay_512x768.webp"
        ).convert("RGBA").resize(size, Image.Resampling.LANCZOS)
        canvas.alpha_composite(
            overlay,
            (round(target_left - left_bound * scale), round(target_top - top_bound * scale)),
        )


def paste_egg(canvas: Image.Image) -> None:
    image = Image.open(content_path(ROOT, "assets/images/katchimeras/cutouts/egg-base.webp")).convert("RGBA")
    width = round(200 * CONFIG["egg"]["globalScale"] * VIEW_SCALE)
    height = round(258 * CONFIG["egg"]["globalScale"] * VIEW_SCALE)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    x, y = center_for(0, 0)
    y += HEX_H * CONFIG["egg"]["verticalOffsetHexTileHeight"] * VIEW_SCALE
    canvas.alpha_composite(image, (round(x - width / 2), round(y - height / 2)))


def paste_mossprout(canvas: Image.Image) -> None:
    image = Image.open(content_path(ROOT, "assets/images/katchimeras/cutouts/mossprout.png")).convert("RGBA")
    size = round(58 * CONFIG["katchimera"]["globalScale"] * VIEW_SCALE)
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    x, y = center_for(-2, 3)
    y += HEX_H * CONFIG["katchimera"]["verticalOffsetHexTileHeight"] * VIEW_SCALE
    canvas.alpha_composite(image, (round(x - image.width / 2), round(y - image.height * 0.82)))


def render(filename: str, locked: bool, front_isometric: bool = False) -> None:
    canvas = Image.new("RGBA", CANVAS, "#0b1020")
    paste_tile(canvas, "floating_neighborhood_v2_home_hex_tile.webp", center_for(0, 0))
    paste_garden(canvas, locked, front_isometric)
    paste_tile(
        canvas,
        "floating_neighborhood_v2_mossprout_haven_stage_2_hex_tile.webp",
        center_for(-2, 3),
    )
    paste_egg(canvas)
    paste_mossprout(canvas)
    canvas.convert("RGB").save(OUT_DIR / filename, quality=94)
    print(logical_path(ROOT, OUT_DIR / filename))


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render("qa-home-garden-mossprout-revealed.png", locked=False)
    render("qa-home-garden-mossprout-locked.png", locked=True)
    render("qa-home-garden-mossprout-v3-front-isometric.png", locked=False, front_isometric=True)
