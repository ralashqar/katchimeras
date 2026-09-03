#!/usr/bin/env python3
"""Package authored Mossprout memory-garden art into deterministic runtime assets."""

from __future__ import annotations

from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "design" / "mossprout-memory-garden-v1"
GENERATED_GARDEN_DIR = ROOT / "design" / "mossprout-hex-neighborhood-v1"
HEX_DIR = ROOT / "assets" / "images" / "katchimeras" / "world" / "hex"
PLANT_DIR = ROOT / "assets" / "images" / "katchimeras" / "world" / "memory-plants"
FAMILIES = ("momentum", "stillness", "renewal", "warmth", "curiosity")
STAGES = ("seed", "sprout", "bloom")


def resize_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    premultiplied = [ImageChops.multiply(channel, alpha) for channel in image.convert("RGB").split()]
    resized_alpha = alpha.resize(size, Image.Resampling.LANCZOS)
    alpha_array = np.asarray(resized_alpha, dtype=np.float32)
    channels = []
    for channel in premultiplied:
        values = np.asarray(channel.resize(size, Image.Resampling.LANCZOS), dtype=np.float32)
        restored = np.divide(values * 255, alpha_array, out=np.zeros_like(values), where=alpha_array > 0)
        channels.append(Image.fromarray(np.clip(np.rint(restored), 0, 255).astype(np.uint8), "L"))
    return Image.merge("RGBA", (*channels, resized_alpha))


def remove_connected_checkerboard(source: Image.Image) -> Image.Image:
    """Remove generated preview checkerboard without erasing pale island details."""
    rgba = np.asarray(source.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    neutral_light = (maximum - minimum < 12) & (minimum > 205)
    # Generated previews may contain colourful single-pixel noise throughout
    # the checkerboard. The island is the one large component containing the
    # image centre, so retain that component instead of trusting colour alone.
    mask = Image.fromarray(np.where(neutral_light, 0, 255).astype(np.uint8), "L")
    probe = mask.copy()
    centre = (mask.width // 2, mask.height // 2)
    ImageDraw.floodfill(probe, centre, 128, thresh=0)
    foreground = np.asarray(probe) == 128
    alpha = rgba[:, :, 3]
    alpha[~foreground] = 0
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, "RGBA")


def package_garden(level: int) -> None:
    generated_stem = "memory-garden-unrestored" if level == 0 else "memory-garden-restored"
    generated_alpha = GENERATED_GARDEN_DIR / f"{generated_stem}-alpha.png"
    if not generated_alpha.exists():
        raise RuntimeError(
            f"Missing Nano Banana garden master: {generated_alpha.relative_to(ROOT)}. "
            "Generate and promote it through scripts/generate-mossprout-hex-neighborhood.py first."
        )
    with Image.open(generated_alpha) as opened:
        garden = opened.convert("RGBA")
    garden = resize_premultiplied(garden, (1024, 1024))
    for side, suffix in ((1024, ""), (512, "_512"), (256, "_256")):
        output = HEX_DIR / f"mossprout_memory_garden_level_{level}{suffix}.webp"
        rendered = garden if side == 1024 else resize_premultiplied(garden, (side, side))
        rendered.save(output, "WEBP", quality=92 if side == 1024 else 88, method=6, exact=True)
        print(f"Wrote {output.relative_to(ROOT)}")


def isolated_stage(sheet: Image.Image, index: int) -> Image.Image:
    third = sheet.width // 3
    left = index * third
    right = sheet.width if index == 2 else (index + 1) * third
    cell = sheet.crop((left, 0, right, sheet.height)).convert("RGBA")
    bbox = cell.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError(f"Stage {index} has no visible pixels")
    sprite = cell.crop(bbox)
    side = max(sprite.width, sprite.height)
    padded = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    padded.alpha_composite(sprite, ((side - sprite.width) // 2, side - sprite.height))
    return padded


def package_family(family: str) -> None:
    with Image.open(SOURCE_DIR / f"{family}-source.png") as opened:
        sheet = opened.convert("RGBA")
    for index, stage in enumerate(STAGES):
        sprite = isolated_stage(sheet, index)
        for side, suffix in ((384, ""), (192, "_192"), (96, "_96")):
            output = PLANT_DIR / f"{family}_{stage}{suffix}.webp"
            resize_premultiplied(sprite, (side, side)).save(output, "WEBP", quality=92, method=6, exact=True)
            print(f"Wrote {output.relative_to(ROOT)}")


def main() -> None:
    HEX_DIR.mkdir(parents=True, exist_ok=True)
    PLANT_DIR.mkdir(parents=True, exist_ok=True)
    for level in (0, 1, 2):
        package_garden(level)
    if "--gardens-only" in sys.argv:
        return
    for family in FAMILIES:
        package_family(family)


if __name__ == "__main__":
    main()
