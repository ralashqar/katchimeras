#!/usr/bin/env python3
"""Extract the central subject from a generated light checkerboard preview."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from hex_tile_alpha import postprocess_hex_tile_edges


def remove_connected_checkerboard(
    source: Image.Image,
    neutral_spread: float,
    minimum_channel: float,
    edge_contract: int,
) -> Image.Image:
    rgba = np.asarray(source.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    neutral_light = (maximum - minimum < neutral_spread) & (minimum > minimum_channel)

    # The generated checker cells all connect to the canvas edge, while the
    # intended tile is the single large island containing the canvas centre.
    mask = Image.fromarray(np.where(neutral_light, 0, 255).astype(np.uint8), "L")
    probe = mask.copy()
    centre = (mask.width // 2, mask.height // 2)
    if probe.getpixel(centre) == 0:
        raise ValueError("Expected the generated subject to cover the canvas centre")
    ImageDraw.floodfill(probe, centre, 128, thresh=0)
    foreground = np.asarray(probe) == 128
    alpha = Image.fromarray(
        np.where(foreground, rgba[:, :, 3], 0).astype(np.uint8),
        "L",
    )
    if edge_contract > 1:
        alpha = alpha.filter(ImageFilter.MinFilter(edge_contract)).filter(
            ImageFilter.GaussianBlur(0.8)
        )
    rgba[:, :, 3] = np.asarray(alpha)
    rgba[~foreground, :3] = 0
    extracted = Image.fromarray(rgba, "RGBA")
    return postprocess_hex_tile_edges(extracted, source)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--neutral-spread", type=float, default=22)
    parser.add_argument("--minimum-channel", type=float, default=190)
    parser.add_argument("--edge-contract", type=int, default=11)
    args = parser.parse_args()
    if args.edge_contract < 1 or args.edge_contract % 2 == 0:
        parser.error("--edge-contract must be a positive odd integer")

    output = remove_connected_checkerboard(
        Image.open(args.input),
        args.neutral_spread,
        args.minimum_channel,
        args.edge_contract,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.out, "PNG", optimize=True)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
