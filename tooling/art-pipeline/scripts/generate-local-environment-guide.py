from incubator_context import game_root, content_path, logical_path
import json
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = game_root()
LAYOUT_ROOT = content_path(ROOT, "data") / "local-environments"
ASSET_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "environments"

COLORS = [
    (255, 88, 88, 230),
    (255, 190, 80, 230),
    (100, 220, 140, 230),
    (90, 180, 255, 230),
    (190, 130, 255, 230),
    (255, 120, 190, 230),
    (255, 240, 120, 230),
]


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def draw_cross(draw: ImageDraw.ImageDraw, x: float, y: float, color: tuple[int, int, int, int]) -> None:
    draw.line([(x - 18, y), (x + 18, y)], fill=color, width=4)
    draw.line([(x, y - 18), (x, y + 18)], fill=color, width=4)
    draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=color)


def base_path_for(env_dir: Path) -> Path:
    for name in ("base.png", "base.jpg", "base.webp"):
        path = env_dir / name
        if path.exists():
            return path
    raise FileNotFoundError(f"No base image found in {logical_path(ROOT, env_dir)}")


def write_guide(environment_id: str) -> None:
    layout_path = LAYOUT_ROOT / f"{environment_id}.json"
    env_dir = ASSET_ROOT / environment_id
    output_path = env_dir / "guide_slots.png"
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    base = Image.open(base_path_for(env_dir)).convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    label_font = font(24)
    small_font = font(18)

    for index, station in enumerate(layout["stations"]):
      color = COLORS[index % len(COLORS)]
      box = station["hitbox"]
      anchor = station["anchor"]
      x0, y0 = box["x"], box["y"]
      x1, y1 = x0 + box["w"], y0 + box["h"]
      draw.rectangle((x0, y0, x1, y1), outline=color, width=5)
      draw.rectangle((x0, y0, x1, y1), fill=(color[0], color[1], color[2], 38))
      draw_cross(draw, anchor["x"], anchor["y"], color)
      label = f'{station["id"]}  z{station["zIndex"]}'
      draw.rounded_rectangle((x0, max(0, y0 - 34), x0 + 290, y0 - 4), radius=8, fill=(20, 12, 8, 210))
      draw.text((x0 + 8, max(0, y0 - 31)), label, fill=(255, 245, 220, 255), font=small_font)

      art = station.get("art")
      if art:
          left = anchor["x"] - art["anchorOffset"]["x"]
          top = anchor["y"] - art["anchorOffset"]["y"]
          right = left + art["width"]
          bottom = top + art["height"]
          draw.rectangle((left, top, right, bottom), outline=(255, 255, 255, 190), width=2)
          draw.text((left + 6, top + 6), "art bounds", fill=(255, 255, 255, 220), font=small_font)

    title = f'{layout["title"]} slot guide'
    draw.rounded_rectangle((24, 24, 430, 70), radius=12, fill=(20, 12, 8, 220))
    draw.text((40, 34), title, fill=(255, 245, 220, 255), font=label_font)

    composed = Image.alpha_composite(base, overlay)
    composed.save(output_path)
    print(f"Wrote {logical_path(ROOT, output_path)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("environment", nargs="?", default="coffee_cafe", help="Environment id, or 'all'.")
    args = parser.parse_args()
    if args.environment == "all":
        for layout_path in sorted(LAYOUT_ROOT.glob("*.json")):
            if layout_path.name.endswith(".art.json"):
                continue
            write_guide(layout_path.stem)
    else:
        write_guide(args.environment)


if __name__ == "__main__":
    main()
