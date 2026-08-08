#!/usr/bin/env python3
"""Normalize an approved transparent accessory into the egg-avatar canvas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS_SIZE = 2048
SLOTS = {
    "hat": (0.16, 0.01, 0.84, 0.34),
    "held": (0.70, 0.38, 0.99, 0.90),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--slot", required=True, choices=SLOTS)
    parser.add_argument("--output-root", required=True, type=Path)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise SystemExit(f"No visible pixels in {args.input}")
    subject = image.crop(bounds)
    left, top, right, bottom = SLOTS[args.slot]
    target_width = round((right - left) * CANVAS_SIZE)
    target_height = round((bottom - top) * CANVAS_SIZE)
    subject.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
    x = round((left + right) * CANVAS_SIZE / 2 - subject.width / 2)
    y = round(bottom * CANVAS_SIZE - subject.height)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(subject, (x, y))

    output = args.output_root / ("hats" if args.slot == "hat" else "held")
    thumbs = output / "thumbnails"
    output.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)
    canvas.save(output / f"{args.id}.png", optimize=True)
    app = canvas.resize((1024, 1024), Image.Resampling.LANCZOS)
    app.save(output / f"{args.id}.webp", "WEBP", quality=92, method=6)
    thumb = canvas.resize((256, 256), Image.Resampling.LANCZOS)
    thumb.save(thumbs / f"{args.id}.webp", "WEBP", quality=88, method=6)


if __name__ == "__main__":
    main()
