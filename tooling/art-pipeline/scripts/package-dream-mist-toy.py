"""Package the approved toy-diorama Dream Mist masters for runtime."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import io
import os
from pathlib import Path

from PIL import Image


ROOT = game_root()
SOURCE = content_path(ROOT, "artifacts") / "dream-mist-toy"
OUTPUT = content_path(ROOT, "assets") / "images" / "katchimeras" / "merge-world" / "locked"
EDGE = 192

ASSETS = (
    ("dream-mist-full-alpha.png", "dream-mist-full.webp", "full"),
    ("dream-mist-lower-alpha.png", "dream-mist-lower.webp", "lower"),
)


def package(source_name: str, output_name: str, placement: str) -> None:
    with Image.open(SOURCE / source_name).convert("RGBA") as image:
        if placement in {"full", "lower"}:
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"{source_name} contains no visible pixels")
            visible = image.crop(bounds)
            horizontal_padding = 2 if placement == "full" else 6
            content_width = EDGE - horizontal_padding * 2
            content_height = EDGE - 4
            scale = min(content_width / visible.width, content_height / visible.height)
            visible = visible.resize(
                (round(visible.width * scale), round(visible.height * scale)),
                Image.Resampling.LANCZOS,
            )
            runtime = Image.new("RGBA", (EDGE, EDGE), (0, 0, 0, 0))
            top = (EDGE - visible.height) // 2 if placement == "full" else EDGE - visible.height - 3
            runtime.alpha_composite(
                visible,
                ((EDGE - visible.width) // 2, top),
            )
        else:
            runtime = image.resize((EDGE, EDGE), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        runtime.save(encoded, "WEBP", lossless=False, quality=92, method=6)

    destination = OUTPUT / output_name
    temporary = destination.with_name(f".{destination.name}.tmp")
    temporary.write_bytes(encoded.getvalue())
    os.replace(temporary, destination)
    print(f"{output_name}: {EDGE}x{EDGE}")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, output_name, placement in ASSETS:
        package(source_name, output_name, placement)


if __name__ == "__main__":
    main()
