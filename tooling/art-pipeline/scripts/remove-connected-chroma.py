#!/usr/bin/env python3
"""Remove a flat sprite-sheet background without erasing similar interior colors.

Unlike global chroma-key removal, this tool only makes key-coloured pixels
transparent when they are connected to the image border. It is intended for
warm pink/coral trophies whose highlights can otherwise be mistaken for the
magenta generation background.
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def border_key(rgb: np.ndarray) -> np.ndarray:
    border = np.concatenate(
        (rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]), axis=0
    )
    return np.median(border, axis=0).astype(np.float32)


def remove_connected_background(
    input_path: Path,
    output_path: Path,
    transparent_distance: float,
    opaque_distance: float,
    interior_distance: float,
) -> tuple[str, int, int]:
    source = Image.open(input_path).convert("RGBA")
    rgba = np.asarray(source).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    key = border_key(rgb)
    distance = np.linalg.norm(rgb - key[None, None, :], axis=2)

    candidates = Image.fromarray(
        np.where(distance <= opaque_distance, 0, 255).astype(np.uint8), mode="L"
    ).copy()
    ImageDraw.floodfill(candidates, (0, 0), 128, thresh=0)
    connected = np.asarray(candidates) == 128
    enclosed_key = distance <= interior_distance
    removable = connected | enclosed_key

    denominator = max(1.0, opaque_distance - transparent_distance)
    ramp = np.clip((distance - transparent_distance) / denominator, 0.0, 1.0)
    alpha = rgba[:, :, 3].astype(np.float32)
    alpha[removable] = np.minimum(alpha[removable], ramp[removable] * 255.0)

    # Generated anti-aliased edges are composited against the chroma key. Merely
    # lowering their alpha leaves key-coloured RGB behind, which becomes a pink
    # halo when the trophy is rendered over the warm cabinet panel. Approximate
    # the original foreground colour before saving the new alpha.
    partial = removable & (alpha > 0.0) & (alpha < 255.0)
    if np.any(partial):
        alpha_fraction = np.maximum(alpha[partial, None] / 255.0, 0.05)
        foreground = (
            rgb[partial] - key[None, :] * (1.0 - alpha_fraction)
        ) / alpha_fraction
        rgba[:, :, :3][partial] = np.rint(np.clip(foreground, 0.0, 255.0)).astype(
            np.uint8
        )
    rgba[:, :, 3] = np.rint(alpha).astype(np.uint8)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(output_path)
    key_hex = "#" + "".join(f"{round(channel):02x}" for channel in key)
    transparent = int(np.count_nonzero(rgba[:, :, 3] == 0))
    partial = int(np.count_nonzero((rgba[:, :, 3] > 0) & (rgba[:, :, 3] < 255)))
    return key_hex, transparent, partial


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--transparent-distance", type=float, default=18.0)
    parser.add_argument("--opaque-distance", type=float, default=105.0)
    parser.add_argument("--interior-distance", type=float, default=65.0)
    args = parser.parse_args()

    if args.transparent_distance >= args.opaque_distance:
        parser.error("--transparent-distance must be less than --opaque-distance")
    if not 0 <= args.interior_distance <= args.opaque_distance:
        parser.error("--interior-distance must be between 0 and --opaque-distance")

    key, transparent, partial = remove_connected_background(
        args.input,
        args.out,
        args.transparent_distance,
        args.opaque_distance,
        args.interior_distance,
    )
    print(f"Wrote {args.out}")
    print(f"Key color: {key}")
    print(f"Transparent pixels: {transparent}")
    print(f"Partially transparent pixels: {partial}")


if __name__ == "__main__":
    main()
