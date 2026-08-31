#!/usr/bin/env python3
"""Package the Mossprout Garden world island and navigation-sign assets."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "design" / "mossprout-garden-entry-v1"
RUNTIME_DIR = ROOT / "assets" / "images" / "katchimeras" / "world" / "square"

ASSETS = {
    "mossprout-garden-hub-v2": "mossprout-garden-hub-v2-chroma.png",
    "mossprout-garden-button-v1": "mossprout-garden-button-v1-chroma.png",
}


def border_key(rgb: np.ndarray) -> np.ndarray:
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    return np.median(border, axis=0).astype(np.float32)


def remove_connected_chroma(source: Image.Image) -> Image.Image:
    rgba = np.asarray(source.convert("RGBA")).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    key = border_key(rgb)
    distance = np.linalg.norm(rgb - key[None, None, :], axis=2)
    candidates = Image.fromarray(np.where(distance <= 105, 0, 255).astype(np.uint8), mode="L").copy()
    ImageDraw.floodfill(candidates, (0, 0), 128, thresh=0)
    connected = np.asarray(candidates) == 128
    ramp = np.clip((distance - 18) / (105 - 18), 0, 1)
    alpha = rgba[:, :, 3].astype(np.float32)
    alpha[connected] = np.minimum(alpha[connected], ramp[connected] * 255)
    partial = connected & (alpha > 0) & (alpha < 255)
    if np.any(partial):
        fraction = np.maximum(alpha[partial, None] / 255, 0.05)
        foreground = (rgb[partial] - key[None, :] * (1 - fraction)) / fraction
        rgba[:, :, :3][partial] = np.rint(np.clip(foreground, 0, 255)).astype(np.uint8)
    rgba[:, :, 3] = np.rint(alpha).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")


def decontaminate_blue_edge(image: Image.Image, radius: int = 7) -> Image.Image:
    result = image.copy()
    pixels = result.load()
    alpha = result.getchannel("A")
    alpha_pixels = alpha.load()
    width, height = result.size
    targets = []
    for y in range(height):
        for x in range(width):
            red, green, blue, current_alpha = pixels[x, y]
            if current_alpha and (current_alpha < 255 or (blue > red + 24 and blue > green + 24)):
                targets.append((x, y))
    for x, y in targets:
        best = None
        best_distance = radius * radius + 1
        for sample_y in range(max(0, y - radius), min(height, y + radius + 1)):
            for sample_x in range(max(0, x - radius), min(width, x + radius + 1)):
                if alpha_pixels[sample_x, sample_y] < 250:
                    continue
                red, green, blue, _ = pixels[sample_x, sample_y]
                if blue > red + 24 and blue > green + 24:
                    continue
                distance = (sample_x - x) ** 2 + (sample_y - y) ** 2
                if distance < best_distance:
                    best = (red, green, blue)
                    best_distance = distance
        if best is not None:
            pixels[x, y] = (*best, alpha_pixels[x, y])
    return result


def resize_premultiplied(image: Image.Image, side: int) -> Image.Image:
    alpha = image.getchannel("A")
    premultiplied = [ImageChops.multiply(channel, alpha) for channel in image.convert("RGB").split()]
    resized_alpha = alpha.resize((side, side), Image.Resampling.LANCZOS)
    alpha_values = list(resized_alpha.getdata())
    channels = []
    for channel in premultiplied:
        values = list(channel.resize((side, side), Image.Resampling.LANCZOS).getdata())
        output = Image.new("L", (side, side))
        output.putdata([
            min(255, round(value * 255 / alpha_value)) if alpha_value else 0
            for value, alpha_value in zip(values, alpha_values)
        ])
        channels.append(output)
    return Image.merge("RGBA", (*channels, resized_alpha))


def package_asset(stem: str, source_name: str) -> None:
    with Image.open(SOURCE_DIR / source_name) as opened:
        master = remove_connected_chroma(opened)
    master = decontaminate_blue_edge(master)
    master = resize_premultiplied(master, 1024)
    master_path = SOURCE_DIR / f"{stem}-master.png"
    master.save(master_path, "PNG", optimize=True)
    for side, suffix in ((1024, ""), (512, "-512"), (256, "-256")):
        output = RUNTIME_DIR / f"{stem}{suffix}.webp"
        resized = master if side == 1024 else resize_premultiplied(master, side)
        resized.save(output, "WEBP", quality=92 if side == 1024 else 88, method=6, exact=True)
        print(f"Wrote {output.relative_to(ROOT)} ({side}x{side})")


def main() -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    for stem, source_name in ASSETS.items():
        package_asset(stem, source_name)


if __name__ == "__main__":
    main()
