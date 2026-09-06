#!/usr/bin/env python3
"""Generate WebP LOD variants for Katchimera creature cutouts.

React Native bundling needs static require() calls, so this script also writes
constants/creature-lod-sources.gen.ts with explicit entries.
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path, asset_specifier, resolve_asset_specifier


import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = game_root()
HOME_MVP = content_path(ROOT, "constants") / "home-mvp.ts"
LOD_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "cutouts_lod"
MANIFEST = content_path(ROOT, "constants") / "creature-lod-sources.gen.ts"


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
        if current_key is None or "source: require('@incubator/art-cutouts/" not in line:
            continue
        specifier = line.split("require('", 1)[1].split("')", 1)[0]
        rel = logical_path(ROOT, resolve_asset_specifier(ROOT, specifier))
        key = current_key
        rel_asset = Path(rel)
        path = content_path(ROOT, rel_asset)
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
    rel = logical_path(ROOT, path).as_posix()
    return asset_specifier(ROOT, path)


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
                "export const CREATURE_ORDER_SOURCES: Partial<Record<HomeVisualKey, ImageSourcePropType>> = {",
                block("order"),
                "};",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--medium", type=int, default=512, help="Maximum medium LOD dimension.")
    parser.add_argument("--order", type=int, default=384, help="Maximum order-card LOD dimension.")
    parser.add_argument("--thumb", type=int, default=256, help="Maximum thumb LOD dimension.")
    parser.add_argument("--quality", type=int, default=88, help="WebP quality for generated LOD files.")
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="CREATURE_KEY",
        help="Generate only this mapped creature without clearing the shared LOD directory or rewriting the manifest. Repeatable.",
    )
    parser.add_argument("--report-only", action="store_true", help="Only print mapped assets; do not write files.")
    parser.add_argument(
        "--order-only",
        action="store_true",
        help="Generate the order-card tier and rewrite the manifest without touching existing medium/thumb files.",
    )
    args = parser.parse_args()

    mapped_assets = mapped_creature_assets()
    requested = set(args.only)
    known_keys = {asset.key for asset in mapped_assets}
    unknown = sorted(requested - known_keys)
    if unknown:
        parser.error(f"Unknown creature key(s): {', '.join(unknown)}")
    assets = [asset for asset in mapped_assets if not requested or asset.key in requested]
    print(f"Mapped creature assets: {len(assets)}")
    for asset in assets:
        print(f"{asset.bytes / 1024:8.1f} KB  {asset.width:4}x{asset.height:<4}  {asset.key:<16} {asset.rel_asset.as_posix()}")

    if args.report_only:
        return

    if args.order_only:
        entries: dict[str, dict[str, Path]] = {"medium": {}, "order": {}, "thumb": {}}
        for asset in mapped_assets:
            medium = LOD_ROOT / f"{asset.key}_{args.medium}.webp"
            thumb = LOD_ROOT / f"{asset.key}_{args.thumb}.webp"
            order = LOD_ROOT / f"{asset.key}_{args.order}.webp"
            if not medium.exists() or not thumb.exists():
                raise FileNotFoundError(f"Generate existing LODs first for {asset.key}: {medium.name}, {thumb.name}")
            entries["medium"][asset.key] = medium
            entries["thumb"][asset.key] = thumb
            entries["order"][asset.key] = order if order.exists() and order.stat().st_mtime >= asset.path.stat().st_mtime else generate_lod(asset, "order", args.order, args.quality)
        write_manifest(entries)
        print(f"Wrote {logical_path(ROOT, MANIFEST)} with {len(entries['order'])} order-card LODs")
        return

    if requested:
        for asset in assets:
            generate_lod(asset, "medium", args.medium, args.quality)
            generate_lod(asset, "order", args.order, args.quality)
            generate_lod(asset, "thumb", args.thumb, args.quality)
        print(f"Wrote targeted LODs: {', '.join(sorted(requested))}")
        return

    if LOD_ROOT.exists():
        for stale in LOD_ROOT.glob("*.webp"):
            stale.unlink()

    entries: dict[str, dict[str, Path]] = {"medium": {}, "order": {}, "thumb": {}}
    for asset in assets:
        entries["medium"][asset.key] = generate_lod(asset, "medium", args.medium, args.quality)
        entries["order"][asset.key] = generate_lod(asset, "order", args.order, args.quality)
        entries["thumb"][asset.key] = generate_lod(asset, "thumb", args.thumb, args.quality)
    write_manifest(entries)
    print(f"Wrote {logical_path(ROOT, MANIFEST)}")


if __name__ == "__main__":
    main()
