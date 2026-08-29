#!/usr/bin/env python3
"""Build the transparent 7x6 checker overlay for the gridless Haven island."""

from pathlib import Path
from math import hypot

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/images/katchimeras/merge-world/generated/haven-merge-grid-7x6.webp"
COLUMNS = 7
ROWS = 6
CELL = 128
SCALE = 4
TOP_WIDTH_RATIO = 534 / 584
DARK_CELL_OVERLAY = (38, 61, 10, 48)
CELL_INSET = 5
CELL_RADIUS = 14


def rounded_polygon(
    points: list[tuple[float, float]],
    radii: list[float],
    curve_steps: int = 8,
) -> list[tuple[float, float]]:
    """Approximate independently rounded corners on a convex polygon."""
    result: list[tuple[float, float]] = []
    count = len(points)
    for index, point in enumerate(points):
        previous = points[(index - 1) % count]
        following = points[(index + 1) % count]
        incoming_length = max(1, hypot(previous[0] - point[0], previous[1] - point[1]))
        outgoing_length = max(1, hypot(following[0] - point[0], following[1] - point[1]))
        radius = min(radii[index], incoming_length * 0.42, outgoing_length * 0.42)
        incoming = (
            point[0] + (previous[0] - point[0]) * radius / incoming_length,
            point[1] + (previous[1] - point[1]) * radius / incoming_length,
        )
        outgoing = (
            point[0] + (following[0] - point[0]) * radius / outgoing_length,
            point[1] + (following[1] - point[1]) * radius / outgoing_length,
        )
        result.append(incoming)
        for step in range(1, curve_steps + 1):
            t = step / curve_steps
            inverse = 1 - t
            result.append((
                inverse * inverse * incoming[0] + 2 * inverse * t * point[0] + t * t * outgoing[0],
                inverse * inverse * incoming[1] + 2 * inverse * t * point[1] + t * t * outgoing[1],
            ))
    return result


def project(x: float, y: float, width: float, height: float) -> tuple[float, float]:
    depth = y / height
    width_scale = TOP_WIDTH_RATIO + (1 - TOP_WIDTH_RATIO) * depth
    return width / 2 + (x - width / 2) * width_scale, y


def main() -> None:
    width = COLUMNS * CELL
    height = ROWS * CELL
    image = Image.new("RGBA", (width * SCALE, height * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for row in range(ROWS):
        for column in range(COLUMNS):
            # The untouched cells expose the island grass. Only the alternate
            # cells receive one soft, inset darkening pass, so there is no
            # lattice of strokes or seams to read as grid lines.
            if (row + column) % 2 == 0:
                continue
            x0 = column * CELL + CELL_INSET
            x1 = (column + 1) * CELL - CELL_INSET
            y0 = row * CELL + CELL_INSET
            y1 = (row + 1) * CELL - CELL_INSET
            polygon = [
                tuple(value * SCALE for value in project(x0, y0, width, height)),
                tuple(value * SCALE for value in project(x1, y0, width, height)),
                tuple(value * SCALE for value in project(x1, y1, width, height)),
                tuple(value * SCALE for value in project(x0, y1, width, height)),
            ]
            radii = [CELL_RADIUS * SCALE] * 4
            rounded = rounded_polygon(polygon, radii)
            draw.polygon(rounded, fill=DARK_CELL_OVERLAY)

    image = image.resize((width, height), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "WEBP", lossless=True, method=6)
    print(f"Generated {OUTPUT.relative_to(ROOT)} ({width}x{height}, {OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
