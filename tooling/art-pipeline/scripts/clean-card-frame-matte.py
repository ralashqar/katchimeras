#!/usr/bin/env python3
"""Remove disconnected BiRefNet matte debris while preserving its soft edge."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def clean(input_path: Path, output_path: Path, threshold: int, edge_radius: int) -> None:
    image = Image.open(input_path).convert("RGBA")
    alpha = image.getchannel("A")
    width, height = image.size

    # The continuous outer rail crosses the vertical centre near the top. Find
    # its strongest alpha sample so the retained component is deterministic.
    centre_x = width // 2
    search_bottom = max(1, int(height * 0.12))
    seed_y = max(range(search_bottom), key=lambda y: alpha.getpixel((centre_x, y)))
    seed = (centre_x, seed_y)

    connected = alpha.point(lambda value: 255 if value >= threshold else 0)
    ImageDraw.floodfill(connected, seed, 128, thresh=0)
    keep = connected.point(lambda value: 255 if value == 128 else 0)
    if edge_radius:
        keep = keep.filter(ImageFilter.MaxFilter(edge_radius * 2 + 1))

    cleaned_alpha = Image.new("L", image.size, 0)
    cleaned_alpha.paste(alpha, mask=keep)
    image.putalpha(cleaned_alpha)

    # Transparent RGB must be neutral to prevent dark fringe sampling when the
    # texture is scaled by the GPU.
    transparent = Image.new("RGBA", image.size, (0, 0, 0, 0))
    transparent.alpha_composite(image)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    transparent.save(output_path, optimize=True)

    removed = sum(1 for before, after in zip(alpha.getdata(), cleaned_alpha.getdata()) if before and not after)
    print(f"cleaned {output_path} (seed={seed}, removed={removed} alpha pixels)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--in", dest="input_path", type=Path, required=True)
    parser.add_argument("--out", dest="output_path", type=Path, required=True)
    parser.add_argument("--threshold", type=int, default=96)
    parser.add_argument("--edge-radius", type=int, default=4)
    args = parser.parse_args()
    clean(args.input_path, args.output_path, args.threshold, args.edge_radius)


if __name__ == "__main__":
    main()
