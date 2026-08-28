#!/usr/bin/env python3
"""Package the approved Haven junction island cutout into runtime LODs."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "haven-mini-island" / "junction-stone-pedestal-v10-alpha.png"
OUTPUTS = {
    512: ROOT / "assets" / "images" / "katchimeras" / "world" / "square" / "haven-junction-mini-island-512.webp",
    256: ROOT / "assets" / "images" / "katchimeras" / "world" / "square" / "haven-junction-mini-island-256.webp",
}
PADDING_RATIO = 0.055


def fitted_canvas(source: Image.Image, size: int) -> Image.Image:
    bounds = source.getbbox()
    if bounds is None:
        raise ValueError(f"Junction island source is empty: {SOURCE}")
    subject = source.crop(bounds)
    pad_x = round(subject.width * PADDING_RATIO)
    pad_y = round(subject.height * PADDING_RATIO)
    padded = Image.new("RGBA", (subject.width + pad_x * 2, subject.height + pad_y * 2), (0, 0, 0, 0))
    padded.alpha_composite(subject, (pad_x, pad_y))
    padded.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(padded, ((size - padded.width) // 2, (size - padded.height) // 2))
    return canvas


def main() -> None:
    with Image.open(SOURCE) as opened:
        source = opened.convert("RGBA")
    for size, output in OUTPUTS.items():
        output.parent.mkdir(parents=True, exist_ok=True)
        fitted_canvas(source, size).save(
            output,
            "WEBP",
            quality=88,
            alpha_quality=100,
            method=6,
        )
        print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
