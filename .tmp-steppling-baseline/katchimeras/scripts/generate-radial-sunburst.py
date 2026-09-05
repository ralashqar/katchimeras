from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/images/katchimeras/ui/radial-sunburst.png"
SIZE = 512
SUPERSAMPLE = 4
RAY_COUNT = 16
WEDGE_COVERAGE = 0.56


def alpha_curve(distance: int, peak_alpha: int) -> int:
    position = distance / 255
    stops = ((0.0, peak_alpha), (0.42, round(peak_alpha * 0.81)), (0.72, round(peak_alpha * 0.35)), (1.0, 0))
    for (start, start_alpha), (end, end_alpha) in zip(stops, stops[1:]):
        if position <= end:
            progress = (position - start) / (end - start)
            return round(start_alpha + (end_alpha - start_alpha) * progress)
    return 0


def generate() -> None:
    working_size = SIZE * SUPERSAMPLE
    center = working_size / 2
    radius = working_size * 0.5
    step = math.tau / RAY_COUNT
    half_wedge = step * WEDGE_COVERAGE / 2
    radial_distance = Image.radial_gradient("L").resize((working_size, working_size), Image.Resampling.BICUBIC)
    image = Image.new("RGBA", (working_size, working_size), (0, 0, 0, 0))

    for index in range(RAY_COUNT):
        angle = -math.pi / 2 + index * step
        wedge_mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(wedge_mask).polygon(
            [
                (center, center),
                (center + math.cos(angle - half_wedge) * radius, center + math.sin(angle - half_wedge) * radius),
                (center + math.cos(angle + half_wedge) * radius, center + math.sin(angle + half_wedge) * radius),
            ],
            fill=255,
        )
        primary = index % 2 == 0
        peak_alpha = 133 if primary else 97
        # Pillow normalizes its radial gradient at the square corners. Scale by
        # sqrt(2) so alpha reaches zero at the inscribed circle used by the rays.
        alpha = radial_distance.point(
            lambda value, peak=peak_alpha: alpha_curve(min(255, round(value * math.sqrt(2))), peak)
        )
        alpha = ImageChops.multiply(alpha, wedge_mask)
        color = (255, 238, 157) if primary else (255, 220, 112)
        layer = Image.new("RGBA", image.size, (*color, 0))
        layer.putalpha(alpha)
        image = Image.alpha_composite(image, layer)

    image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, optimize=True)
    print(f"Generated {OUTPUT.relative_to(ROOT)} ({image.width}x{image.height})")


if __name__ == "__main__":
    generate()
