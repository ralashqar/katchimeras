#!/usr/bin/env python3
"""Matte, package, and register bounds for an approved floating-v2 candidate.

This deliberately does not edit ``utils/world-visuals.ts``: runtime mapping is
a reviewed code change because resident, home, and zodiac keys have different types.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DESIGN_ROOT = ROOT / "design" / "floating-neighborhood-v2"


def run(command: list[str], *, dry_run: bool) -> None:
    print(" ".join(command))
    if not dry_run:
        subprocess.run(command, cwd=ROOT, check=True)


def replace_file(source: Path, destination: Path) -> None:
    """Atomically replace an asset, tolerating transient Windows reader locks."""

    temporary = destination.with_name(destination.name + ".replacement")
    shutil.copy2(source, temporary)
    try:
        for attempt in range(20):
            try:
                os.replace(temporary, destination)
                return
            except OSError:
                if attempt == 19:
                    raise
                time.sleep(0.25)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key", required=True, help="Lowercase resident, home-archetype, or zodiac key.")
    parser.add_argument("--kind", required=True, choices=("resident", "home", "zodiac"))
    parser.add_argument("--candidate", required=True, help="Approved 2048px source on pure black.")
    parser.add_argument("--replace", action="store_true", help="Allow replacing existing canonical art.")
    parser.add_argument(
        "--skip-bounds",
        action="store_true",
        help="Defer the shared bounds rebuild until a multi-asset batch is complete.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate and print commands without writing.")
    args = parser.parse_args()

    key = args.key.strip().lower()
    if not key or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789_" for character in key):
        raise SystemExit("--key must contain only lowercase letters, digits, and underscores.")

    candidate = (ROOT / args.candidate).resolve()
    if not candidate.is_file():
        raise SystemExit(f"Candidate does not exist: {candidate}")
    image = Image.open(candidate)
    if image.width != image.height or image.width < 1024:
        raise SystemExit(f"Candidate must be square and at least 1024px; got {image.size}.")
    rgb = image.convert("RGB")
    edge = image.width - 1
    corners = ((0, 0), (edge, 0), (0, edge), (edge, edge))
    if any(max(rgb.getpixel(point)) > 5 for point in corners):
        raise SystemExit("Candidate corners must be pure black before matting.")

    stem = (
        f"floating-home-{key}"
        if args.kind == "home"
        else f"floating-zodiac-{key}"
        if args.kind == "zodiac"
        else f"floating-{key}"
    )
    asset_key = (
        f"floating_neighborhood_v2_home_{key}_hex_tile"
        if args.kind == "home"
        else f"floating_neighborhood_v2_zodiac_{key}_hex_tile"
        if args.kind == "zodiac"
        else f"floating_neighborhood_v2_{key}_hex_tile"
    )
    source = DESIGN_ROOT / f"{stem}-source.png"
    alpha = DESIGN_ROOT / f"{stem}-alpha.png"
    work = ROOT / ".tmp" / "floating-neighborhood-v2" / stem

    existing = [path for path in (source, alpha) if path.exists() and path.resolve() != candidate]
    if existing and not args.replace:
        joined = ", ".join(str(path.relative_to(ROOT)) for path in existing)
        raise SystemExit(f"Canonical files already exist ({joined}); pass --replace for an intentional redo.")

    print(f"candidate: {candidate}")
    print(f"canonical source: {source.relative_to(ROOT)}")
    print(f"canonical alpha: {alpha.relative_to(ROOT)}")
    print(f"production key: {asset_key}")
    if not args.dry_run:
        source.parent.mkdir(parents=True, exist_ok=True)
        if candidate != source.resolve():
            shutil.copy2(candidate, source)

    pipeline = [
        sys.executable,
        str(ROOT / "scripts" / "hex-tile-pipeline.py"),
        "--source", str(source),
        "--key", asset_key,
        "--desc", f"approved floating neighbourhood v2 {args.kind} tile for {key}",
        "--skip-rerender",
        "--size", "2048",
        "--lod-sizes",
        "--workdir", str(work),
        "--skip-bounds",
        "--skip-package",
        "--preserve-canvas",
    ]
    run(pipeline, dry_run=args.dry_run)
    if not args.dry_run:
        replace_file(work / "final.png", alpha)

    package = [
        sys.executable,
        str(ROOT / "scripts" / "package-transparent-hex-tile.py"),
        "--source", str(alpha),
        "--key", asset_key,
        "--skip-bounds",
    ]
    run(package, dry_run=args.dry_run)
    if not args.skip_bounds:
        run(
            [sys.executable, str(ROOT / "scripts" / "generate-hex-tile-bounds.py")],
            dry_run=args.dry_run,
        )
    print("NEXT: inspect alpha/LODs, add the reviewed runtime mapping, render QA, then run npm run check.")


if __name__ == "__main__":
    main()
