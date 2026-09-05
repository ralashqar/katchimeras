"""Validate packaged discovery art and render background/LOD review sheets."""
from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "design/shared-world-discovery-v2"
ASSETS = ROOT / "assets/images/katchimeras/world/hex"
BRIEFS = json.loads((DESIGN / "briefs.json").read_text(encoding="utf-8"))
TILES = [
    ("Mossprout reference", "mossprout_focused_v1_main_hex_tile"),
    ("Steppling trailhead", BRIEFS["tiles"]["steppling"]["assetKey"]),
    ("Fully covered mist", BRIEFS["tiles"]["mist"]["assetKey"]),
]


def validate() -> None:
    for name, tile in BRIEFS["tiles"].items():
        folder = DESIGN / name
        record = json.loads((folder / "generation.json").read_text(encoding="utf-8"))
        assert record["model"] == "fal-ai/nano-banana-2/edit"
        assert hashlib.sha256((folder / "source.png").read_bytes()).hexdigest() == record["sourceSha256"]
        for reference in record["references"]:
            assert hashlib.sha256((ROOT / reference["path"]).read_bytes()).hexdigest() == reference["sha256"]
        for size, suffix in [(2048, None), (1024, ""), (512, "_512"), (256, "_256")]:
            path = folder / "alpha.png" if suffix is None else ASSETS / f"{tile['assetKey']}{suffix}.webp"
            with Image.open(path) as image:
                assert image.size == (size, size), path
                assert image.mode == "RGBA", path
                alpha = image.getchannel("A")
                bounds = alpha.getbbox()
                assert bounds and all((bounds[0] > 0, bounds[1] > 0, bounds[2] < size, bounds[3] < size)), path
                assert alpha.getextrema() == (0, 255), path
                print(f"PASS {path.relative_to(ROOT)}: {size}px, padded true alpha")


def review_sheet(size: int, suffix: str, output: str) -> None:
    label_height = 32
    backgrounds = [("cream", "#fff5df"), ("dark", "#243b42"), ("magenta", "#df70cb"), ("checker", "#dedede")]
    sheet = Image.new("RGB", (size * 3, (size + label_height) * len(backgrounds)))
    draw = ImageDraw.Draw(sheet)
    for row, (background, color) in enumerate(backgrounds):
        for column, (name, key) in enumerate(TILES):
            x, y = column * size, row * (size + label_height)
            canvas = Image.new("RGBA", (size, size), color)
            if background == "checker":
                checker = ImageDraw.Draw(canvas)
                for cy in range(0, size, 16):
                    for cx in range(0, size, 16):
                        if (cx // 16 + cy // 16) % 2:
                            checker.rectangle((cx, cy, cx + 15, cy + 15), fill="#b8b8b8")
            with Image.open(ASSETS / f"{key}{suffix}.webp") as tile:
                # Use exact packaged LOD pixels: no art edits or rescaling for this QA sheet.
                assert tile.size == (size, size)
                canvas.alpha_composite(tile.convert("RGBA"))
            sheet.paste(canvas.convert("RGB"), (x, y + label_height))
            draw.rectangle((x, y, x + size, y + label_height - 1), fill="#243b42")
            draw.text((x + 10, y + 9), f"{name} / {background} / {size}px", fill="white")
    sheet.save(DESIGN / output)
    print(f"Review: {DESIGN / output}")


if __name__ == "__main__":
    validate()
    review_sheet(512, "_512", "qa-512.png")
    review_sheet(256, "_256", "qa-256.png")
