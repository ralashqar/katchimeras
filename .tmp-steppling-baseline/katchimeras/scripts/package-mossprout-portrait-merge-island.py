#!/usr/bin/env python3
"""Package the approved portrait Mossprout merge island into runtime WebP LODs."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from hex_tile_alpha import postprocess_hex_tile_edges, resize_rgba_premultiplied


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = (
    ROOT
    / "design"
    / "square-haven-v1"
    / "mossprout-merge-island-portrait-v1-alpha.png"
)
OUTPUT_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "square"
MASTER_SIZE = (1024, 1488)
OUTPUTS = (
    ("mossprout-merge-island-portrait-v1.webp", (1024, 1488), 94),
    ("mossprout-merge-island-portrait-v1-512.webp", (512, 744), 92),
    ("mossprout-merge-island-portrait-v1-256.webp", (256, 372), 88),
)


def fit_master(source: Image.Image) -> Image.Image:
    """Fit without distorting the generated camera or silhouette."""

    source = source.convert("RGBA")
    scale = min(MASTER_SIZE[0] / source.width, MASTER_SIZE[1] / source.height)
    size = (round(source.width * scale), round(source.height * scale))
    fitted = resize_rgba_premultiplied(source, size)
    master = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    master.alpha_composite(
        fitted,
        ((MASTER_SIZE[0] - size[0]) // 2, (MASTER_SIZE[1] - size[1]) // 2),
    )
    return master


def validate(source: Image.Image) -> None:
    alpha = source.getchannel("A")
    if alpha.getbbox() is None:
        raise SystemExit("Portrait merge-island source contains no visible pixels.")
    corners = (
        (0, 0),
        (source.width - 1, 0),
        (0, source.height - 1),
        (source.width - 1, source.height - 1),
    )
    if any(alpha.getpixel(point) for point in corners):
        raise SystemExit("Portrait merge-island source must have transparent corners.")


def remove_chroma_spill(source: Image.Image) -> Image.Image:
    """Drop residual magenta matte pixels; magenta is forbidden in this asset."""

    rgba = np.asarray(source.convert("RGBA")).copy()
    red = rgba[:, :, 0].astype(np.int16)
    green = rgba[:, :, 1].astype(np.int16)
    blue = rgba[:, :, 2].astype(np.int16)
    spill = (
        (rgba[:, :, 3] > 0)
        & (red > green + 35)
        & (blue > green + 25)
        & (red > 120)
        & (blue > 120)
    )
    rgba[spill, 3] = 0
    print("chroma-spill cleanup:", int(np.count_nonzero(spill)), "px")
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()

    source_path = args.source if args.source.is_absolute() else ROOT / args.source
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    validate(source)
    source = remove_chroma_spill(source)
    source = postprocess_hex_tile_edges(source, source)
    master = fit_master(source)

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for name, size, quality in OUTPUTS:
        output = OUTPUT_ROOT / name
        image = master if size == MASTER_SIZE else resize_rgba_premultiplied(master, size)
        image.save(output, "WEBP", quality=quality, alpha_quality=100, method=6, exact=True)
        print(f"Wrote {output.relative_to(ROOT)} ({size[0]}x{size[1]}, {output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
