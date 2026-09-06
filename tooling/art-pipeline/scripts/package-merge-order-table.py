from incubator_context import game_root, content_path, logical_path
from pathlib import Path

from PIL import Image


ROOT = game_root()
SOURCE = content_path(ROOT, "artifacts") / "merge-order-table" / "order-table-v1-alpha.png"
OUTPUT = content_path(ROOT, "assets") / "images" / "katchimeras" / "merge-world" / "ui" / "order-service-tray.webp"
TARGET_WIDTH = 512
PADDING = 20


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("The source table has no visible pixels.")
    left, top, right, bottom = bounds
    return (
        max(0, left - PADDING),
        max(0, top - PADDING),
        min(image.width, right + PADDING),
        min(image.height, bottom + PADDING),
    )


def main() -> None:
    with Image.open(SOURCE) as opened:
        source = opened.convert("RGBA")
    cropped = source.crop(visible_bounds(source))
    target_height = round(cropped.height * TARGET_WIDTH / cropped.width)
    runtime = cropped.resize((TARGET_WIDTH, target_height), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(
        OUTPUT,
        "WEBP",
        quality=92,
        alpha_quality=100,
        method=6,
        exact=True,
    )
    print(f"Wrote {logical_path(ROOT, OUTPUT)} ({runtime.width}x{runtime.height}, {OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
