#!/usr/bin/env python3
"""Regenerate constants/world-asset-sources.gen.ts from the promoted assets.

Scans  assets/images/katchimeras/world/objects/promoted/<assetKey>/<assetKey>_NN.webp
(the output of scripts/promote-dev-assets.py) and emits a require() map keyed
`<assetKey>_v<N>` — the variant siblings the world-objects registry can list in
a definition's `art.variants`. Idempotent; run any time (the promote script
runs it automatically).
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path, asset_specifier, resolve_asset_specifier


import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

REPO_ROOT = game_root()
PROMOTED_ROOT = content_path(REPO_ROOT, "assets") / "images" / "katchimeras" / "world" / "objects" / "promoted"
OUT_PATH = content_path(REPO_ROOT, "constants") / "world-asset-sources.gen.ts"

HEADER = """// GENERATED FILE — do not edit by hand.
// Emitted by scripts/sync-promoted-sources.py from
// assets/images/katchimeras/world/objects/promoted/** (the Asset Lab
// promotion pipeline). Keys are `<assetKey>_v<N>` variant siblings;
// utils/world-visuals.ts consults this map after the hand-authored sources.
import type { ImageSourcePropType } from 'react-native';

export const PROMOTED_WORLD_SOURCES: Record<string, ImageSourcePropType> = {
"""


def main() -> None:
    lines: list[str] = []
    if PROMOTED_ROOT.exists():
        for folder in sorted(PROMOTED_ROOT.iterdir()):
            if not folder.is_dir():
                continue
            asset_key = folder.name
            for file in sorted(folder.glob(f"{asset_key}_*.webp")):
                match = re.search(rf"{re.escape(asset_key)}_(\d+)\.webp$", file.name)
                if not match:
                    continue
                index = int(match.group(1))
                rel = logical_path(REPO_ROOT, file).as_posix()
                lines.append(f"  {asset_key}_v{index}: require('{asset_specifier(ROOT, rel)}'),")

    body = HEADER + ("\n".join(lines) + "\n" if lines else "") + "};\n"
    OUT_PATH.write_text(body, encoding="utf-8", newline="\n")
    print(f"world-asset-sources.gen.ts: {len(lines)} promoted variant(s).")


if __name__ == "__main__":
    main()
