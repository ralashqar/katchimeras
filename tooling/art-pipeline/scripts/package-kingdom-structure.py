"""Package a transparent portrait Kingdom structure into one fixed runtime WebP."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
from pathlib import Path

from PIL import Image

from hex_tile_alpha import resize_rgba_premultiplied


ROOT = game_root()
OUT_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "hex"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=768)
    parser.add_argument("--quality", type=int, default=95)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    alpha = source.getchannel("A")
    if alpha.getbbox() is None:
        raise SystemExit("Transparent source contains no visible pixels.")
    corners = ((0, 0), (source.width - 1, 0), (0, source.height - 1), (source.width - 1, source.height - 1))
    if any(alpha.getpixel(point) for point in corners):
        raise SystemExit("Transparent source must have transparent corners.")

    runtime = resize_rgba_premultiplied(source, (args.width, args.height))
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    output = OUT_ROOT / f"{args.key}_{args.width}x{args.height}.webp"
    runtime.save(output, format="WEBP", quality=args.quality, method=6)
    print(logical_path(ROOT, output), f"{output.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
