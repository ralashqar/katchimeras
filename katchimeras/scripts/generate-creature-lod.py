#!/usr/bin/env python3
"""Generate WebP LOD variants for Katchimera creature cutouts.

React Native bundling needs static require() calls, so this script also writes
constants/creature-lod-sources.gen.ts with explicit entries.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HOME_MVP = ROOT / "constants" / "home-mvp.ts"
LOD_ROOT = ROOT / "assets" / "images" / "katchimeras" / "cutouts_lod"
MANIFEST = ROOT / "constants" / "creature-lod-sources.gen.ts"


@dataclass(frozen=True)
class CreatureAsset:
    key: str
    rel_asset: Path
    path: Path
    width: int
    height: int
    bytes: int


def mapped_creature_assets() -> list[CreatureAsset]:
    assets: list[CreatureAsset] = []
    seen: set[str] = set()
    current_key: str | None = None
    in_visuals = False
    for raw_line in HOME_MVP.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("export const homeCreatureVisuals:"):
            in_visuals = True
            continue
        if in_visuals and line.startswith("export const homeVisualPools:"):
            break
        if not in_visuals:
            continue
        if line.endswith("{") and ":" in line and not line.startswith(("source:", "accentColor:")):
            current_key = line.split(":", 1)[0].strip()
            continue
        if current_key is None or "source: require('../assets/images/katchimeras/cutouts/" not in line:
            continue
        rel = line.split("require('../", 1)[1].split("')", 1)[0]
        key = current_key
        rel_asset = Path(rel)
        path = ROOT / rel_asset
        if key in seen or not path.exists():
            current_key = None
            continue
        seen.add(key)
        with Image.open(path) as image:
            width, height = image.size
        assets.append(
            CreatureAsset(
                key=key,
                rel_asset=rel_asset,
                path=path,
                width=width,
                height=height,
                bytes=path.stat().st_size,
            )
        )
        current_key = None
    return sorted(assets, key=lambda item: item.key)


def generate_lod(asset: CreatureAsset, lod: str, max_dim: int, quality: int) -> Path:
    target = LOD_ROOT / f"{asset.key}_{max_dim}.webp"
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
                "import type { HomeVisualKey } from '@/types/home';",
                "",
                "export type CreatureLod = 'full' | 'medium' | 'thumb';",
                "",
                "export const CREATURE_LOD_SOURCES: Record<Exclude<CreatureLod, 'full'>, Partial<Record<HomeVisualKey, ImageSourcePropType>>> = {",
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
    parser.add_argument("--medium", type=int, default=512, help="Maximum medium LOD dimension.")
    parser.add_argument("--thumb", type=int, default=256, help="Maximum thumb LOD dimension.")
    parser.add_argument("--quality", type=int, default=88, help="WebP quality for generated LOD files.")
    parser.add_argument("--report-only", action="store_true", help="Only print mapped assets; do not write files.")
    args = parser.parse_args()

    assets = mapped_creature_assets()
    print(f"Mapped creature assets: {len(assets)}")
    for asset in assets:
        print(f"{asset.bytes / 1024:8.1f} KB  {asset.width:4}x{asset.height:<4}  {asset.key:<16} {asset.rel_asset.as_posix()}")

    if args.report_only:
        return

    if LOD_ROOT.exists():
        for stale in LOD_ROOT.glob("*.webp"):
            stale.unlink()

    entries: dict[str, dict[str, Path]] = {"medium": {}, "thumb": {}}
    for asset in assets:
        entries["medium"][asset.key] = generate_lod(asset, "medium", args.medium, args.quality)
        entries["thumb"][asset.key] = generate_lod(asset, "thumb", args.thumb, args.quality)
    write_manifest(entries)
    print(f"Wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
