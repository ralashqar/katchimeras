from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "mossprout-standing.png"
OUTPUT = (
    ROOT
    / "assets"
    / "images"
    / "katchimeras"
    / "world"
    / "square"
    / "mossprout-standing-resident-512.webp"
)
EDGE = 512


def main() -> None:
    with Image.open(SOURCE) as opened:
        resident = opened.convert("RGBA").resize(
            (EDGE, EDGE),
            Image.Resampling.LANCZOS,
        )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    resident.save(
        OUTPUT,
        "WEBP",
        quality=92,
        alpha_quality=100,
        method=6,
        exact=True,
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
