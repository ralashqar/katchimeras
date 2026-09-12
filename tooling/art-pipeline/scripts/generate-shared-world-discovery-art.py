"""Reviewed shared-world art recipe using the existing FAL generation/matte pipeline.

Mossprout reference inputs are explicitly requested for this Steppling/mist pair.
This does not alter or bypass the locked Mossprout tile generation manifest.
"""
from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = game_root()
DESIGN = content_path(ROOT, "design/shared-world-discovery-v2")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["generate", "matte", "package"])
    parser.add_argument("--tile", choices=["steppling", "mist"], required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    brief = json.loads((DESIGN / "briefs.json").read_text(encoding="utf-8"))
    tile = brief["tiles"][args.tile]
    folder = DESIGN / args.tile
    source = folder / "source.png"
    work = content_path(ROOT, ".tmp/shared-world-discovery-v2") / args.tile
    prompt = "\n\n".join([brief["geometry"], brief["style"], tile["prompt"]])
    if args.dry_run:
        print(prompt if args.action == "generate" else f"{args.action}: {source} -> {tile['assetKey']}")
        return
    if args.action == "generate":
        if source.exists():
            raise SystemExit("Source already exists; preserve reviewed candidates before another generation.")
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
        refs = [tile["base"]] + ([tile["guide"]] if tile.get("guide") else [])
        record = {
            "model": brief["model"], "resolution": brief["resolution"],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "references": [{"path": p, "sha256": hashlib.sha256((content_path(ROOT, p)).read_bytes()).hexdigest()} for p in refs],
            "prompt": prompt, "assetKey": tile["assetKey"],
        }
        record_path = folder / "generation.json"
        record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        spec = importlib.util.spec_from_file_location("shared_hex_generator", content_path(ROOT, "scripts/generate-katchimera-hex-tile.py"))
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        url = generator.generate_queued_tile(
            output_name=tile["assetKey"].replace("_", "-"), prompt=prompt, base_path=content_path(ROOT, tile["base"]),
            creature_path=content_path(ROOT, tile["guide"]) if tile.get("guide") else None,
            quality="high", gpt_size=brief["resolution"], model="nano",
        )
        generator.download(url, source)
        record.update({"sourceUrl": url, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest()})
        record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(f"Review source before matting: {source}", flush=True)
    elif args.action == "matte":
        subprocess.run([
            sys.executable, "scripts/hex-tile-pipeline.py", "--source", str(source),
            "--key", tile["assetKey"], "--desc", tile["prompt"], "--skip-rerender",
            "--size", "2048", "--preserve-canvas", "--skip-package", "--skip-bounds",
            "--workdir", str(work),
        ], cwd=ROOT, check=True)
        shutil.copy2(work / "final.png", folder / "alpha.png")
        print(f"Review alpha before packaging: {folder / 'alpha.png'}", flush=True)
    else:
        subprocess.run([
            sys.executable, "scripts/package-transparent-hex-tile.py",
            "--source", str(folder / "alpha.png"), "--key", tile["assetKey"],
        ], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
