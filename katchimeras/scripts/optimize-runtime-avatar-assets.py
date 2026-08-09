"""Build display-sized runtime avatar derivatives while preserving source masters.

Egg bodies, faces, hats, and full Wisp artwork are capped at 512px. Held items
and Wisp collection thumbnails remain capped at 256px. Full Wisp artwork is
rebuilt from archival PNGs for large reveal/detail surfaces. The catalogue's
high-resolution files remain available to art tooling but are deliberately
absent from the application import graph.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CATALOG_ROOT = ROOT / "data" / "egg-avatar"
WISP_ROOT = ROOT / "assets" / "images" / "katchimeras" / "wisps"
CATEGORIES = (
    ("bodies.json", 512),
    ("faces.json", 512),
    ("hats.json", 512),
    ("held.json", 256),
)


def optimize(path: Path, maximum: int) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as source:
        if max(source.size) <= maximum:
            return before, before
        image = source.convert("RGBA")
        image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
        image.save(path, "WEBP", quality=88, method=6)
    return before, path.stat().st_size


def build_wisp_display_asset(source_path: Path, output_path: Path) -> tuple[int, int]:
    """Rebuild from the archival PNG so a previous 256px derivative is never upscaled."""
    before = output_path.stat().st_size
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image.save(output_path, "WEBP", quality=88, method=6)
    return before, output_path.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify without rewriting assets")
    args = parser.parse_args()
    files: dict[Path, int] = {}
    for filename, display_cap in CATEGORIES:
        document = json.loads((CATALOG_ROOT / filename).read_text(encoding="utf-8"))
        for item in document["items"]:
            refs = item.get("assetRefs")
            if not refs:
                continue
            files[ROOT / refs["app"]] = display_cap
            files[ROOT / refs["thumbnail"]] = 256

    wisp_display_paths = sorted(WISP_ROOT.glob("*.webp"))
    if not args.check:
        for path in wisp_display_paths:
            source_path = path.with_suffix(".png")
            if not source_path.exists():
                raise RuntimeError(f"missing archival Wisp source: {source_path}")
            build_wisp_display_asset(source_path, path)

    for path in wisp_display_paths:
        files[path] = 512
    for path in (WISP_ROOT / "thumbnails").glob("*.webp"):
        files[path] = 256

    before_total = 0
    after_total = 0
    for path, cap in sorted(files.items()):
        if args.check:
            before = after = path.stat().st_size
        else:
            before, after = optimize(path, cap)
        before_total += before
        after_total += after
        with Image.open(path) as image:
            if max(image.size) > cap:
                raise RuntimeError(f"{path} exceeds {cap}px: {image.size}")
            if path.parent == WISP_ROOT and image.size != (512, 512):
                raise RuntimeError(f"full Wisp artwork must be 512x512: {path} is {image.size}")

    maximum_runtime_bytes = 8 * 1024 * 1024
    if after_total > maximum_runtime_bytes:
        raise RuntimeError(
            f"runtime avatar payload exceeds 8 MiB: {after_total / 1024 / 1024:.2f} MiB"
        )

    print(
        f"{'Verified' if args.check else 'Optimized'} {len(files)} runtime assets: "
        f"{before_total / 1024 / 1024:.2f} MiB -> {after_total / 1024 / 1024:.2f} MiB"
    )


if __name__ == "__main__":
    main()
