"""Bake a centered scale and normalized offset into a transparent image canvas."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
from pathlib import Path

from PIL import Image

from hex_tile_alpha import resize_rgba_premultiplied


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--scale", required=True, type=float)
    parser.add_argument("--offset-x", default=0.0, type=float)
    parser.add_argument("--offset-y", default=0.0, type=float)
    args = parser.parse_args()

    if not 0 < args.scale <= 1:
        raise SystemExit("--scale must be greater than 0 and no more than 1")

    source = Image.open(args.input).convert("RGBA")
    width, height = source.size
    fitted = resize_rgba_premultiplied(
        source,
        (round(width * args.scale), round(height * args.scale)),
    )
    left = round((width - fitted.width) / 2 + width * args.offset_x)
    top = round((height - fitted.height) / 2 + height * args.offset_y)
    canvas = Image.new("RGBA", source.size, (0, 0, 0, 0))
    canvas.alpha_composite(fitted, (left, top))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output)
    print(f"Wrote {output} at {width}x{height}; scale={args.scale}; offset=({args.offset_x}, {args.offset_y})")


if __name__ == "__main__":
    main()
