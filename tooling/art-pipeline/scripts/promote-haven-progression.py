#!/usr/bin/env python3
"""Promote one Haven stage or a validated complete progression set."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops


ROOT = game_root()
DESIGN_ROOT = content_path(ROOT, "design") / "floating-neighborhood-v2"
HEX_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "hex"


def load_manifest(character: str) -> dict:
    path = DESIGN_ROOT / "haven" / character / "progression.json"
    if not path.is_file():
        raise SystemExit(f"Missing Haven progression manifest: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    stages = data.get("stages")
    if data.get("character") != character or not isinstance(stages, list):
        raise SystemExit(f"Invalid Haven progression manifest: {path}")
    return data


def validate_candidate(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Candidate does not exist: {path}")
    with Image.open(path) as image:
        if image.width != image.height or image.width < 1024:
            raise SystemExit(f"Candidate must be square and at least 1024px; got {image.size}: {path}")
        rgb = image.convert("RGB")
        edge = image.width - 1
        corners = ((0, 0), (edge, 0), (0, edge), (edge, edge))
        if any(max(rgb.getpixel(point)) > 5 for point in corners):
            raise SystemExit(f"Candidate corners must be pure black before matting: {path}")


def validate_prepared_pair(black_path: Path, alpha_path: Path) -> None:
    validate_candidate(black_path)
    if not alpha_path.is_file():
        raise SystemExit(f"Prepared alpha does not exist: {alpha_path}")
    with Image.open(black_path) as black_image, Image.open(alpha_path) as alpha_image:
        black = black_image.convert("RGB")
        rgba = alpha_image.convert("RGBA")
        if rgba.size != black.size:
            raise SystemExit(f"Prepared black/alpha sizes differ: {black_path}, {alpha_path}")
        alpha = rgba.getchannel("A")
        edge = rgba.width - 1
        corners = ((0, 0), (edge, 0), (0, edge), (edge, edge))
        if alpha.getbbox() is None or any(alpha.getpixel(point) for point in corners):
            raise SystemExit(f"Prepared alpha must contain art with transparent corners: {alpha_path}")
        expected = Image.new("RGBA", rgba.size, (0, 0, 0, 255))
        expected.alpha_composite(rgba)
        if ImageChops.difference(expected.convert("RGB"), black).getbbox() is not None:
            raise SystemExit(f"Prepared black candidate does not match its alpha master: {black_path}")


def production_paths(stage_key: str) -> list[Path]:
    stem = f"floating-{stage_key}"
    runtime = f"floating_neighborhood_v2_{stage_key}_hex_tile"
    return [
        DESIGN_ROOT / f"{stem}-source.png",
        DESIGN_ROOT / f"{stem}-alpha.png",
        HEX_ROOT / f"{runtime}.webp",
        HEX_ROOT / f"{runtime}_512.webp",
        HEX_ROOT / f"{runtime}_256.webp",
    ]


def run_promotion(stage_key: str, candidate: Path, *, replace: bool, dry_run: bool) -> None:
    command = [
        sys.executable,
        str(content_path(ROOT, "scripts") / "promote-floating-neighborhood-v2-tile.py"),
        "--key",
        stage_key,
        "--kind",
        "resident",
        "--candidate",
        str(candidate),
        "--skip-bounds",
    ]
    if replace:
        command.append("--replace")
    if dry_run:
        command.append("--dry-run")
    print(" ".join(command))
    subprocess.run(command, cwd=ROOT, check=True)


def run_prepared_promotion(
    stage_key: str,
    black_candidate: Path,
    alpha_candidate: Path,
    *,
    replace: bool,
    dry_run: bool,
) -> None:
    source, alpha, *_ = production_paths(stage_key)
    if not replace and any(path.exists() for path in (source, alpha)):
        raise SystemExit(
            f"Canonical art already exists for {stage_key}; pass --replace to confirm replacement"
        )
    print(f"prepared source: {black_candidate}")
    print(f"prepared alpha: {alpha_candidate}")
    print(f"canonical source: {logical_path(ROOT, source)}")
    print(f"canonical alpha: {logical_path(ROOT, alpha)}")
    if not dry_run:
        atomic_copy(black_candidate, source)
        atomic_copy(alpha_candidate, alpha)
    runtime_key = f"floating_neighborhood_v2_{stage_key}_hex_tile"
    command = [
        sys.executable,
        str(content_path(ROOT, "scripts") / "package-transparent-hex-tile.py"),
        "--source",
        str(alpha),
        "--key",
        runtime_key,
        "--skip-bounds",
    ]
    print(" ".join(command))
    if not dry_run:
        subprocess.run(command, cwd=ROOT, check=True)


def backup(paths: list[Path], backup_root: Path) -> dict[Path, Path | None]:
    result: dict[Path, Path | None] = {}
    for path in paths:
        if path.exists():
            destination = backup_root / logical_path(ROOT, path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)
            result[path] = destination
        else:
            result[path] = None
    return result


def atomic_copy(source: Path, destination: Path) -> None:
    """Replace a watched asset without writing through its open file mapping."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.haven-promotion.tmp")
    temporary.unlink(missing_ok=True)
    try:
        shutil.copy2(source, temporary)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def restore(snapshot: dict[Path, Path | None]) -> None:
    for destination, saved in snapshot.items():
        if saved is None:
            destination.unlink(missing_ok=True)
        else:
            atomic_copy(saved, destination)


