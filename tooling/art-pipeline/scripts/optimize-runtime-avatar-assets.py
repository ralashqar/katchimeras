"""Build display-sized runtime avatar derivatives while preserving source masters.

Egg bodies, faces, hats, and full Wisp artwork are capped at 512px. Held items
and Wisp collection thumbnails remain capped at 256px. Zoomable Egg hero
surfaces use dedicated 1536px WebPs rebuilt from the archival PNGs. The PNG
masters remain available to art tooling but are deliberately absent from the
application import graph.
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import json
from pathlib import Path

from PIL import Image


ROOT = game_root()
CATALOG_ROOT = content_path(ROOT, "data") / "egg-avatar"
WISP_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "wisps"
CATEGORIES = (
    ("bodies.json", 512),
    ("faces.json", 512),
    ("hats.json", 512),
    ("held.json", 256),
)
AVATAR_HIGH_SIZE = 1536
AVATAR_HIGH_QUALITY = 92


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


def avatar_high_path(source_path: Path) -> Path:
    return source_path.parent / "high" / source_path.with_suffix(".webp").name


def build_avatar_high_asset(source_path: Path, output_path: Path) -> tuple[int, int]:
    before = output_path.stat().st_size if output_path.exists() else 0
    if output_path.exists() and output_path.stat().st_mtime_ns >= source_path.stat().st_mtime_ns:
        try:
            with Image.open(output_path) as existing:
                if existing.format == "WEBP" and existing.size == (AVATAR_HIGH_SIZE, AVATAR_HIGH_SIZE):
                    return before, before
        except OSError:
            # A killed encoder can leave a partial file. Rebuild it from the
            # immutable source master instead of making recovery manual.
            pass
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
        image.thumbnail((AVATAR_HIGH_SIZE, AVATAR_HIGH_SIZE), Image.Resampling.LANCZOS)
        image.save(output_path, "WEBP", quality=AVATAR_HIGH_QUALITY, method=6)
    return before, output_path.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify without rewriting assets")
    args = parser.parse_args()
    files: dict[Path, int] = {}
    high_files: set[Path] = set()
    for filename, display_cap in CATEGORIES:
        document = json.loads((CATALOG_ROOT / filename).read_text(encoding="utf-8"))
        for item in document["items"]:
            refs = item.get("assetRefs")
            if not refs:
                continue
            source_path = content_path(ROOT, refs["high"])
            high_path = avatar_high_path(source_path)
            if not args.check:
                build_avatar_high_asset(source_path, high_path)
            files[high_path] = AVATAR_HIGH_SIZE
            high_files.add(high_path)
            files[content_path(ROOT, refs["app"])] = display_cap
            files[content_path(ROOT, refs["thumbnail"])] = 256

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
            if path.suffix.lower() == ".webp" and image.format != "WEBP":
                raise RuntimeError(f"runtime derivative must be WebP: {path}")
            if max(image.size) > cap:
                raise RuntimeError(f"{path} exceeds {cap}px: {image.size}")
            if path in high_files and image.size != (AVATAR_HIGH_SIZE, AVATAR_HIGH_SIZE):
                raise RuntimeError(
                    f"high-resolution avatar artwork must be {AVATAR_HIGH_SIZE}x{AVATAR_HIGH_SIZE}: "
                    f"{path} is {image.size}"
                )
            if path.parent == WISP_ROOT and image.size != (512, 512):
                raise RuntimeError(f"full Wisp artwork must be 512x512: {path} is {image.size}")

    high_total = sum(path.stat().st_size for path in high_files)
    standard_total = after_total - high_total
    maximum_standard_runtime_bytes = 8 * 1024 * 1024
    maximum_high_runtime_bytes = 16 * 1024 * 1024
    if standard_total > maximum_standard_runtime_bytes:
        raise RuntimeError(
            f"standard runtime avatar payload exceeds 8 MiB: {standard_total / 1024 / 1024:.2f} MiB"
        )
    if high_total > maximum_high_runtime_bytes:
        raise RuntimeError(
            f"high-resolution runtime avatar payload exceeds 16 MiB: {high_total / 1024 / 1024:.2f} MiB"
        )

    print(
        f"{'Verified' if args.check else 'Optimized'} {len(files)} runtime assets: "
        f"{before_total / 1024 / 1024:.2f} MiB -> {after_total / 1024 / 1024:.2f} MiB "
        f"({high_total / 1024 / 1024:.2f} MiB high-resolution WebPs)"
    )


if __name__ == "__main__":
    main()
