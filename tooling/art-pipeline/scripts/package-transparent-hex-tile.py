"""Package an already-transparent square hex render into Kingdom WebP LODs.

Unlike ``hex-tile-pipeline.py``, this path never mattes, trims, or recenters the
art. The complete square canvas is resized as one unit so canonical top-face
anchors remain identical across an art-direction set.
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

from hex_tile_alpha import resize_rgba_premultiplied


ROOT = game_root()
OUT_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "hex"


def save_webp_atomically(image: Image.Image, path: Path, *, quality: int) -> None:
    """Publish a complete WebP even while Metro is reading the prior asset."""

    temporary = path.with_name(f".{path.name}.packaging.tmp")
    temporary.unlink(missing_ok=True)
    try:
        image.save(temporary, format="WEBP", quality=quality, method=6)
        for attempt in range(20):
            try:
                os.replace(temporary, path)
                return
            except OSError:
                if attempt == 19:
                    raise
                time.sleep(0.25)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument(
        "--quality",
        type=int,
        default=95,
        help="Maximum runtime WebP quality; 1024/512 default to 95 and 256 to 90.",
    )
    parser.add_argument("--lod-sizes", type=int, nargs="*", default=[512, 256])
    parser.add_argument(
        "--skip-bounds",
        action="store_true",
        help="Defer the shared bounds rebuild until a multi-asset batch is complete.",
    )
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    if source.getchannel("A").getbbox() is None:
        raise SystemExit("Transparent source contains no visible pixels.")
    if any(source.getchannel("A").getpixel(point) for point in (
        (0, 0), (source.width - 1, 0), (0, source.height - 1),
        (source.width - 1, source.height - 1),
    )):
        raise SystemExit("Transparent source must have transparent corners.")

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    outputs = [(args.size, OUT_ROOT / f"{args.key}.webp", args.quality)]
    outputs.extend(
        (lod_size, OUT_ROOT / f"{args.key}_{lod_size}.webp", 95 if lod_size >= 512 else 90)
        for lod_size in args.lod_sizes
        if 0 < lod_size < args.size
    )
    for size, path, quality in outputs:
        # Derive every LOD directly from the authoritative BiRefNet RGBA instead
        # of cascading 2048 -> 1024 -> 512/256 resizes.
        image = (
            source
            if source.size == (size, size)
            else resize_rgba_premultiplied(source, (size, size))
        )
        save_webp_atomically(image, path, quality=min(args.quality, quality))
        print(logical_path(ROOT, path), f"{path.stat().st_size // 1024} KB")

    if not args.skip_bounds:
        subprocess.run(
            [sys.executable, str(content_path(ROOT, "scripts") / "generate-hex-tile-bounds.py")],
            cwd=ROOT,
            check=True,
        )


if __name__ == "__main__":
    main()