def rebuild_bounds(*, dry_run: bool) -> None:
    command = [sys.executable, str(content_path(ROOT, "scripts") / "generate-hex-tile-bounds.py")]
    print(" ".join(command))
    if not dry_run:
        subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--stage", type=int, help="Promote one stage; requires --candidate.")
    selection.add_argument("--candidate-dir", help="Directory containing stage-0.png through stage-4.png.")
    selection.add_argument(
        "--prepared-dir",
        help="Directory containing matched stage-N.png and stage-N-alpha.png files.",
    )
    parser.add_argument("--candidate", help="Approved candidate used with --stage.")
    parser.add_argument("--replace", action="store_true", help="Allow intentional replacement of canonical art.")
    parser.add_argument("--dry-run", action="store_true", help="Validate candidates and print the complete promotion.")
    args = parser.parse_args()

    character = args.character.strip().lower()
    manifest = load_manifest(character)
    stages = manifest["stages"]
    if args.stage is not None:
        if args.candidate is None:
            parser.error("--stage requires --candidate")
        if args.stage not in range(len(stages)):
            parser.error(f"--stage must be between 0 and {len(stages) - 1}")
        selected = [(stages[args.stage], (content_path(ROOT, args.candidate)).resolve(), None)]
    else:
        if args.candidate is not None:
            parser.error("--candidate is valid only with --stage")
        directory_value = args.prepared_dir or args.candidate_dir
        directory = (content_path(ROOT, directory_value)).resolve()
        selected = [
            (
                stage,
                directory / f"stage-{stage['id']}.png",
                directory / f"stage-{stage['id']}-alpha.png" if args.prepared_dir else None,
            )
            for stage in stages
        ]

    for _, candidate, alpha_candidate in selected:
        if alpha_candidate is None:
            validate_candidate(candidate)
        else:
            validate_prepared_pair(candidate, alpha_candidate)

    if args.dry_run:
        for stage, candidate, alpha_candidate in selected:
            if alpha_candidate is None:
                run_promotion(stage["key"], candidate, replace=args.replace, dry_run=True)
            else:
                run_prepared_promotion(
                    stage["key"], candidate, alpha_candidate, replace=args.replace, dry_run=True
                )
        rebuild_bounds(dry_run=True)
        print("DRY RUN complete; no canonical files were changed.")
        return

    affected = [path for stage, _, _ in selected for path in production_paths(stage["key"])]
    bounds = content_path(ROOT, "constants") / "kingdom-hex-tile-bounds.gen.ts"
    affected.append(bounds)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = content_path(ROOT, ".tmp") / "haven-progressions" / character / "promotion-backups" / stamp
    snapshot = backup(affected, backup_root)
    try:
        for stage, candidate, alpha_candidate in selected:
            if alpha_candidate is None:
                run_promotion(stage["key"], candidate, replace=args.replace, dry_run=False)
            else:
                run_prepared_promotion(
                    stage["key"], candidate, alpha_candidate, replace=args.replace, dry_run=False
                )
        rebuild_bounds(dry_run=False)
    except BaseException:
        print("Promotion failed; restoring the previous complete asset set...", file=sys.stderr)
        restore(snapshot)
        raise
    print(f"DONE. Recovery snapshot: {logical_path(ROOT, backup_root)}")
    print("NEXT: render Haven QA and approve the complete progression before committing runtime assets.")


if __name__ == "__main__":
    main()
