#!/usr/bin/env python3
"""Split a 4x4 achievement master into padded runtime WebP cells.

The input must already have alpha (use the Codex imagegen chroma-key helper for
generated green-screen masters). Cell order is row-major: four tracks, tier I-IV.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


TRACKS = ("bond", "quests", "journey", "together")


def fit_cell(cell: Image.Image, size: int) -> Image.Image:
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("cell contains no opaque pixels")
    subject = cell.crop(bounds)
    padding = max(12, round(size * 0.08))
    available = size - padding * 2
    subject.thumbnail((available, available), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--quality", type=int, default=86)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    if image.width != image.height:
        raise ValueError(f"expected a square image, got {image.size}")
    if image.getchannel("A").getextrema()[0] != 0:
        raise ValueError("input has no transparent pixels; remove the chroma key before splitting")

    usable = image.width - image.width % 4
    inset = (image.width - usable) // 2
    if usable != image.width:
        image = image.crop((inset, inset, inset + usable, inset + usable))
    cell_size = image.width // 4
    args.out_dir.mkdir(parents=True, exist_ok=True)
    produced: list[Path] = []
    for row, track in enumerate(TRACKS):
        for column in range(4):
            cell = image.crop((column * cell_size, row * cell_size, (column + 1) * cell_size, (row + 1) * cell_size))
            prepared = fit_cell(cell, args.size)
            output = args.out_dir / f"{track}-{column + 1}.webp"
            prepared.save(output, "WEBP", quality=args.quality, method=6, exact=True)
            produced.append(output)

    total = sum(path.stat().st_size for path in produced)
    print(f"wrote {len(produced)} achievement icons ({total / 1024:.1f} KiB) to {args.out_dir}")


if __name__ == "__main__":
    main()
