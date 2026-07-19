"""Package an already-transparent square hex render into Kingdom WebP LODs.

Unlike ``hex-tile-pipeline.py``, this path never mattes, trims, or recenters the
art. The complete square canvas is resized as one unit so canonical top-face
anchors remain identical across an art-direction set.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "hex"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--quality", type=int, default=86)
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
    canvas = source.resize((args.size, args.size), Image.Resampling.LANCZOS)
    outputs = [(args.size, OUT_ROOT / f"{args.key}.webp", args.quality)]
    outputs.extend(
        (lod_size, OUT_ROOT / f"{args.key}_{lod_size}.webp", 82 if lod_size >= 512 else 78)
        for lod_size in args.lod_sizes
        if 0 < lod_size < args.size
    )
    for size, path, quality in outputs:
        image = canvas if size == args.size else canvas.resize((size, size), Image.Resampling.LANCZOS)
        image.save(path, format="WEBP", quality=min(args.quality, quality), method=6)
        print(path.relative_to(ROOT), f"{path.stat().st_size // 1024} KB")

    if not args.skip_bounds:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "generate-hex-tile-bounds.py")],
            cwd=ROOT,
            check=True,
        )


if __name__ == "__main__":
    main()
