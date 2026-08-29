#!/usr/bin/env python3
"""Crop transparent padding from the two Haven nature-island runtime assets."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "square"
ORIGINAL_SIZE = (512, 512)


@dataclass(frozen=True)
class NatureIslandSpec:
    crop: tuple[int, int, int, int]
    filename: str

    @property
    def packaged_size(self) -> tuple[int, int]:
        left, top, right, bottom = self.crop
        return right - left, bottom - top


SPECS = (
    NatureIslandSpec(filename="nature-island-512.webp", crop=(79, 32, 433, 480)),
    NatureIslandSpec(filename="nature-island-east-512.webp", crop=(66, 32, 445, 480)),
)


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.convert("RGBA").getchannel("A").getbbox()


def package(spec: NatureIslandSpec, *, check: bool) -> tuple[int, int, int]:
    path = ASSET_ROOT / spec.filename
    if not path.exists():
        raise SystemExit(f"Missing Haven nature island: {path.relative_to(ROOT)}")
    with Image.open(path) as opened:
        image = opened.convert("RGBA")

    if image.size == ORIGINAL_SIZE:
        bounds = alpha_bounds(image)
        if bounds != spec.crop:
            raise SystemExit(
                f"{spec.filename}: expected alpha bounds {spec.crop}, found {bounds}. "
                "Review the crop contract before packaging new artwork."
            )
        if check:
            raise SystemExit(f"{spec.filename}: still has its 512x512 transparent source padding")
        image = image.crop(spec.crop)
        temporary = path.with_suffix(".tmp.webp")
        image.save(temporary, "WEBP", quality=94, method=6, exact=True)
        temporary.replace(path)
    elif image.size != spec.packaged_size:
        raise SystemExit(
            f"{spec.filename}: expected source {ORIGINAL_SIZE} or packaged {spec.packaged_size}, "
            f"found {image.size}"
        )

    with Image.open(path) as packaged:
        packaged_rgba = packaged.convert("RGBA")
        if packaged_rgba.size != spec.packaged_size:
            raise SystemExit(
                f"{spec.filename}: expected packaged size {spec.packaged_size}, found {packaged_rgba.size}"
            )
        expected_bounds = (0, 0, packaged_rgba.width, packaged_rgba.height)
        if alpha_bounds(packaged_rgba) != expected_bounds:
            raise SystemExit(f"{spec.filename}: packaged alpha does not touch every canvas edge")
        decoded_bytes = packaged_rgba.width * packaged_rgba.height * 4
    return spec.packaged_size[0], spec.packaged_size[1], decoded_bytes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without modifying assets")
    args = parser.parse_args()

    total_decoded_bytes = 0
    for spec in SPECS:
        width, height, decoded_bytes = package(spec, check=args.check)
        total_decoded_bytes += decoded_bytes
        print(f"{spec.filename}: {width}x{height}, {decoded_bytes / 1048576:.3f} MiB decoded")
    original_decoded_bytes = len(SPECS) * ORIGINAL_SIZE[0] * ORIGINAL_SIZE[1] * 4
    saved = original_decoded_bytes - total_decoded_bytes
    print(
        f"Nature islands: {total_decoded_bytes / 1048576:.3f} MiB decoded, "
        f"saving {saved / 1048576:.3f} MiB"
    )


if __name__ == "__main__":
    main()
