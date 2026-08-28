#!/usr/bin/env python3
"""Render the calibrated 7x6 overlay on the Square Haven v2 merge island."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ISLAND = (
    ROOT
    / "design"
    / "square-haven-v2"
    / "merge-board"
    / "mossprout-square-merge-island-v4-1024.png"
)
GRID = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "generated" / "haven-merge-grid-7x6.webp"
OUTPUT = ROOT / "design" / "square-haven-v2" / "merge-board" / "mossprout-square-merge-island-v4-grid-qa.png"
BOUNDS = (205, 195, 819, 720)


def main() -> None:
    with Image.open(ISLAND) as opened:
        island = opened.convert("RGBA")
    with Image.open(GRID) as opened:
        grid = opened.convert("RGBA")
    left, top, right, bottom = BOUNDS
    grid = grid.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    island.alpha_composite(grid, (left, top))
    island.save(OUTPUT, "PNG", optimize=True)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
