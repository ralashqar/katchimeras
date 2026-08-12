#!/usr/bin/env python3
"""Normalize and audit the single Merge World locked-cell overlay."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "locked" / "cloud-lock.webp"
SIZE = 192
VISIBLE_EXTENT = 186
HARD_LIMIT = 35 * 1024


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    thresholded = alpha.point(lambda value: 255 if value >= 8 else 0)
    bounds = thresholded.getbbox()
    if bounds is None:
        raise ValueError("source has no visible pixels")
    return bounds


def process(source_path: Path, output_path: Path) -> None:
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    crop = source.crop(visible_bounds(source))
    scale = min(VISIBLE_EXTENT / crop.width, VISIBLE_EXTENT / crop.height)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    for quality in (84, 80, 76, 72):
        canvas.save(output_path, "WEBP", quality=quality, method=6, exact=True)
        if output_path.stat().st_size <= HARD_LIMIT:
            break
    else:
        raise ValueError(f"{output_path}: exceeds {HARD_LIMIT} bytes")


def audit(output_path: Path) -> None:
    with Image.open(output_path) as opened:
        image = opened.convert("RGBA")
    if image.size != (SIZE, SIZE):
        raise ValueError(f"{output_path}: expected {SIZE}x{SIZE}, got {image.size}")
    minimum, maximum = image.getchannel("A").getextrema()
    if minimum != 0 or maximum != 255:
        raise ValueError(f"{output_path}: invalid alpha range {(minimum, maximum)}")
    left, top, right, bottom = visible_bounds(image)
    if max(right - left, bottom - top) < 176:
        raise ValueError(f"{output_path}: obstruction does not cover enough of the cell")
    if abs((left + right) - SIZE) > 4 or abs((top + bottom) - SIZE) > 4:
        raise ValueError(f"{output_path}: visible art is not centered")
    if output_path.stat().st_size > HARD_LIMIT:
        raise ValueError(f"{output_path}: exceeds {HARD_LIMIT} bytes")
    print(f"Audited locked-cell overlay: {image.width}x{image.height}, {output_path.stat().st_size / 1024:.1f} KiB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--audit-only", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if not args.audit_only:
        if not args.source:
            parser.error("--source is required unless --audit-only is used")
        process(args.source.resolve(), output)
    audit(output)


if __name__ == "__main__":
    main()
