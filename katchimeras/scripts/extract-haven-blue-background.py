#!/usr/bin/env python3
"""Extract a supplied Haven island from its connected blue studio backdrop."""

from argparse import ArgumentParser
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--key", choices=("blue", "magenta"), default="blue")
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def connected_chroma_background(image: Image.Image, key: str) -> Image.Image:
    rgb = image.convert("RGB")
    hsv = rgb.convert("HSV")
    width, height = rgb.size
    pixels = list(rgb.getdata())
    hsv_pixels = list(hsv.getdata())
    candidate = bytearray(width * height)

    # The supplied studio plate ranges from sky blue to a darker cyan contact
    # shadow. Island greens, warm rails, cream stone, and white flowers all sit
    # outside this hue/dominance gate.
    for index, ((red, green, blue), (hue, saturation, _value)) in enumerate(
        zip(pixels, hsv_pixels)
    ):
        blue_key = (
            118 <= hue <= 176
            and saturation >= 14
            and blue >= green + 2
            and blue >= red + 10
        )
        magenta_key = (
            195 <= hue <= 248
            and saturation >= 20
            and red >= green + 20
            and blue >= green + 20
        )
        if (key == "blue" and blue_key) or (key == "magenta" and magenta_key):
            candidate[index] = 1

    connected = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(index: int) -> None:
        if candidate[index] and not connected[index]:
            connected[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x)
        seed((height - 1) * width + x)
    for y in range(height):
        seed(y * width)
        seed(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        if x > 0:
            seed(index - 1)
        if x + 1 < width:
            seed(index + 1)
        if index >= width:
            seed(index - width)
        if index + width < width * height:
            seed(index + width)

    background = Image.frombytes(
        "L",
        (width, height),
        bytes(255 if value else 0 for value in connected),
    )
    # Contract one pixel into the source edge to remove JPEG/chroma fringe,
    # then restore a soft antialiased silhouette without changing RGB values.
    background = background.filter(ImageFilter.MaxFilter(3)).filter(
        ImageFilter.GaussianBlur(0.65)
    )
    return ImageOps.invert(background)


def main() -> None:
    args = parse_args()
    with Image.open(args.input) as opened:
        image = opened.convert("RGBA")
    alpha = connected_chroma_background(image, args.key)
    image.putalpha(alpha)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.out, "PNG", optimize=True)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
