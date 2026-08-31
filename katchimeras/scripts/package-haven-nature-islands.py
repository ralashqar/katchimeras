#!/usr/bin/env python3
"""Package Haven nature-island sources and Mossprout Level 4 masters."""

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
MASTER_ROOT = ROOT / "design" / "mossprout-nature-islands-v1" / "max-level"
ORIGINAL_SIZE = (512, 512)
RUNTIME_SIZES = (1024, 512, 256)

from hex_tile_alpha import resize_rgba_premultiplied


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


MAX_LEVEL_KEYS = (
    "seed-nursery",
    "bloom-garden",
    "pond-sanctuary",
    "orchard-grove",
    "ancient-tree-grove",
    "wildgrowth-grove",
)


def alpha_bounds(image: Image.Image, *, threshold: int = 0) -> tuple[int, int, int, int] | None:
    alpha = image.convert("RGBA").getchannel("A")
    if threshold:
        alpha = alpha.point(lambda value: 255 if value > threshold else 0)
    return alpha.getbbox()


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


def normalized_square(master: Image.Image, size: int) -> Image.Image:
    rgba = master.convert("RGBA")
    # Image-generation extraction can leave isolated 1-8 alpha pixels at the
    # canvas edge. Discard those before measuring so every island receives the
    # same authored scale instead of shrinking around invisible noise.
    alpha = rgba.getchannel("A").point(lambda value: 0 if value <= 8 else value)
    rgba.putalpha(alpha)
    bounds = alpha_bounds(rgba, threshold=8)
    if bounds is None:
        raise SystemExit("Level 4 master contains no visible pixels")
    cropped = rgba.crop(bounds)
    max_art_size = round(size * 0.96)
    scale = min(max_art_size / cropped.width, max_art_size / cropped.height)
    target = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = resize_rgba_premultiplied(cropped, target)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bottom_padding = round(size * 0.02)
    square.alpha_composite(resized, (
        (size - target[0]) // 2,
        size - bottom_padding - target[1],
    ))
    return square


def max_level_runtime_path(key: str, size: int) -> Path:
    suffix = "" if size == 1024 else f"-{size}"
    return ASSET_ROOT / f"mossprout-{key}-l4{suffix}.webp"


def package_max_level(key: str, *, check: bool) -> int:
    master_path = MASTER_ROOT / f"{key}-l4-master.png"
    if not master_path.exists():
        raise SystemExit(f"Missing Level 4 master: {master_path.relative_to(ROOT)}")
    with Image.open(master_path) as opened:
        master = opened.convert("RGBA")
    if master.getchannel("A").getextrema() != (0, 255):
        raise SystemExit(f"{master_path.name}: expected genuine transparent and opaque pixels")

    total_decoded_bytes = 0
    for size in RUNTIME_SIZES:
        path = max_level_runtime_path(key, size)
        if check:
            if not path.exists():
                raise SystemExit(f"Missing Level 4 runtime asset: {path.relative_to(ROOT)}")
            if path.stat().st_mtime < master_path.stat().st_mtime:
                raise SystemExit(f"{path.name}: runtime asset is older than its master")
            with Image.open(path) as opened:
                runtime = opened.convert("RGBA")
        else:
            runtime = normalized_square(master, size)
            path.parent.mkdir(parents=True, exist_ok=True)
            runtime.save(
                path,
                "WEBP",
                quality=95 if size >= 512 else 90,
                alpha_quality=100,
                method=6,
                exact=True,
            )
        if runtime.size != (size, size):
            raise SystemExit(f"{path.name}: expected {size}x{size}, found {runtime.size}")
        if runtime.getchannel("A").getextrema() != (0, 255):
            raise SystemExit(f"{path.name}: expected genuine transparent and opaque pixels")
        if any(runtime.getchannel("A").getpixel(point) for point in (
            (0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1),
        )):
            raise SystemExit(f"{path.name}: corners must remain transparent")
        total_decoded_bytes += size * size * 4
        print(f"{path.relative_to(ROOT)}: {size}x{size}, {path.stat().st_size // 1024} KiB")
    return total_decoded_bytes


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
    max_level_decoded_bytes = sum(package_max_level(key, check=args.check) for key in MAX_LEVEL_KEYS)
    print(
        f"Mossprout Level 4 islands: {max_level_decoded_bytes / 1048576:.3f} MiB decoded "
        f"across {len(MAX_LEVEL_KEYS) * len(RUNTIME_SIZES)} LODs"
    )


if __name__ == "__main__":
    main()
