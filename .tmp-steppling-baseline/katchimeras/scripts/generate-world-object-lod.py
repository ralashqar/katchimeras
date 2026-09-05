#!/usr/bin/env python3
"""Generate medium/thumb LOD variants for mapped world object assets.

The app can only require statically-known assets, so this script also rewrites
constants/world-asset-lod-sources.gen.ts with explicit require() entries.
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORLD_VISUALS = ROOT / "utils" / "world-visuals.ts"
OBJECT_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "objects"
LOD_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "objects_lod"
MANIFEST = ROOT / "constants" / "world-asset-lod-sources.gen.ts"
REQUIRE_RE = re.compile(
    r"^\s*([A-Za-z0-9_]+):\s*require\('\.\./(assets/images/katchimeras/world/objects/[^']+)'\)"
)


@dataclass(frozen=True)
class ObjectAsset:
    key: str
    rel_asset: Path
    path: Path
    width: int
    height: int
    bytes: int


def mapped_object_assets() -> list[ObjectAsset]:
    assets: dict[str, ObjectAsset] = {}
    for line in WORLD_VISUALS.read_text(encoding="utf-8").splitlines():
        match = REQUIRE_RE.match(line)
        if not match:
            continue
        key = match.group(1)
        rel_asset = Path(match.group(2))
        path = ROOT / rel_asset
        if not path.exists() or path.name.startswith("_"):
            continue
        with Image.open(path) as image:
            width, height = image.size
        assets[key] = ObjectAsset(
            key=key,
            rel_asset=rel_asset,
            path=path,
            width=width,
            height=height,
            bytes=path.stat().st_size,
        )
    return sorted(assets.values(), key=lambda item: item.bytes, reverse=True)


def lod_path(asset: ObjectAsset, lod: str) -> Path:
    rel_under_objects = asset.rel_asset.relative_to("assets/images/katchimeras/world/objects")
    return LOD_ROOT / rel_under_objects.parent / f"{asset.path.stem}__{lod}.webp"


def generate_lod(asset: ObjectAsset, lod: str, max_dim: int, quality: int) -> Path:
    target = lod_path(asset, lod)
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(asset.path) as image:
      converted = image.convert("RGBA")
      converted.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
      converted.save(target, "WEBP", quality=quality, alpha_quality=100, method=6)
    return target


def require_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    return f"../{rel}"


def write_manifest(entries: dict[str, dict[str, Path]]) -> None:
    def block(lod: str) -> str:
        lines = []
        for key, path in sorted(entries[lod].items()):
            lines.append(f"    {key}: require('{require_path(path)}'),")
        return "\n".join(lines)

    MANIFEST.write_text(
        "\n".join(
            [
                "import type { ImageSourcePropType } from 'react-native';",
                "",
                "export type WorldObjectLod = 'full' | 'medium' | 'thumb';",
                "",
                "export const WORLD_OBJECT_LOD_SOURCES: Record<Exclude<WorldObjectLod, 'full'>, Record<string, ImageSourcePropType>> = {",
                "  medium: {",
                block("medium"),
                "  },",
                "  thumb: {",
                block("thumb"),
                "  },",
                "};",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold-kb", type=float, default=150, help="Generate LODs for mapped assets at or above this compressed size.")
    parser.add_argument("--min-source-dim", type=int, default=512, help="Also generate LODs when a mapped asset exceeds this dimension.")
    parser.add_argument("--medium", type=int, default=512, help="Maximum medium LOD dimension.")
    parser.add_argument("--thumb", type=int, default=256, help="Maximum thumb LOD dimension.")
    parser.add_argument("--quality", type=int, default=88, help="WebP quality for generated LOD files.")
    parser.add_argument("--report-only", action="store_true", help="Only print candidates; do not write files.")
    args = parser.parse_args()

    assets = mapped_object_assets()
    candidates = [
        asset
        for asset in assets
        if asset.bytes >= args.threshold_kb * 1024 or max(asset.width, asset.height) > args.min_source_dim
    ]
    print(f"Mapped object assets: {len(assets)}")
    print(f"LOD candidates >= {args.threshold_kb:.0f} KB or > {args.min_source_dim}px: {len(candidates)}")
    for asset in candidates:
        print(f"{asset.bytes / 1024:8.1f} KB  {asset.width:4}x{asset.height:<4}  {asset.key:<32} {asset.rel_asset.as_posix()}")

    if args.report_only:
        return

    entries: dict[str, dict[str, Path]] = {"medium": {}, "thumb": {}}
    for asset in candidates:
        entries["medium"][asset.key] = generate_lod(asset, "medium", args.medium, args.quality)
        entries["thumb"][asset.key] = generate_lod(asset, "thumb", args.thumb, args.quality)
    write_manifest(entries)
    print(f"Wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
