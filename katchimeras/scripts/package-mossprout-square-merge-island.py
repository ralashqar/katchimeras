#!/usr/bin/env python3
"""Package the Square Haven v2 Mossprout merge island into runtime LODs."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "design"
    / "square-haven-v2"
    / "merge-board"
    / "mossprout-square-merge-island-v4-alpha.png"
)
MASTER = (
    ROOT
    / "design"
    / "square-haven-v2"
    / "merge-board"
    / "mossprout-square-merge-island-v4-1024.png"
)
RUNTIME_DIR = ROOT / "assets" / "images" / "katchimeras" / "world" / "square"
OUTPUTS = {
    1024: RUNTIME_DIR / "mossprout-merge-island-perspective.webp",
    512: RUNTIME_DIR / "mossprout-merge-island-perspective-512.webp",
    256: RUNTIME_DIR / "mossprout-merge-island-perspective-256.webp",
}
def preserved_canvas(source: Image.Image, size: int) -> Image.Image:
    """Keep the generated full-canvas calibration instead of recropping alpha."""
    if source.getbbox() is None:
        raise ValueError(f"Merge-island source is empty: {SOURCE}")
    return source.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    with Image.open(SOURCE) as opened:
        source = opened.convert("RGBA")

    master = preserved_canvas(source, 1024)
    MASTER.parent.mkdir(parents=True, exist_ok=True)
    master.save(MASTER, "PNG", optimize=True)
    print(f"Wrote {MASTER.relative_to(ROOT)}")

    for size, output in OUTPUTS.items():
        output.parent.mkdir(parents=True, exist_ok=True)
        preserved_canvas(source, size).save(
            output,
            "WEBP",
            quality=88,
            alpha_quality=100,
            method=6,
        )
        print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
