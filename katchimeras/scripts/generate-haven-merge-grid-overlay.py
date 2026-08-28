#!/usr/bin/env python3
"""Build the transparent 7x6 grid painted over the gridless Haven island."""

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
    gap = 4 * SCALE

    for row in range(ROWS):
        for column in range(COLUMNS):
            x0 = column * CELL + gap / SCALE / 2
            x1 = (column + 1) * CELL - gap / SCALE / 2
            y0 = row * CELL + gap / SCALE / 2
            y1 = (row + 1) * CELL - gap / SCALE / 2
            polygon = [
                tuple(value * SCALE for value in project(x0, y0, width, height)),
                tuple(value * SCALE for value in project(x1, y0, width, height)),
                tuple(value * SCALE for value in project(x1, y1, width, height)),
                tuple(value * SCALE for value in project(x0, y1, width, height)),
            ]
            radii = [4 * SCALE] * 4
            if row == 0 and column == 0:
                radii[0] = 25 * SCALE
            if row == 0 and column == COLUMNS - 1:
                radii[1] = 25 * SCALE
            if row == ROWS - 1 and column == COLUMNS - 1:
                radii[2] = 25 * SCALE
            if row == ROWS - 1 and column == 0:
                radii[3] = 25 * SCALE
            rounded = rounded_polygon(polygon, radii)
            fill = (126, 154, 27, 30) if (row + column) % 2 == 0 else (105, 133, 20, 23)
            draw.polygon(rounded, fill=fill)
            draw.line(rounded + [rounded[0]], fill=(55, 78, 10, 76), width=2 * SCALE, joint="curve")
            # A soft inner highlight gives the same broad toy bevel without
            # baking gameplay objects or perspective into the island art.
            inner = []
            center_x = sum(point[0] for point in polygon) / 4
            center_y = sum(point[1] for point in polygon) / 4
            for point_x, point_y in polygon:
                inner.append((center_x + (point_x - center_x) * 0.965, center_y + (point_y - center_y) * 0.94))
            draw.line(inner[:2], fill=(213, 230, 102, 38), width=1 * SCALE)

    image = image.resize((width, height), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "WEBP", lossless=True, method=6)
    print(f"Generated {OUTPUT.relative_to(ROOT)} ({width}x{height}, {OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
