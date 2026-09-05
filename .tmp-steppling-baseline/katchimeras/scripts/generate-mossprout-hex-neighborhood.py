#!/usr/bin/env python3
"""Canonical generator and promoter for Mossprout's focused hex neighborhood."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESIGN_ROOT = ROOT / "design" / "mossprout-hex-neighborhood-v1"
MANIFEST_PATH = DESIGN_ROOT / "pipeline.json"
GENERATOR = ROOT / "scripts" / "generate-katchimera-hex-tile.py"
MATTE_PIPELINE = ROOT / "scripts" / "hex-tile-pipeline.py"
OUT_ROOT = ROOT / ".tmp" / "katchimera-hex-tiles"
LOCK_ID = "mossprout-hex-neighborhood-v2"


def load_manifest() -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("pipelineId") != LOCK_ID:
        raise SystemExit(f"{MANIFEST_PATH.relative_to(ROOT)} must declare pipelineId={LOCK_ID!r}")
    if manifest.get("kind") != "floating-focused-v2" or manifest.get("model") != "nano":
        raise SystemExit("Mossprout pipeline must remain on floating-focused-v2 with the FAL nano edit model.")
    order = manifest.get("generationOrder")
    tiles = manifest.get("tiles")
    if not isinstance(order, list) or not isinstance(tiles, dict) or set(order) != set(tiles):
        raise SystemExit("pipeline.json generationOrder and tiles must contain the same keys.")
    for key, tile in tiles.items():
        if not tile.get("guide") or not tile.get("theme"):
            raise SystemExit(f"pipeline.json tile {key!r} is missing guide or theme.")
        if bool(tile.get("base")) == bool(tile.get("baseTile")):
            raise SystemExit(f"pipeline.json tile {key!r} must declare exactly one of base or baseTile.")
    return manifest


def selected_keys(manifest: dict, requested: list[str]) -> list[str]:
    order = list(manifest["generationOrder"])
    if not requested or "all" in requested:
        return order
    unknown = sorted(set(requested) - set(order))
    if unknown:
        raise SystemExit(f"Unknown tile(s): {', '.join(unknown)}")
    requested_set = set(requested)
    return [key for key in order if key in requested_set]


def published_source(key: str) -> Path:
    return DESIGN_ROOT / f"{key}-source.png"


def candidate_source(key: str) -> Path:
    return OUT_ROOT / key / "candidate-1.png"


def completed_candidate(key: str) -> Path | None:
    candidate = candidate_source(key)
    records_path = candidate.parent / "candidates.json"
    if not candidate.exists() or not records_path.exists():
        return None
    try:
        records = json.loads(records_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    record = records[0] if isinstance(records, list) and len(records) == 1 else None
    if not isinstance(record, dict) or record.get("status") != "generated" or record.get("visualKey") != key:
        return None
    return candidate


def resolve_base(tile: dict, generated: set[str]) -> Path:
    if tile.get("base"):
        return ROOT / tile["base"]
    dependency = str(tile["baseTile"])
    candidate = completed_candidate(dependency)
    if candidate is not None:
        return candidate
    return published_source(dependency)


def generate(manifest: dict, keys: list[str], *, dry_run: bool) -> None:
    generated: set[str] = set()
    for key in keys:
        tile = manifest["tiles"][key]
        base = resolve_base(tile, generated)
        guide = ROOT / tile["guide"]
        for path, label in ((base, "base"), (guide, "guide")):
            if not path.exists():
                raise SystemExit(f"{key}: missing {label} image {path.relative_to(ROOT)}")
        command = [
            sys.executable,
            str(GENERATOR),
            "--visual-key",
            key,
            "--kind",
            manifest["kind"],
            "--pipeline-lock",
            LOCK_ID,
            "--model",
            manifest["model"],
            "--quality",
            manifest["quality"],
            "--gpt-size",
            str(manifest["gptSize"]),
            "--base",
            str(base),
            "--guide",
            str(guide),
            "--theme",
            tile["theme"],
        ]
        if dry_run:
            command.append("--dry-run")
        print(f"{key}: {'dry-run' if dry_run else 'generate'} from {base.relative_to(ROOT)}")
        subprocess.run(command, cwd=ROOT, check=True)
        generated.add(key)


def promote(manifest: dict, keys: list[str]) -> None:
    for key in keys:
        candidate = candidate_source(key)
        if not candidate.exists():
            raise SystemExit(f"{key}: missing reviewed candidate {candidate.relative_to(ROOT)}")
        records_path = candidate.parent / "candidates.json"
        try:
            records = json.loads(records_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"{key}: invalid generation record {records_path.relative_to(ROOT)}: {exc}") from None
        record = records[0] if isinstance(records, list) and len(records) == 1 else None
        if not isinstance(record, dict) or record.get("status") != "generated":
            raise SystemExit(
                f"{key}: candidate provenance is not a completed generation. "
                "Run the canonical generate action without --dry-run, then review it before promotion."
            )
        if record.get("visualKey") != key or record.get("kind") != manifest["kind"]:
            raise SystemExit(f"{key}: candidate provenance does not match the locked manifest.")
        destination = published_source(key)
        shutil.copy2(candidate, destination)
        provenance = DESIGN_ROOT / "generation-floating-focused-v2" / key
        provenance.mkdir(parents=True, exist_ok=True)
        for source_name, destination_name in (
            ("candidate-1-prompt.txt", "prompt.txt"),
            ("candidates.json", "generation.json"),
        ):
            source = candidate.parent / source_name
            if not source.exists():
                raise SystemExit(f"{key}: missing provenance file {source.relative_to(ROOT)}")
            shutil.copy2(source, provenance / destination_name)
        print(f"promoted {key} -> {destination.relative_to(ROOT)}")
    subprocess.run([sys.executable, "scripts/package-mossprout-hex-neighborhood.py"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "scripts/render-mossprout-hex-neighborhood-qa.py"], cwd=ROOT, check=True)


def rematte(manifest: dict, keys: list[str]) -> None:
    """Rebuild configured alpha masters through Supabase/FAL BiRefNet Heavy."""

    for key in keys:
        tile = manifest["tiles"][key]
        if tile.get("matte") != "birefnet-heavy":
            raise SystemExit(
                f"{key}: pipeline.json must explicitly opt into matte='birefnet-heavy' before a network rematte."
            )
        source = published_source(key)
        work = OUT_ROOT / key / "birefnet-matte"
        subprocess.run(
            [
                sys.executable,
                str(MATTE_PIPELINE),
                "--source",
                str(source),
                "--key",
                f"mossprout-{key}-rematte",
                "--desc",
                f"approved Mossprout {key} floating hex tile",
                "--skip-rerender",
                "--preserve-canvas",
                "--size",
                "2048",
                "--workdir",
                str(work),
                "--skip-package",
            ],
            cwd=ROOT,
            check=True,
        )
        alpha = DESIGN_ROOT / f"{key}-alpha.png"
        shutil.copy2(work / "final.png", alpha)
        provenance_dir = DESIGN_ROOT / "generation-floating-focused-v2" / key
        provenance_dir.mkdir(parents=True, exist_ok=True)
        provenance = {
            "method": "birefnet-heavy",
            "model": "BiRefNet_lite",
            "falModelInput": "General Use (Heavy)",
            "endpoint": "remove-image-background",
            "operatingResolution": "1024x1024",
            "refineForeground": True,
            "source": str(source.relative_to(ROOT)).replace("\\", "/"),
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "postprocess": "source-backed-interior-repair+inward-rgb-padding+soft-edge-contraction",
        }
        (provenance_dir / "matte.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
        print(f"rematted {key} -> {alpha.relative_to(ROOT)}")
    subprocess.run([sys.executable, "scripts/package-mossprout-hex-neighborhood.py"], cwd=ROOT, check=True)
    subprocess.run([sys.executable, "scripts/render-mossprout-hex-neighborhood-qa.py"], cwd=ROOT, check=True)


def check(manifest: dict) -> None:
    generator_source = GENERATOR.read_text(encoding="utf-8")
    for contract in manifest["requiredPromptContracts"]:
        if contract not in generator_source:
            raise SystemExit(f"Generator lost locked prompt contract: {contract}")
    matte_source = (ROOT / "scripts" / "package-mossprout-hex-neighborhood.py").read_text(encoding="utf-8")
    for contract in manifest.get("requiredMatteContracts", []):
        if contract not in matte_source:
            raise SystemExit(f"Packager lost locked matte contract: {contract}")
    for key in manifest["generationOrder"]:
        if not published_source(key).exists():
            raise SystemExit(f"Missing canonical source: {published_source(key).relative_to(ROOT)}")
    for obsolete in (
        ROOT / "design" / "mossprout-hex-neighborhood-concepts",
        DESIGN_ROOT / "base-alpha.png",
        DESIGN_ROOT / "qa-base-fill-neighborhood.jpg",
    ):
        if obsolete.exists():
            raise SystemExit(f"Obsolete Mossprout pipeline artifact must stay removed: {obsolete.relative_to(ROOT)}")
    package_source = (ROOT / "package.json").read_text(encoding="utf-8")
    for script_name in (
        "art:mossprout:hex:generate",
        "art:mossprout:hex:promote",
        "art:mossprout:hex:check",
    ):
        if script_name not in package_source:
            raise SystemExit(f"package.json is missing canonical script {script_name}")
    if "art:haven:hex-neighborhood" in package_source:
        raise SystemExit("package.json must not restore the ambiguous art:haven:hex-neighborhood aliases.")
    subprocess.run(
        [sys.executable, "scripts/package-mossprout-hex-neighborhood.py", "--check"],
        cwd=ROOT,
        check=True,
    )
    print(f"{LOCK_ID}: manifest, prompt contracts, sources, alpha masters, and runtime tiers are valid.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("generate", "promote", "rematte", "check"))
    parser.add_argument("--tile", action="append", default=[], help="Tile key; repeat as needed. Defaults to all.")
    parser.add_argument("--dry-run", action="store_true", help="Write prompts without generating; generate action only.")
    args = parser.parse_args()
    if args.dry_run and args.action != "generate":
        raise SystemExit("--dry-run is valid only with the generate action.")
    manifest = load_manifest()
    keys = selected_keys(manifest, args.tile)
    if args.action == "generate":
        generate(manifest, keys, dry_run=args.dry_run)
    elif args.action == "promote":
        promote(manifest, keys)
    elif args.action == "rematte":
        rematte(manifest, keys)
    else:
        check(manifest)


if __name__ == "__main__":
    main()
