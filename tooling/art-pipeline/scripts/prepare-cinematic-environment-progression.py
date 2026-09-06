#!/usr/bin/env python3
"""Normalize and package one Katchimera's cinematic environment progression."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = game_root()
DESIGN_ROOT = content_path(ROOT, "design") / "exploration-backgrounds" / "progressions"
RUNTIME_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "backgrounds"


def load_manifest(character: str) -> tuple[Path, dict]:
    directory = DESIGN_ROOT / character
    path = directory / "progression.json"
    if not path.is_file():
        raise SystemExit(f"Missing cinematic progression manifest: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    stages = data.get("stages")
    if data.get("schemaVersion") != 1 or data.get("character") != character:
        raise SystemExit(f"Unsupported cinematic progression manifest: {path}")
    if not isinstance(stages, list) or [stage.get("id") for stage in stages] != list(range(5)):
        raise SystemExit("Cinematic progression must contain contiguous Stage 0 through Stage 4")
    return directory, data


def runtime_path(character: str, stage: int, size: int, canonical_size: int) -> Path:
    suffix = "" if size == canonical_size else f"_{size}"
    return RUNTIME_ROOT / f"{character}-exploration-stage-{stage}{suffix}.webp"


def normalized_square(source: Path, size: int, center: tuple[float, float]) -> Image.Image:
    with Image.open(source) as opened:
        rgb = opened.convert("RGB")
    return ImageOps.fit(
        rgb,
        (size, size),
        method=Image.Resampling.LANCZOS,
        centering=center,
    )


def validate_output(path: Path, expected_size: int) -> None:
    if not path.is_file():
        raise SystemExit(f"Missing runtime cinematic progression asset: {path}")
    with Image.open(path) as image:
        if image.format != "WEBP" or image.size != (expected_size, expected_size):
            raise SystemExit(
                f"Invalid runtime asset {path}: expected {expected_size}px WebP, got {image.size} {image.format}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True)
    parser.add_argument("--check", action="store_true", help="Validate existing outputs without writing")
    args = parser.parse_args()

    character = args.character.strip().lower()
    source_dir, manifest = load_manifest(character)
    canonical_size = int(manifest.get("canonicalSize", 2048))
    runtime_sizes = [int(size) for size in manifest.get("runtimeSizes", [canonical_size, 1024])]
    quality = int(manifest.get("webpQuality", 88))
    if canonical_size not in runtime_sizes or any(size <= 0 or size > canonical_size for size in runtime_sizes):
        raise SystemExit("runtimeSizes must contain canonicalSize and only positive sizes no larger than it")

    for stage in manifest["stages"]:
        stage_id = int(stage["id"])
        source = source_dir / str(stage["source"])
        if not source.is_file():
            raise SystemExit(f"Missing cinematic progression source: {source}")
        center_values = stage.get("cropCenter", [0.5, 0.5])
        center = (float(center_values[0]), float(center_values[1]))
        if args.check:
            for size in runtime_sizes:
                validate_output(runtime_path(character, stage_id, size, canonical_size), size)
            continue

        master = normalized_square(source, canonical_size, center)
        for size in runtime_sizes:
            output = runtime_path(character, stage_id, size, canonical_size)
            output.parent.mkdir(parents=True, exist_ok=True)
            image = master if size == canonical_size else master.resize((size, size), Image.Resampling.LANCZOS)
            image.save(output, "WEBP", quality=quality, method=6)
            validate_output(output, size)
            print(f"WROTE {logical_path(ROOT, output)} ({size}px)")


if __name__ == "__main__":
    main()
