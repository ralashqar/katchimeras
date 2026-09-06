from incubator_context import game_root, content_path, logical_path
import json
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = game_root()
LAYOUT_ROOT = content_path(ROOT, "data") / "local-environments"
ASSET_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "environments"

PALETTE = {
    "coffee_bar": [(111, 72, 39), (177, 117, 62), (234, 190, 116)],
    "bean_shelf": [(91, 96, 57), (127, 141, 78), (202, 180, 107)],
    "travel_map": [(78, 121, 89), (111, 158, 111), (229, 199, 125)],
    "photo_wall": [(79, 111, 134), (108, 152, 176), (225, 211, 167)],
    "recipe_book": [(108, 74, 49), (160, 110, 71), (230, 181, 111)],
    "notice_board": [(96, 61, 38), (155, 94, 54), (238, 196, 119)],
    "trophy_shelf": [(112, 87, 42), (179, 135, 56), (255, 216, 104)],
    "feast_table": [(128, 77, 40), (177, 110, 54), (236, 176, 91)],
    "spice_rack": [(95, 91, 46), (140, 127, 63), (218, 167, 76)],
    "hearth_pot": [(97, 61, 43), (153, 80, 46), (238, 119, 58)],
    "market_map": [(75, 111, 82), (116, 151, 92), (220, 188, 105)],
    "photo_menu": [(84, 93, 111), (123, 139, 154), (221, 205, 155)],
    "dessert_case": [(144, 84, 91), (199, 122, 124), (247, 190, 164)],
    "quest_board": [(104, 69, 43), (158, 103, 58), (236, 189, 112)],
    "trophy_cupboard": [(119, 88, 45), (177, 128, 56), (248, 202, 93)],
}


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def draw_feastle_base(layout: dict) -> Image.Image:
    width = int(layout["plate"]["width"])
    height = int(layout["plate"]["height"])
    image = Image.new("RGB", (width, height), (58, 36, 22))
    draw = ImageDraw.Draw(image)

    for y in range(height):
        t = y / height
        r = int(77 + 62 * t)
        g = int(53 + 30 * t)
        b = int(33 + 10 * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    wall_top = 70
    floor_y = 600
    draw.rounded_rectangle((90, wall_top, width - 90, 890), radius=54, fill=(112, 69, 39), outline=(172, 105, 55), width=10)
    draw.polygon([(150, floor_y), (width - 150, floor_y), (width - 55, height - 70), (55, height - 70)], fill=(221, 167, 93))

    tile_color = (238, 193, 119)
    grout = (171, 111, 58)
    for i in range(-8, 18):
        x0 = 55 + i * 110
        draw.line([(x0, height - 70), (x0 + 520, floor_y)], fill=grout, width=5)
        draw.line([(width - x0, height - 70), (width - x0 - 520, floor_y)], fill=grout, width=5)
    for j in range(8):
        y = floor_y + j * 112
        inset = j * 22
        draw.line([(150 - inset, y), (width - 150 + inset, y)], fill=grout, width=5)
    for j in range(7):
        y = floor_y + 18 + j * 112
        inset = j * 20
        draw.line([(170 - inset, y), (width - 170 + inset, y)], fill=tile_color, width=15)

    draw.rounded_rectangle((168, 135, 545, 470), radius=38, fill=(76, 112, 68), outline=(178, 113, 61), width=18)
    draw.rounded_rectangle((175, 145, 535, 460), radius=30, outline=(43, 73, 45), width=7)
    draw.rounded_rectangle((990, 130, 1360, 500), radius=40, fill=(82, 123, 77), outline=(178, 113, 61), width=18)
    draw.rounded_rectangle((1003, 145, 1347, 488), radius=32, outline=(43, 73, 45), width=7)

    draw.rounded_rectangle((600, 120, 935, 310), radius=22, fill=(49, 32, 24), outline=(178, 113, 61), width=12)
    label_font = font(48)
    draw.text((672, 170), "FEAST", fill=(244, 211, 146), font=label_font)
    for x in (350, 1185):
        draw.ellipse((x - 40, 338, x + 40, 420), fill=(255, 206, 94))
        draw.ellipse((x - 28, 350, x + 28, 406), fill=(255, 228, 142))
        draw.line([(x, 280), (x, 338)], fill=(69, 42, 26), width=7)

    for x, y, s in [(108, 1130, 1.2), (1390, 1190, 1.25), (118, 330, 0.95), (1430, 420, 0.9)]:
        draw_tree(draw, x, y, s)

    highlight = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.ellipse((360, 420, 1160, 1280), fill=(255, 203, 105, 40))
    hdraw.rectangle((0, 0, width, height), outline=(50, 27, 15, 115), width=42)
    image = Image.alpha_composite(image.convert("RGBA"), highlight).convert("RGB")
    return image


def draw_tree(draw: ImageDraw.ImageDraw, x: float, y: float, scale: float) -> None:
    trunk = (109, 65, 32)
    leaves = [(86, 148, 45), (106, 173, 53), (133, 197, 65)]
    draw.rounded_rectangle((x - 18 * scale, y - 95 * scale, x + 18 * scale, y), radius=int(10 * scale), fill=trunk)
    for i, (dx, dy, r) in enumerate([(-42, -112, 42), (0, -142, 52), (45, -112, 43), (-12, -92, 46), (24, -84, 40)]):
        color = leaves[i % len(leaves)]
        draw.ellipse((x + (dx - r) * scale, y + (dy - r) * scale, x + (dx + r) * scale, y + (dy + r) * scale), fill=color)


def ensure_base(layout: dict, env_dir: Path) -> None:
    base_png = env_dir / "base.png"
    base_jpg = env_dir / "base.jpg"
    if base_png.exists() or base_jpg.exists():
        return
    env_dir.mkdir(parents=True, exist_ok=True)
    if layout["id"] == "feastle_hearth":
        draw_feastle_base(layout).save(base_png)
        print(f"Wrote {logical_path(ROOT, base_png)}")
        return
    Image.new("RGB", (int(layout["plate"]["width"]), int(layout["plate"]["height"])), (60, 42, 28)).save(base_png)
    print(f"Wrote {logical_path(ROOT, base_png)}")


def draw_placeholder(station: dict, level: int) -> Image.Image:
    art = station["art"]
    width = int(art["width"])
    height = int(art["height"])
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((width * 0.12, height * 0.72, width * 0.88, height * 0.96), fill=(35, 20, 10, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(4, width // 38)))
    image.alpha_composite(shadow)

    draw = ImageDraw.Draw(image)
    colors = PALETTE.get(station["id"], PALETTE["coffee_bar"])
    base = colors[min(level - 1, len(colors) - 1)]
    trim = tuple(min(255, channel + 48) for channel in base)
    dark = tuple(max(0, channel - 42) for channel in base)
    inset = max(8, width // 18)
    top = max(8, height // 12)
    bottom = int(height * 0.82)

    draw.rounded_rectangle(
        (inset, top, width - inset, bottom),
        radius=max(12, min(width, height) // 8),
        fill=(*base, 218),
        outline=(*trim, 235),
        width=max(3, width // 70),
    )
    draw.rounded_rectangle(
        (inset + 10, top + 10, width - inset - 10, bottom - 10),
        radius=max(8, min(width, height) // 11),
        outline=(*dark, 160),
        width=max(2, width // 110),
    )

    for index in range(level):
        cx = inset + 28 + index * 30
        cy = top + 28
        draw.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(255, 231, 154, 230))

    label_font = font(max(16, width // 12))
    label = station["shortLabel"]
    bbox = draw.textbbox((0, 0), label, font=label_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        ((width - text_w) / 2, top + (bottom - top - text_h) / 2),
        label,
        fill=(255, 245, 220, 245),
        font=label_font,
    )

    level_font = font(max(14, width // 15))
    draw.rounded_rectangle((width - inset - 42, top + 12, width - inset - 10, top + 44), radius=16, fill=(35, 22, 12, 210))
    draw.text((width - inset - 31, top + 17), str(level), fill=(255, 228, 160, 255), font=level_font)
    return image


def generate(environment_id: str) -> None:
    layout_path = LAYOUT_ROOT / f"{environment_id}.json"
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    env_dir = ASSET_ROOT / environment_id
    props_dir = env_dir / "props"
    foreground_path = env_dir / "foreground.webp"
    props_dir.mkdir(parents=True, exist_ok=True)
    ensure_base(layout, env_dir)

    plate = layout["plate"]
    foreground = Image.new("RGBA", (int(plate["width"]), int(plate["height"])), (0, 0, 0, 0))
    foreground.save(foreground_path, lossless=True, quality=100)
    print(f"Wrote {logical_path(ROOT, foreground_path)}")

    for station in layout["stations"]:
        for level, asset_key in enumerate(station["art"]["levels"], start=1):
            output = props_dir / f"{asset_key}.webp"
            draw_placeholder(station, level).save(output, lossless=True, quality=100)
            print(f"Wrote {logical_path(ROOT, output)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("environment", nargs="?", default="coffee_cafe", help="Environment id, or 'all'.")
    args = parser.parse_args()
    if args.environment == "all":
        for layout_path in sorted(LAYOUT_ROOT.glob("*.json")):
            if layout_path.name.endswith(".art.json"):
                continue
            generate(layout_path.stem)
    else:
        generate(args.environment)


if __name__ == "__main__":
    main()
