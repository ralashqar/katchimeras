#!/usr/bin/env python3
"""Package the approved square Haven v2 Mossprout island into runtime LODs."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "design"
    / "square-haven-v2"
    / "mossprout"
    / "mossprout-main-environment-square-v4-alpha.png"
)
MASTER = ROOT / "design" / "square-haven-v1" / "mossprout-main-environment-1024.png"
RUNTIME_DIR = ROOT / "assets" / "images" / "katchimeras" / "world" / "square"
OUTPUTS = {
    1024: RUNTIME_DIR / "mossprout-main-environment.webp",
    512: RUNTIME_DIR / "mossprout-main-environment-512.webp",
    256: RUNTIME_DIR / "mossprout-main-environment-256.webp",
}
def preserved_canvas(source: Image.Image, size: int) -> Image.Image:
    """Retain the exact framing of the user-supplied square production art."""
    if source.getbbox() is None:
        raise ValueError(f"Mossprout island source is empty: {SOURCE}")
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
