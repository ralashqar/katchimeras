#!/usr/bin/env python3
"""Render deterministic review sheets for a canonical Haven progression."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = game_root()
DESIGN_ROOT = content_path(ROOT, "design") / "floating-neighborhood-v2"
BACKGROUND = "#111827"
CARD = "#1f2937"
TEXT = "#f8fafc"
MUTED = "#94a3b8"


def font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = image.copy()
    result.thumbnail(size, Image.Resampling.LANCZOS)
    return result


def card_canvas(width: int, height: int, title: str, subtitle: str | None = None) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), CARD)
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 14), title, fill=TEXT, font=font(22, bold=True))
    if subtitle:
        draw.text((18, 43), subtitle, fill=MUTED, font=font(14))
    return canvas


def alpha_tile(character: str, stage: int, prepared_dir: Path | None = None) -> Image.Image:
    path = (
        prepared_dir / f"stage-{stage}-alpha.png"
        if prepared_dir
        else DESIGN_ROOT / f"floating-{character}_haven_stage_{stage}-alpha.png"
    )
    if not path.is_file():
        source = "prepared" if prepared_dir else "canonical"
        raise SystemExit(f"Missing {source} Haven alpha: {path}")
    with Image.open(path) as image:
        return image.convert("RGBA")


def style_tile(key: str) -> Image.Image:
    path = DESIGN_ROOT / f"floating-{key}-alpha.png"
    if not path.is_file():
        raise SystemExit(f"Missing style reference alpha: {path}")
    return Image.open(path).convert("RGBA")


def place_center(canvas: Image.Image, image: Image.Image, box: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = box
    fitted = contain(image, (right - left, bottom - top))
    x = left + (right - left - fitted.width) // 2
    y = top + (bottom - top - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))


def render_progression(
    character: str,
    stages: list[dict],
    output: Path,
    prepared_dir: Path | None = None,
    review_lines: list[str] | None = None,
) -> None:
    card_width, card_height = 600, 620
    canvas = Image.new("RGBA", (card_width * 3, card_height * 2), BACKGROUND)
    for index, stage in enumerate(stages):
        x = (index % 3) * card_width
        y = (index // 3) * card_height
        card = card_canvas(card_width - 16, card_height - 16, f"Stage {stage['id']} · {stage['name']}", stage["narrative"])
        tile = alpha_tile(character, stage["id"], prepared_dir)
        place_center(card, tile, (20, 72, 520, 572))
        thumbnail = contain(tile, (128, 128))
        card.alpha_composite(thumbnail, (card.width - thumbnail.width - 18, card.height - thumbnail.height - 18))
        draw = ImageDraw.Draw(card)
        draw.text((card.width - 142, card.height - 30), "128px check", fill=MUTED, font=font(12))
        canvas.alpha_composite(card, (x + 8, y + 8))
    legend = card_canvas(card_width - 16, card_height - 16, "Progression review", "The sixth 3×2 cell is intentionally not runtime art.")
    draw = ImageDraw.Draw(legend)
    lines = ["Check persistent anchors:", *(review_lines or [])]
    line_y = 110
    for line_index, line in enumerate(lines):
        wrapped = textwrap.wrap(line, width=49, subsequent_indent="  ") or [line]
        for part in wrapped:
            draw.text(
                (32, line_y),
                part,
                fill=TEXT if line_index == 0 else MUTED,
                font=font(19, bold=line_index == 0),
            )
            line_y += 26
        line_y += 14
    canvas.alpha_composite(legend, (2 * card_width + 8, card_height + 8))
    canvas.convert("RGB").save(output, quality=95)


def render_with_character(
    character: str, stages: list[dict], output: Path, prepared_dir: Path | None = None
) -> None:
    cutout_path = content_path(ROOT, "assets") / "images" / "katchimeras" / "cutouts" / f"{character}.png"
    if not cutout_path.is_file():
        raise SystemExit(f"Missing character cutout: {cutout_path}")
    creature = Image.open(cutout_path).convert("RGBA")
    card_width, card_height = 420, 500
    canvas = Image.new("RGBA", (card_width * len(stages), card_height), BACKGROUND)
    for index, stage in enumerate(stages):
        card = card_canvas(card_width - 12, card_height - 12, f"Stage {stage['id']} · {stage['name']}")
        tile = contain(alpha_tile(character, stage["id"], prepared_dir), (390, 390))
        tile_x = (card.width - tile.width) // 2
        tile_y = 72
        card.alpha_composite(tile, (tile_x, tile_y))
        live = contain(creature, (115, 150))
        live_x = (card.width - live.width) // 2
        live_y = tile_y + round(tile.height * 0.48) - live.height // 2
        card.alpha_composite(live, (live_x, live_y))
        canvas.alpha_composite(card, (index * card_width + 6, 6))
    canvas.convert("RGB").save(output, quality=95)


def render_style_comparison(
    character: str, stages: list[dict], output: Path, prepared_dir: Path | None = None
) -> None:
    references = ["mossprout", "feastle", "steppling", "skylo", "bedrotte"]
    items = [
        *((f"{character.title()} Stage {stage['id']}", alpha_tile(character, stage["id"], prepared_dir)) for stage in stages),
        *((f"Runtime · {key.title()}", style_tile(key)) for key in references),
    ]
    cell_width, cell_height = 390, 440
    canvas = Image.new("RGBA", (cell_width * 5, cell_height * 2), BACKGROUND)
    for index, (label, tile) in enumerate(items):
        card = card_canvas(cell_width - 12, cell_height - 12, label)
        place_center(card, tile, (14, 62, card.width - 14, card.height - 14))
        canvas.alpha_composite(card, ((index % 5) * cell_width + 6, (index // 5) * cell_height + 6))
    canvas.convert("RGB").save(output, quality=95)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True)
    parser.add_argument(
        "--prepared-dir",
        help="Review stage-N-alpha.png files before they replace canonical runtime art.",
    )
    parser.add_argument("--output-dir", help="Defaults to .tmp/haven-progressions/<character>/qa.")
    args = parser.parse_args()
    character = args.character.strip().lower()
    manifest_path = DESIGN_ROOT / "haven" / character / "progression.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Missing Haven progression manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    stages = manifest["stages"]
    persistent = manifest.get("invariants", {}).get("persistentLandmarks", [])
    review_lines = [
        "• stable island, stairs and camera",
        *(f"• {line}" for line in persistent[:3]),
        "• small lower standing patch above stairs",
        "• no texture or prop-count inflation",
    ]
    prepared_dir = (content_path(ROOT, args.prepared_dir)).resolve() if args.prepared_dir else None
    output = (
        (content_path(ROOT, args.output_dir)).resolve()
        if args.output_dir
        else content_path(ROOT, ".tmp") / "haven-progressions" / character / ("qa-prepared" if prepared_dir else "qa")
    )
    output.mkdir(parents=True, exist_ok=True)
    render_progression(character, stages, output / "progression.png", prepared_dir, review_lines)
    render_with_character(character, stages, output / "with-character.png", prepared_dir)
    render_style_comparison(character, stages, output / "style-comparison.png", prepared_dir)
    print(f"DONE {logical_path(ROOT, output) if output.is_relative_to(ROOT) else output}")


if __name__ == "__main__":
    main()
