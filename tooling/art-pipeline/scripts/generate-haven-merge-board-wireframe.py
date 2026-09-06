from incubator_context import game_root, content_path, logical_path
#!/usr/bin/env python3
"""Generate a style-neutral 6x7 Haven merge-island construction guide."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = game_root()
OUTPUT = content_path(ROOT, "artifacts") / "haven-merge-board-structure-only-6x7.png"
GRIDLESS_OUTPUT = content_path(ROOT, "artifacts") / "haven-merge-board-structure-only-gridless.png"
SIZE = 1254


def main() -> None:
    image = Image.new("RGB", (SIZE, SIZE), "#ff00ff")
    draw = ImageDraw.Draw(image)

    # Flat construction regions only. These deliberately contain no rendered
    # materials so image generation must take its style from the game anchors.
    draw.rounded_rectangle((105, 125, 1149, 1095), radius=210, fill="#8d95a3")
    draw.rounded_rectangle((135, 95, 1119, 1015), radius=190, fill="#d5d9df")

    # Rear landmark mass, with ample top safety margin.
    draw.ellipse((470, 42, 784, 274), fill="#aeb6c2")
    draw.rounded_rectangle((542, 128, 712, 277), radius=62, fill="#717b88")
    draw.rounded_rectangle((589, 170, 665, 277), radius=34, fill="#313946")

    # Exact perspective board: 6 columns by 7 rows, gently narrower at top.
    top_y, bottom_y = 272, 917
    top_left, top_right = 277, 977
    bottom_left, bottom_right = 235, 1019
    rows, columns = 7, 6
    for row in range(rows):
        y0 = top_y + (bottom_y - top_y) * row / rows
        y1 = top_y + (bottom_y - top_y) * (row + 1) / rows
        t0 = row / rows
        t1 = (row + 1) / rows
        left0 = top_left + (bottom_left - top_left) * t0
        right0 = top_right + (bottom_right - top_right) * t0
        left1 = top_left + (bottom_left - top_left) * t1
        right1 = top_right + (bottom_right - top_right) * t1
        for column in range(columns):
            x00 = left0 + (right0 - left0) * column / columns
            x10 = left0 + (right0 - left0) * (column + 1) / columns
            x01 = left1 + (right1 - left1) * column / columns
            x11 = left1 + (right1 - left1) * (column + 1) / columns
            polygon = [(x00 + 3, y0 + 3), (x10 - 3, y0 + 3), (x11 - 3, y1 - 3), (x01 + 3, y1 - 3)]
            draw.polygon(polygon, fill="#f5f6f7", outline="#3d4652", width=4)

    # A few large perimeter masses indicate scale without prescribing detail.
    for x, y, rx, ry in [
        (205, 250, 78, 62), (1049, 250, 78, 62),
        (175, 510, 62, 96), (1079, 510, 62, 96),
        (170, 770, 68, 92), (1084, 770, 68, 92),
        (285, 963, 90, 58), (505, 985, 100, 62),
        (749, 985, 100, 62), (969, 963, 90, 58),
    ]:
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill="#b8bec7", outline="#626d79", width=5)

    # Cliff block rhythm: fewer, larger blocks than the rejected candidate.
    cliff_blocks = [(155, 935, 330, 1100), (310, 965, 505, 1160), (485, 975, 665, 1190),
                    (645, 975, 825, 1190), (805, 965, 1000, 1160), (924, 935, 1099, 1100)]
    for box in cliff_blocks:
        draw.rounded_rectangle(box, radius=46, fill="#747e8a", outline="#404955", width=6)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, optimize=True)
    print(f"Generated {logical_path(ROOT, OUTPUT)} ({SIZE}x{SIZE})")

    # Separate image-generation guide for the runtime island base. Keeping the
    # central plane free of guide seams prevents baked grid-count mistakes.
    gridless = image.copy()
    gridless_draw = ImageDraw.Draw(gridless)
    gridless_draw.polygon(
        [(277, 272), (977, 272), (1019, 917), (235, 917)],
        fill="#f5f6f7",
        outline="#3d4652",
        width=6,
    )
    gridless.save(GRIDLESS_OUTPUT, optimize=True)
    print(f"Generated {logical_path(ROOT, GRIDLESS_OUTPUT)} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
