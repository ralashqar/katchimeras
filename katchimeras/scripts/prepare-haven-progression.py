#!/usr/bin/env python3
"""Matte Codex-generated Haven stages and create promotion-ready asset pairs."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageFilter
import numpy as np

from hex_tile_alpha import postprocess_hex_tile_edges, resize_rgba_premultiplied


ROOT = Path(__file__).resolve().parents[1]
DESIGN_ROOT = ROOT / "design" / "floating-neighborhood-v2"
TMP_ROOT = ROOT / ".tmp" / "haven-progressions"


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def load_manifest(character: str) -> dict:
    path = DESIGN_ROOT / "haven" / character / "progression.json"
    if not path.is_file():
        raise SystemExit(f"Missing Haven progression manifest: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 2 or data.get("character") != character:
        raise SystemExit(f"Unsupported Haven progression manifest: {path}")
    return data


def validate_chroma(path: Path, minimum_size: int) -> tuple[int, int]:
    if not path.is_file():
        raise SystemExit(f"Missing Codex-generated stage: {path}")
    with Image.open(path) as image:
        if image.width != image.height or image.width < minimum_size:
            raise SystemExit(
                f"Generated stage must be square and at least {minimum_size}px; got {image.size}: {path}"
            )
        return image.size


def validate_alpha(path: Path) -> dict:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        bounds = alpha.getbbox()
        corners = (
            (0, 0),
            (rgba.width - 1, 0),
            (0, rgba.height - 1),
            (rgba.width - 1, rgba.height - 1),
        )
        if bounds is None:
            raise SystemExit(f"Prepared alpha contains no visible pixels: {path}")
        if any(alpha.getpixel(point) for point in corners):
            raise SystemExit(f"Prepared alpha must have transparent corners: {path}")
        opaque = sum(1 for value in alpha.getdata() if value >= 250)
        if opaque < rgba.width * rgba.height * 0.1:
            raise SystemExit(f"Prepared alpha has implausibly little opaque content: {path}")
        left, top, right, bottom = bounds
        margins = {
            "left": left,
            "top": top,
            "right": rgba.width - right,
            "bottom": rgba.height - bottom,
        }
        return {"size": list(rgba.size), "bounds": list(bounds), "margins": margins, "opaquePixels": opaque}


def black_composite(alpha_path: Path, output: Path) -> None:
    with Image.open(alpha_path) as image:
        rgba = image.convert("RGBA")
        black = Image.new("RGBA", rgba.size, (0, 0, 0, 255))
        black.alpha_composite(rgba)
        black.convert("RGB").save(output)


def chroma_foreground_mask(source: Image.Image, target_size: tuple[int, int]) -> np.ndarray:
    """Return non-chroma pixels enclosed by the outer magenta backdrop.

    BiRefNet is useful for the antialiased outer silhouette, but it can classify
    large quiet floors as background. The generated chroma source is authoritative
    for enclosed interior pixels. Magenta-like pixels are never restored, even
    when a landmark arch or similar shape encloses them away from the canvas edge.
    Warm props, shadows, and quiet floor regions remain eligible for restoration.
    """
    rgb = source.convert("RGB").resize(target_size, Image.Resampling.LANCZOS)
    pixels = np.asarray(rgb).astype(np.int16)
    red, green, blue = (pixels[..., channel] for channel in range(3))
    chroma = (
        (red > 160)
        & (blue > 140)
        & (green < 130)
        & ((red - green) > 70)
        & ((blue - green) > 55)
    )
    outside = np.zeros_like(chroma)
    outside[0, :] = chroma[0, :]
    outside[-1, :] = chroma[-1, :]
    outside[:, 0] = chroma[:, 0]
    outside[:, -1] = chroma[:, -1]
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= chroma
        if np.array_equal(grown, outside):
            break
        outside = grown
    return (~outside) & (~chroma)


def normalize_matte(
    matted_path: Path,
    source_path: Path,
    alpha_output: Path,
    canonical_size: int,
) -> None:
    """Combine BiRefNet's exterior edge with the chroma source's intact interior."""
    with Image.open(matted_path) as matted_image:
        rgba = matted_image.convert("RGBA")
    with Image.open(source_path) as source_image:
        source_rgb = source_image.convert("RGB").resize(rgba.size, Image.Resampling.LANCZOS)
        foreground = chroma_foreground_mask(source_image, rgba.size)
    safe_interior = np.asarray(
        Image.fromarray(foreground.astype(np.uint8) * 255, mode="L").filter(ImageFilter.MinFilter(7))
    ) == 255
    pixels = np.asarray(rgba).copy()
    source_pixels = np.asarray(source_rgb)
    restore = safe_interior & (pixels[..., 3] < 255)
    pixels[..., :3] = np.where(restore[..., None], source_pixels, pixels[..., :3])
    pixels[..., 3] = np.where(restore, 255, pixels[..., 3])
    print("chroma-backed interior restore:", int(np.count_nonzero(restore)), "px")
    restored = Image.fromarray(pixels, mode="RGBA")
    processed = postprocess_hex_tile_edges(restored, source_rgb)
    if processed.size != (canonical_size, canonical_size):
        processed = resize_rgba_premultiplied(processed, (canonical_size, canonical_size))
    alpha_output.parent.mkdir(parents=True, exist_ok=True)
    processed.save(alpha_output)


def prepare_stage(
    *,
    character: str,
    stage_id: int,
    source: Path,
    output_dir: Path,
    canonical_size: int,
    force: bool,
    dry_run: bool,
) -> dict:
    alpha_output = output_dir / f"stage-{stage_id}-alpha.png"
    black_output = output_dir / f"stage-{stage_id}.png"
    if not dry_run and not force and any(path.exists() for path in (alpha_output, black_output)):
        raise SystemExit(f"Prepared Stage {stage_id} already exists; pass --force to replace it")
    work = TMP_ROOT / character / "preparation" / f"stage-{stage_id}"
    with Image.open(source) as source_image:
        source_width = source_image.width
    command = [
        sys.executable,
        str(ROOT / "scripts" / "hex-tile-pipeline.py"),
        "--source",
        str(source),
        "--key",
        f"{character}_haven_prepared_stage_{stage_id}",
        "--desc",
        f"prepared {character} Haven Stage {stage_id}",
        "--skip-rerender",
        "--size",
        str(source_width),
        "--workdir",
        str(work),
        "--skip-bounds",
        "--skip-package",
        "--preserve-canvas",
    ]
    print(" ".join(command))
    if dry_run:
        return {
            "stage": stage_id,
            "sourcePath": relative(source),
            "alphaPath": relative(alpha_output),
            "blackCandidatePath": relative(black_output),
            "status": "dry-run",
        }
    subprocess.run(command, cwd=ROOT, check=True)
    # Use the raw BiRefNet result. The pipeline's final.png restores enclosed
    # source pixels and is correct for black renders, but can restore an entire
    # non-flat chroma field produced by image generation.
    matted = work / "matted.png"
    if not matted.is_file():
        raise SystemExit(f"BiRefNet did not produce {matted}")
    normalize_matte(matted, source, alpha_output, canonical_size)
    validation = validate_alpha(alpha_output)
    black_composite(alpha_output, black_output)
    minimum_margin = min(validation["margins"].values())
    if minimum_margin < 2:
        print(f"WARNING Stage {stage_id}: visible art is within {minimum_margin}px of the source edge")
    return {
        "stage": stage_id,
        "sourcePath": relative(source),
        "sourceSha256": sha256(source),
        "alphaPath": relative(alpha_output),
        "alphaSha256": sha256(alpha_output),
        "blackCandidatePath": relative(black_output),
        "blackCandidateSha256": sha256(black_output),
        "validation": validation,
        "status": "prepared",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True)
    parser.add_argument("--source-dir", required=True, help="Contains stage-0-chroma.png through stage-4-chroma.png.")
    parser.add_argument(
        "--output-dir",
        help="Defaults to <source-dir>/prepared and contains stage-N.png plus stage-N-alpha.png.",
    )
    parser.add_argument("--stage", type=int, help="Prepare only one stage; defaults to the complete set.")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    character = args.character.strip().lower()
    manifest = load_manifest(character)
    source_dir = resolve_path(args.source_dir)
    output_dir = resolve_path(args.output_dir) if args.output_dir else source_dir / "prepared"
    stage_ids = [args.stage] if args.stage is not None else [stage["id"] for stage in manifest["stages"]]
    valid_ids = {stage["id"] for stage in manifest["stages"]}
    if any(stage_id not in valid_ids for stage_id in stage_ids):
        parser.error(f"--stage must be one of {sorted(valid_ids)}")
    minimum_size = int(manifest["generation"]["minimumSourceSize"])
    canonical_size = int(manifest["generation"]["canonicalSize"])
    sources = {stage_id: source_dir / f"stage-{stage_id}-chroma.png" for stage_id in stage_ids}
    for source in sources.values():
        validate_chroma(source, minimum_size)

    records = [
        prepare_stage(
            character=character,
            stage_id=stage_id,
            source=sources[stage_id],
            output_dir=output_dir,
            canonical_size=canonical_size,
            force=args.force,
            dry_run=args.dry_run,
        )
        for stage_id in stage_ids
    ]
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_output = output_dir / "preparation.json"
    manifest_output.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "character": character,
                "backgroundRemoval": "birefnet-matted-output",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "records": records,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"DONE {relative(manifest_output)}")
    print("NEXT: render QA with --prepared-dir, then promote with --prepared-dir after approval.")


if __name__ == "__main__":
    main()
