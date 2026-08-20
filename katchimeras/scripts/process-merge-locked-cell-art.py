#!/usr/bin/env python3
"""Normalize and audit the lock-free Merge World Dream Mist overlays."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FULL = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "locked" / "dream-mist-full.webp"
DEFAULT_LOWER = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "locked" / "dream-mist-lower.webp"
SIZE = 192
HARD_LIMIT = 35 * 1024


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    thresholded = alpha.point(lambda value: 255 if value >= 8 else 0)
    bounds = thresholded.getbbox()
    if bounds is None:
        raise ValueError("source has no visible pixels")
    return bounds


def normalized_overlay(source_path: Path) -> Image.Image:
    """Resize the complete square canvas without repositioning its baked composition."""
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    return source.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    for quality in (86, 82, 78, 74):
        image.save(output_path, "WEBP", quality=quality, method=6, exact=True)
        if output_path.stat().st_size <= HARD_LIMIT:
            return
    raise ValueError(f"{output_path}: exceeds {HARD_LIMIT} bytes")


def process(source_path: Path, lower_source_path: Path, full_path: Path, lower_path: Path) -> None:
    full = normalized_overlay(source_path)
    save_webp(full, full_path)
    lower = normalized_overlay(lower_source_path)
    save_webp(lower, lower_path)


def audit(output_path: Path, *, lower: bool) -> None:
    with Image.open(output_path) as opened:
        image = opened.convert("RGBA")
    if image.size != (SIZE, SIZE):
        raise ValueError(f"{output_path}: expected {SIZE}x{SIZE}, got {image.size}")
    minimum, maximum = image.getchannel("A").getextrema()
    if minimum != 0 or maximum < 245:
        raise ValueError(f"{output_path}: invalid alpha range {(minimum, maximum)}")
    left, top, right, bottom = visible_bounds(image)
    minimum_extent = 164 if lower else 188
    if right - left < minimum_extent or bottom - top < (76 if lower else 188):
        raise ValueError(f"{output_path}: mist does not cover enough of the cell")
    if lower and top < round(SIZE * 0.36):
        raise ValueError(f"{output_path}: lower mist leaks into the upper cell")
    if lower:
        alpha = image.getchannel("A")
        left_bounds = alpha.crop((0, 0, SIZE // 3, SIZE)).point(lambda value: 255 if value >= 8 else 0).getbbox()
        right_bounds = alpha.crop((SIZE * 2 // 3, 0, SIZE, SIZE)).point(lambda value: 255 if value >= 8 else 0).getbbox()
        if left_bounds is None or right_bounds is None:
            raise ValueError(f"{output_path}: mist must span the cell width")
        left_top = left_bounds[1]
        right_top = right_bounds[1]
        if left_top - right_top < round(SIZE * 0.12):
            raise ValueError(f"{output_path}: upper edge must rise from left to right")
    if output_path.stat().st_size > HARD_LIMIT:
        raise ValueError(f"{output_path}: exceeds {HARD_LIMIT} bytes")
    print(f"Audited Dream Mist: {output_path.name}, {output_path.stat().st_size / 1024:.1f} KiB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--lower-source", type=Path)
    parser.add_argument("--full-output", type=Path, default=DEFAULT_FULL)
    parser.add_argument("--lower-output", type=Path, default=DEFAULT_LOWER)
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args()
    full_output = args.full_output.resolve()
    lower_output = args.lower_output.resolve()
    if not args.audit_only:
        if not args.source or not args.lower_source:
            parser.error("--source and --lower-source are required unless --audit-only is used")
        process(args.source.resolve(), args.lower_source.resolve(), full_output, lower_output)
    audit(full_output, lower=False)
    audit(lower_output, lower=True)


if __name__ == "__main__":
    main()
