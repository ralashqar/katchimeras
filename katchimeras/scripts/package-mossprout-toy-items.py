"""Slice approved toy-diorama source sheets into stable merge item WebPs.

The generated sheets use a fixed equal-cell layout. Chroma removal happens
before this script so every output keeps soft antialiased alpha while runtime
continues to load one small image per merge sprite.
"""

from __future__ import annotations

import io
import os
from pathlib import Path
import time

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "mossprout-toy-items"
MERGE_ROOT = ROOT / "assets" / "images" / "katchimeras" / "merge-world"
OUTPUT = MERGE_ROOT / "items"
EDGE = 256
CONTENT_EDGE = 232

SHEETS = (
    (
        "garden-alpha.png",
        4,
        2,
        (
            "nature-garden-1-seed.webp",
            "nature-garden-2-sprout.webp",
            "nature-garden-3-plant.webp",
            "nature-garden-4-flower.webp",
            "nature-garden-5-rare-flower.webp",
            "nature-garden-6-magical-plant.webp",
            "nature-garden-7-ancient-tree.webp",
        ),
    ),
    (
        "waterside-alpha.png",
        3,
        2,
        (
            "nature-waterside-1-pebble.webp",
            "nature-waterside-2-shell.webp",
            "nature-waterside-3-tidepool.webp",
            "nature-waterside-4-water-lily.webp",
            "nature-waterside-5-moonlit-cove.webp",
            "nature-waterside-6-ocean-sanctuary.webp",
        ),
    ),
    (
        "keepsake-alpha.png",
        3,
        2,
        (
            "nature-keepsake-1-dew-bead.webp",
            "nature-keepsake-2-pressed-leaf.webp",
            "nature-keepsake-3-memory-sprig.webp",
            "nature-keepsake-4-field-journal.webp",
            "nature-keepsake-5-memory-terrarium.webp",
            "nature-keepsake-6-living-archive.webp",
        ),
    ),
)

# Boundaries sit in the transparent valleys between generated subjects. They
# deliberately differ per row because image generation spaces a three-object
# row differently from a four-object row.
ROW_X_BOUNDARIES = {
    "garden-alpha.png": ((0.0, 0.267, 0.484, 0.716, 1.0), (0.0, 0.320, 0.601, 1.0)),
    "waterside-alpha.png": ((0.0, 0.324, 0.620, 1.0), (0.0, 0.324, 0.616, 1.0)),
    "keepsake-alpha.png": ((0.0, 0.355, 0.656, 1.0), (0.0, 0.340, 0.621, 1.0)),
}

GENERATOR_OUTPUTS = (
    "generators/wild-garden.webp",
    "items/wild-garden-stage-2.webp",
    "items/wild-garden-stage-3.webp",
    "generators/mossprout-sprouting-pot.webp",
    "items/memory-nursery-stage-1.webp",
    "items/memory-nursery-stage-2.webp",
    "items/memory-nursery-stage-3.webp",
)


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Sprite cell contains no visible pixels")
    return bounds


def package_cell(cell: Image.Image, destination: Path) -> None:
    crop = cell.crop(alpha_bounds(cell))
    scale = min(CONTENT_EDGE / crop.width, CONTENT_EDGE / crop.height)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (EDGE, EDGE), (0, 0, 0, 0))
    x = (EDGE - resized.width) // 2
    # Keep a little more breathing room above than below for the board shadow.
    y = max(4, (EDGE - resized.height) // 2 - 2)
    canvas.alpha_composite(resized, (x, y))
    encoded = io.BytesIO()
    canvas.save(encoded, "WEBP", lossless=False, quality=90, method=6)
    temporary = destination.with_name(f".{destination.name}.tmp")
    temporary.write_bytes(encoded.getvalue())
    for attempt in range(8):
        try:
            os.replace(temporary, destination)
            break
        except OSError:
            if attempt == 7:
                raise
            time.sleep(0.12 * (attempt + 1))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, columns, rows, outputs in SHEETS:
        with Image.open(SOURCE / filename).convert("RGBA") as sheet:
            boundaries = ROW_X_BOUNDARIES[filename]
            row_counts = tuple(len(row_boundaries) - 1 for row_boundaries in boundaries)
            for index, output in enumerate(outputs):
                row = 0 if index < row_counts[0] else 1
                column = index if row == 0 else index - row_counts[0]
                left = round(boundaries[row][column] * sheet.width)
                right = round(boundaries[row][column + 1] * sheet.width)
                top = round(row * sheet.height / rows)
                bottom = round((row + 1) * sheet.height / rows)
                package_cell(sheet.crop((left, top, right, bottom)), OUTPUT / output)
                print(output)

    with Image.open(SOURCE / "generators-alpha.png").convert("RGBA") as sheet:
        generator_boundaries = ((0.0, 0.259, 0.504, 0.761, 1.0), (0.0, 0.347, 0.602, 1.0))
        for index, relative_output in enumerate(GENERATOR_OUTPUTS):
            row = 0 if index < 4 else 1
            column = index if row == 0 else index - 4
            left = round(generator_boundaries[row][column] * sheet.width)
            right = round(generator_boundaries[row][column + 1] * sheet.width)
            top = round(row * sheet.height / 2)
            bottom = round((row + 1) * sheet.height / 2)
            destination = MERGE_ROOT / relative_output
            destination.parent.mkdir(parents=True, exist_ok=True)
            package_cell(sheet.crop((left, top, right, bottom)), destination)
            print(relative_output)


if __name__ == "__main__":
    main()
