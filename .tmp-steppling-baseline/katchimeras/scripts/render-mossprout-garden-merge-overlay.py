"""Build a single-image 6x7 Merge-page-style overlay for the tall garden."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/images/katchimeras/merge-world/generated/merge-board-base.webp"
DESIGN_OUT = (
    ROOT
    / "design/floating-neighborhood-v2/mossprout-garden-board"
    / "mossprout-garden-board-merge-overlay.png"
)
RUNTIME_OUT = (
    ROOT
    / "assets/images/katchimeras/world/hex"
    / "floating_neighborhood_v2_mossprout_garden_board_merge_overlay_512x768.webp"
)
BOARD_BASE_OUT = (
    ROOT
    / "assets/images/katchimeras/merge-world/generated"
    / "merge-board-base-6x7.webp"
)

CANVAS = (1024, 1536)
SOURCE_CELL = 128
COLUMNS = 6
ROWS = 7
CELL = 96
LEFT = 224
TOP = 400
BOARD_WIDTH = COLUMNS * CELL
BOARD_HEIGHT = ROWS * CELL


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    board = Image.new("RGBA", (BOARD_WIDTH, BOARD_HEIGHT), (0, 0, 0, 0))

    shadow_mask = Image.new("L", CANVAS, 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_draw.rounded_rectangle(
        (LEFT + 4, TOP + 9, LEFT + BOARD_WIDTH - 4, TOP + BOARD_HEIGHT - 1),
        radius=28,
        fill=92,
    )
    shadow = Image.new("RGBA", CANVAS, (54, 60, 28, 0))
    shadow.putalpha(shadow_mask.filter(ImageFilter.GaussianBlur(8)))
    overlay.alpha_composite(shadow)

    for row in range(ROWS):
        for column in range(COLUMNS):
            crop = source.crop(
                (
                    column * SOURCE_CELL,
                    row * SOURCE_CELL,
                    (column + 1) * SOURCE_CELL,
                    (row + 1) * SOURCE_CELL,
                )
            ).resize((CELL, CELL), Image.Resampling.LANCZOS)
            mask = Image.new("L", (CELL, CELL), 0)
            ImageDraw.Draw(mask).rounded_rectangle((2, 2, CELL - 2, CELL - 2), radius=13, fill=255)
            crop.putalpha(mask)
            board.alpha_composite(crop, (column * CELL, row * CELL))

    preview = board.copy()
    preview.putalpha(preview.getchannel("A").point(lambda value: round(value * 0.82)))
    overlay.alpha_composite(preview, (LEFT, TOP))

    DESIGN_OUT.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(DESIGN_OUT)
    runtime = overlay.resize((512, 768), Image.Resampling.LANCZOS)
    RUNTIME_OUT.parent.mkdir(parents=True, exist_ok=True)
    runtime.save(RUNTIME_OUT, format="WEBP", quality=95, method=6)
    BOARD_BASE_OUT.parent.mkdir(parents=True, exist_ok=True)
    board.save(BOARD_BASE_OUT, format="WEBP", quality=95, method=6)
    print(DESIGN_OUT.relative_to(ROOT))
    print(RUNTIME_OUT.relative_to(ROOT), f"{RUNTIME_OUT.stat().st_size // 1024} KB")
    print(BOARD_BASE_OUT.relative_to(ROOT), f"{BOARD_BASE_OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
