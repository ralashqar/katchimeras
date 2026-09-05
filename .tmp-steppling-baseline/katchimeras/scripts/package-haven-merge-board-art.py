#!/usr/bin/env python3
"""Register generated merge-island art and preserve verified candidate alpha."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "assets" / "images" / "katchimeras" / "world" / "square" / "mossprout-merge-island.webp"
OUTPUT_DIR = REFERENCE.parent
MASTER_OUTPUT = ROOT / "design/square-haven-v1/mossprout-merge-island-square-rail-master.png"


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    image.save(path, "WEBP", quality=quality, method=6, exact=True)
    print(f"Wrote {path.relative_to(ROOT)} ({image.width}x{image.height}, {path.stat().st_size} bytes)")


def seal_interior_alpha(image: Image.Image) -> Image.Image:
    """Keep only transparency connected to the canvas exterior.

    Chroma extraction can mistake tiny warm highlights or tile seams for the
    key color. A floating island is one solid silhouette, so interior pinholes
    are artifacts and should be opaque while the antialiased outer matte stays.
    """
    alpha = image.getchannel("A")
    connectivity = alpha.point(lambda value: 0 if value < 250 else 255)
    ImageDraw.floodfill(connectivity, (0, 0), 128, thresh=0)
    repaired = Image.new("L", image.size, 255)
    repaired.paste(alpha, mask=connectivity.point(lambda value: 255 if value == 128 else 0))
    result = image.copy()
    result.putalpha(repaired)
    return result


def decontaminate_partial_edge(image: Image.Image, radius: int = 5) -> Image.Image:
    """Replace keyed RGB on antialiased pixels with nearby opaque island RGB."""
    result = image.copy()
    pixels = result.load()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    width, height = result.size
    partial = [
        (x, y)
        for y in range(height)
        for x in range(width)
        if 0 < alpha_pixels[x, y] < 255
    ]
    for x, y in partial:
        best = None
        best_distance = radius * radius + 1
        for sample_y in range(max(0, y - radius), min(height, y + radius + 1)):
            for sample_x in range(max(0, x - radius), min(width, x + radius + 1)):
                if alpha_pixels[sample_x, sample_y] < 250:
                    continue
                distance = (sample_x - x) ** 2 + (sample_y - y) ** 2
                if distance < best_distance:
                    best = pixels[sample_x, sample_y][:3]
                    best_distance = distance
        if best is not None:
            pixels[x, y] = (*best, alpha_pixels[x, y])
    return result


def resize_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize RGBA without allowing transparent chroma RGB to bleed inward."""
    if image.size == size:
        return image.copy()
    red, green, blue, alpha = image.split()
    premultiplied = [ImageChops.multiply(channel, alpha) for channel in (red, green, blue)]
    resized_alpha = alpha.resize(size, Image.Resampling.LANCZOS)
    resized_premultiplied = [channel.resize(size, Image.Resampling.LANCZOS) for channel in premultiplied]
    alpha_values = list(resized_alpha.getdata())
    channels = []
    for channel in resized_premultiplied:
        values = list(channel.getdata())
        channels.append(Image.new("L", size))
        channels[-1].putdata([
            min(255, round(value * 255 / alpha_value)) if alpha_value else 0
            for value, alpha_value in zip(values, alpha_values)
        ])
    return Image.merge("RGBA", (*channels, resized_alpha))


def pad_to_square(image: Image.Image) -> Image.Image:
    """Preserve generated camera proportions when the master is portrait."""
    side = max(image.size)
    if image.size == (side, side):
        return image
    result = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    result.alpha_composite(image, ((side - image.width) // 2, (side - image.height) // 2))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--rgb-source", type=Path)
    args = parser.parse_args()
    with Image.open(REFERENCE) as opened:
        reference = opened.convert("RGBA")
    with Image.open(args.candidate) as opened:
        matte = seal_interior_alpha(opened.convert("RGBA"))
    if args.rgb_source:
        with Image.open(args.rgb_source) as opened:
            candidate = opened.convert("RGBA").resize(matte.size, Image.Resampling.LANCZOS)
        candidate.putalpha(matte.getchannel("A"))
    else:
        candidate = matte
    candidate = decontaminate_partial_edge(candidate)
    candidate = pad_to_square(candidate)
    MASTER_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    candidate.save(MASTER_OUTPUT, "PNG", optimize=True)
    print(f"Wrote {MASTER_OUTPUT.relative_to(ROOT)} ({candidate.width}x{candidate.height})")
    candidate = resize_premultiplied(candidate, reference.size)
    # Chroma-keyed production candidates carry their own silhouette. Keep it
    # instead of forcing the outline of an older island design over new art.
    registered = candidate
    save_webp(registered, OUTPUT_DIR / "mossprout-merge-island-perspective.webp", 90)
    save_webp(resize_premultiplied(registered, (512, 512)), OUTPUT_DIR / "mossprout-merge-island-perspective-512.webp", 88)
    save_webp(resize_premultiplied(registered, (256, 256)), OUTPUT_DIR / "mossprout-merge-island-perspective-256.webp", 86)


if __name__ == "__main__":
    main()
