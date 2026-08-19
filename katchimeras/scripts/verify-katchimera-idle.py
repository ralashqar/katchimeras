#!/usr/bin/env python3
"""Verify promoted animated Katchimera idle assets."""

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/katchimeras/idle-animations.json"
DEFAULT_BUDGET_BYTES = 3 * 1024 * 1024


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for visual_key, spec in data["animations"].items():
        asset = ROOT / spec["asset"]
        if not asset.exists():
            raise SystemExit(f"Missing {visual_key} idle asset: {asset}")
        with Image.open(asset) as animation:
            if animation.format != "WEBP" or not getattr(animation, "is_animated", False):
                raise SystemExit(f"{visual_key} idle asset is not an animated WebP.")
            if animation.size != (spec["width"], spec["height"]):
                raise SystemExit(f"{visual_key} idle dimensions do not match the manifest.")
            if animation.n_frames != spec["frameCount"]:
                raise SystemExit(f"{visual_key} idle frame count does not match the manifest.")
            animation.seek(min(1, animation.n_frames - 1))
            if animation.convert("RGBA").getchannel("A").getextrema()[0] != 0:
                raise SystemExit(f"{visual_key} idle asset has no transparent pixels.")
        if asset.stat().st_size != spec["byteSize"]:
            raise SystemExit(f"{visual_key} idle byte size does not match the manifest.")
        max_byte_size = spec.get("maxByteSize", DEFAULT_BUDGET_BYTES)
        if not isinstance(max_byte_size, int) or max_byte_size <= 0:
            raise SystemExit(f"{visual_key} idle asset has an invalid byte budget.")
        if asset.stat().st_size > max_byte_size:
            raise SystemExit(
                f"{visual_key} idle asset exceeds its {max_byte_size / 1024 / 1024:.2f} MiB budget."
            )
        print(f"Verified {visual_key}: {spec['frameCount']} frames, {asset.stat().st_size / 1024:.0f} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
