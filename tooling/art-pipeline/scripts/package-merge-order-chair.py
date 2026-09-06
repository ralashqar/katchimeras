from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Package the approved merge-order chair cutout for the runtime UI."""

from pathlib import Path

from PIL import Image


ROOT = game_root()
SOURCE = content_path(ROOT, "artifacts") / "merge-order-chair" / "order-chair-v1-alpha.png"
OUTPUT = content_path(ROOT, "assets") / "images" / "katchimeras" / "merge-world" / "ui" / "order-chair.webp"
SIZE = 256
PADDING = 10


def main() -> None:
    with Image.open(SOURCE) as opened:
        source = opened.convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"Chair source has no visible pixels: {SOURCE}")

    subject = source.crop(bounds)
    available = SIZE - PADDING * 2
    scale = min(available / subject.width, available / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((SIZE - subject.width) // 2, SIZE - PADDING - subject.height))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, "WEBP", quality=90, alpha_quality=100, method=6, exact=True)
    print(f"Wrote {logical_path(ROOT, OUTPUT)} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
