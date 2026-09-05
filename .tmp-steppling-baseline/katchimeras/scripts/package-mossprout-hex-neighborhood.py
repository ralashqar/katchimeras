#!/usr/bin/env python3
"""Extract and package the focused Mossprout hex-neighborhood art set."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from hex_tile_alpha import postprocess_hex_tile_edges


ROOT = Path(__file__).resolve().parents[1]
DESIGN_ROOT = ROOT / "design" / "mossprout-hex-neighborhood-v1"
MANIFEST_PATH = DESIGN_ROOT / "pipeline.json"

ASSETS = (
    ("main", "mossprout_focused_v1_main_hex_tile"),
    ("garden", "mossprout_focused_v1_garden_hex_tile"),
    ("memory-garden-unrestored", "mossprout_memory_garden_level_0"),
    ("memory-garden-restored", "mossprout_memory_garden_level_1"),
    ("memory-garden-restored", "mossprout_memory_garden_level_2"),
    ("seed-nursery", "mossprout_focused_v1_seed_nursery_hex_tile"),
    ("bloom-garden", "mossprout_focused_v1_bloom_garden_hex_tile"),
    ("pond-sanctuary", "mossprout_focused_v1_pond_sanctuary_hex_tile"),
    ("orchard-grove", "mossprout_focused_v1_orchard_grove_hex_tile"),
    ("ancient-tree-grove", "mossprout_focused_v1_ancient_tree_grove_hex_tile"),
    ("wildgrowth-grove", "mossprout_focused_v1_wildgrowth_grove_hex_tile"),
)


def extract_black_matte(source: Image.Image) -> Image.Image:
    """Remove only neutral near-black backdrop connected to the canvas edge.

    A global luminance key is unsafe for these tiles because their cliff seams,
    hollow logs, doorways, foliage shadows, and ambient occlusion are also dark.
    This matte flood-fills only plausible backdrop pixels from the canvas edge,
    then keeps the single connected island component and every enclosed dark
    pixel fully opaque. The shared edge pass supplies a soft antialiased contour
    with inward colour padding.
    """

    rgb = np.asarray(source.convert("RGB"), dtype=np.uint8)
    brightest = rgb.max(axis=2).astype(np.int16)
    darkest = rgb.min(axis=2).astype(np.int16)
    border = np.concatenate((brightest[0], brightest[-1], brightest[:, 0], brightest[:, -1]))
    background_limit = int(np.clip(np.percentile(border, 99.9) + 18, 24, 48))
    background_candidate = (brightest <= background_limit) & ((brightest - darkest) <= 18)

    flood = Image.fromarray(
        np.where(background_candidate, 255, 0).astype(np.uint8), mode="L"
    ).copy()
    ImageDraw.floodfill(flood, (0, 0), 128, thresh=0)
    exterior = np.asarray(flood) == 128

    foreground = Image.fromarray(
        np.where(~exterior, 255, 0).astype(np.uint8), mode="L"
    ).copy()
    center = (source.width // 2, source.height // 2)
    if foreground.getpixel(center) != 255:
        raise SystemExit("Expected the island to cover the canvas center during matte extraction.")
    ImageDraw.floodfill(foreground, center, 128, thresh=0)
    subject = np.asarray(foreground) == 128

    pixels = np.dstack((rgb, np.where(subject, 255, 0).astype(np.uint8)))
    pixels[~subject, :3] = 0
    rgba = Image.fromarray(pixels, mode="RGBA")
    return postprocess_hex_tile_edges(rgba, source)


def validate_alpha(image: Image.Image, name: str) -> None:
    alpha = image.convert("RGBA").getchannel("A")
    if alpha.getextrema() != (0, 255):
        raise SystemExit(f"{name}: expected transparent and opaque pixels")
    pixels = np.asarray(alpha)
    if np.any(pixels[0]) or np.any(pixels[-1]) or np.any(pixels[:, 0]) or np.any(pixels[:, -1]):
        raise SystemExit(f"{name}: artwork touches a canvas edge; regenerate with safe padding")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing masters and runtime tiers")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    packager = ROOT / "scripts" / "package-transparent-hex-tile.py"
    runtime_root = ROOT / "assets" / "images" / "katchimeras" / "world" / "hex"
    for stem, runtime_key in ASSETS:
        source_path = DESIGN_ROOT / f"{stem}-source.png"
        alpha_path = DESIGN_ROOT / f"{stem}-alpha.png"
        if not source_path.exists():
            raise SystemExit(f"Missing generated source: {source_path.relative_to(ROOT)}")

        tile_config = manifest["tiles"][stem]
        birefnet_matte = tile_config.get("matte") == "birefnet-heavy"
        if birefnet_matte:
            # BiRefNet Heavy is authoritative for the exterior silhouette of
            # opted-in detailed tiles. The canonical rematte command also
            # applies source-backed interior repair and the shared edge pass.
            provenance_path = DESIGN_ROOT / "generation-floating-focused-v2" / stem / "matte.json"
            if not alpha_path.exists() or not provenance_path.exists():
                raise SystemExit(
                    f"{stem}: run generate-mossprout-hex-neighborhood.py rematte --tile {stem} first"
                )
            provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
            source_digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
            if (
                provenance.get("method") != "birefnet-heavy"
                or provenance.get("model") != "BiRefNet_lite"
                or provenance.get("sourceSha256") != source_digest
            ):
                raise SystemExit(f"{stem}: stale or invalid BiRefNet matte provenance")

        if args.check:
            if not alpha_path.exists():
                raise SystemExit(f"Missing alpha master: {alpha_path.relative_to(ROOT)}")
            source = Image.open(source_path).convert("RGB")
            alpha_master = Image.open(alpha_path).convert("RGBA")
            validate_alpha(alpha_master, alpha_path.name)
            if not birefnet_matte:
                expected = extract_black_matte(source)
                if not np.array_equal(
                    np.asarray(alpha_master.getchannel("A")),
                    np.asarray(expected.getchannel("A")),
                ):
                    raise SystemExit(f"{alpha_path.name}: alpha no longer matches boundary-connected extraction")
            for suffix in ("", "_512", "_256"):
                runtime_path = runtime_root / f"{runtime_key}{suffix}.webp"
                if not runtime_path.exists():
                    raise SystemExit(f"Missing runtime asset: {runtime_path.relative_to(ROOT)}")
                validate_alpha(Image.open(runtime_path), runtime_path.name)
            print(f"checked {runtime_key}")
            continue

        if birefnet_matte:
            rgba = Image.open(alpha_path).convert("RGBA")
        else:
            source = Image.open(source_path).convert("RGB")
            rgba = extract_black_matte(source)
            rgba.save(alpha_path, "PNG", optimize=True)
        validate_alpha(rgba, alpha_path.name)
        subprocess.run(
            [
                sys.executable,
                str(packager),
                "--source",
                str(alpha_path),
                "--key",
                runtime_key,
                "--skip-bounds",
            ],
            cwd=ROOT,
            check=True,
        )

    if not args.check:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "generate-hex-tile-bounds.py")],
            cwd=ROOT,
            check=True,
        )


if __name__ == "__main__":
    main()
