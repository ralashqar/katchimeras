#!/usr/bin/env python3
"""Small image helpers for tools/world-editor environment design."""

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def rect_from_json(value: str) -> dict:
    try:
        rect = json.loads(value)
    except json.JSONDecodeError:
        rect = json.loads(re.sub(r"([{,])\s*([xywh])\s*:", r'\1"\2":', value))
    return {
        "x": int(round(float(rect["x"]))),
        "y": int(round(float(rect["y"]))),
        "w": int(round(float(rect["w"]))),
        "h": int(round(float(rect["h"]))),
    }


def cmd_guide(args: argparse.Namespace) -> None:
    base = Image.open(args.base).convert("RGBA")
    rect = rect_from_json(args.rect)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    x0, y0 = rect["x"], rect["y"]
    x1, y1 = x0 + rect["w"], y0 + rect["h"]
    draw.rectangle((x0, y0, x1, y1), fill=(255, 78, 64, 48), outline=(255, 78, 64, 255), width=6)
    cx = x0 + rect["w"] / 2
    cy = y0 + rect["h"] / 2
    draw.line((cx - 28, cy, cx + 28, cy), fill=(255, 244, 156, 255), width=5)
    draw.line((cx, cy - 28, cx, cy + 28), fill=(255, 244, 156, 255), width=5)
    label = args.label or "target placement"
    label_font = font(max(18, min(34, base.width // 46)))
    bbox = draw.textbbox((0, 0), label, font=label_font)
    lw = bbox[2] - bbox[0]
    lh = bbox[3] - bbox[1]
    ly = max(8, y0 - lh - 20)
    draw.rounded_rectangle((x0, ly, x0 + lw + 24, ly + lh + 14), radius=9, fill=(20, 10, 4, 218))
    draw.text((x0 + 12, ly + 7), label, fill=(255, 244, 220, 255), font=label_font)
    Image.alpha_composite(base, overlay).save(args.out)


def cmd_crop(args: argparse.Namespace) -> None:
    image = Image.open(args.input).convert("RGBA")
    rect = rect_from_json(args.rect)
    pad = int(args.pad)
    x0 = max(0, rect["x"] - pad)
    y0 = max(0, rect["y"] - pad)
    x1 = min(image.width, rect["x"] + rect["w"] + pad)
    y1 = min(image.height, rect["y"] + rect["h"] + pad)
    image.crop((x0, y0, x1, y1)).save(args.out)


def cmd_crop_square(args: argparse.Namespace) -> None:
    image = Image.open(args.input).convert("RGBA")
    rect = rect_from_json(args.rect)
    crop_box = square_crop_box(image, rect, int(args.pad))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    image.crop(crop_box).save(args.out)


def cmd_fit(args: argparse.Namespace) -> None:
    image = Image.open(args.input).convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    pad_ratio = float(args.pad_ratio)
    pad_x = max(0, round(image.width * pad_ratio))
    pad_y = max(0, round(image.height * pad_ratio))
    padded = Image.new("RGBA", (image.width + pad_x * 2, image.height + pad_y * 2), (0, 0, 0, 0))
    padded.alpha_composite(image, (pad_x, pad_y))
    padded.thumbnail((int(args.width), int(args.height)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (int(args.width), int(args.height)), (0, 0, 0, 0))
    canvas.alpha_composite(padded, ((canvas.width - padded.width) // 2, (canvas.height - padded.height) // 2))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out)


def square_crop_box(image: Image.Image, rect: dict, pad: int) -> tuple[int, int, int, int]:
    desired = max(rect["w"] + pad * 2, rect["h"] + pad * 2, 256)
    desired = min(desired, image.width, image.height)
    cx = rect["x"] + rect["w"] / 2
    cy = rect["y"] + rect["h"] / 2
    x0 = int(round(cx - desired / 2))
    y0 = int(round(cy - desired / 2))
    x0 = max(0, min(x0, image.width - desired))
    y0 = max(0, min(y0, image.height - desired))
    return x0, y0, x0 + desired, y0 + desired


def cmd_compose_fit_input(args: argparse.Namespace) -> None:
    base = Image.open(args.base).convert("RGBA")
    prop = Image.open(args.prop).convert("RGBA")
    rect = rect_from_json(args.rect)
    pad = int(args.pad)
    crop_box = square_crop_box(base, rect, pad)
    base_crop = base.crop(crop_box)
    guide = base_crop.copy()
    prop_fit = prop.copy()
    prop_fit.thumbnail((rect["w"], rect["h"]), Image.Resampling.LANCZOS)
    prop_canvas = Image.new("RGBA", (rect["w"], rect["h"]), (0, 0, 0, 0))
    prop_canvas.alpha_composite(prop_fit, ((rect["w"] - prop_fit.width) // 2, (rect["h"] - prop_fit.height) // 2))
    guide.alpha_composite(prop_canvas, (rect["x"] - crop_box[0], rect["y"] - crop_box[1]))
    Path(args.out_base).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_guide).parent.mkdir(parents=True, exist_ok=True)
    base_crop.save(args.out_base)
    guide.save(args.out_guide)


def cmd_extract_fit_candidate(args: argparse.Namespace) -> None:
    cmd_fit(args)


def cmd_has_alpha(args: argparse.Namespace) -> None:
    image = Image.open(args.input).convert("RGBA")
    alpha = image.getchannel("A")
    has_transparency = alpha.getextrema()[0] < 250
    print("true" if has_transparency else "false")


def cmd_compose_scene_guide(args: argparse.Namespace) -> None:
    base = Image.open(args.base).convert("RGBA")
    guide = base.copy()
    with open(args.placements, "r", encoding="utf-8") as handle:
        placements = json.load(handle)
    for item in placements:
        prop_path = item.get("propPath")
        if not prop_path or not Path(prop_path).exists():
            continue
        rect = {
            "x": int(round(float(item["rect"]["x"]))),
            "y": int(round(float(item["rect"]["y"]))),
            "w": int(round(float(item["rect"]["w"]))),
            "h": int(round(float(item["rect"]["h"]))),
        }
        prop = Image.open(prop_path).convert("RGBA")
        prop.thumbnail((rect["w"], rect["h"]), Image.Resampling.LANCZOS)
        prop_canvas = Image.new("RGBA", (rect["w"], rect["h"]), (0, 0, 0, 0))
        prop_canvas.alpha_composite(prop, ((rect["w"] - prop.width) // 2, (rect["h"] - prop.height) // 2))
        guide.alpha_composite(prop_canvas, (rect["x"], rect["y"]))
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    guide.save(args.out)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    guide = sub.add_parser("guide")
    guide.add_argument("--base", required=True)
    guide.add_argument("--rect", required=True)
    guide.add_argument("--label", default="")
    guide.add_argument("--out", required=True)
    guide.set_defaults(func=cmd_guide)

    crop = sub.add_parser("crop")
    crop.add_argument("--input", required=True)
    crop.add_argument("--rect", required=True)
    crop.add_argument("--pad", default=48)
    crop.add_argument("--out", required=True)
    crop.set_defaults(func=cmd_crop)

    crop_square = sub.add_parser("crop-square")
    crop_square.add_argument("--input", required=True)
    crop_square.add_argument("--rect", required=True)
    crop_square.add_argument("--pad", default=96)
    crop_square.add_argument("--out", required=True)
    crop_square.set_defaults(func=cmd_crop_square)

    fit = sub.add_parser("fit")
    fit.add_argument("--input", required=True)
    fit.add_argument("--width", required=True)
    fit.add_argument("--height", required=True)
    fit.add_argument("--pad-ratio", default=0.06)
    fit.add_argument("--out", required=True)
    fit.set_defaults(func=cmd_fit)

    compose = sub.add_parser("compose-fit-input")
    compose.add_argument("--base", required=True)
    compose.add_argument("--prop", required=True)
    compose.add_argument("--rect", required=True)
    compose.add_argument("--pad", default=96)
    compose.add_argument("--out-base", required=True)
    compose.add_argument("--out-guide", required=True)
    compose.set_defaults(func=cmd_compose_fit_input)

    extract_fit = sub.add_parser("extract-fit-candidate")
    extract_fit.add_argument("--input", required=True)
    extract_fit.add_argument("--width", required=True)
    extract_fit.add_argument("--height", required=True)
    extract_fit.add_argument("--pad-ratio", default=0.06)
    extract_fit.add_argument("--out", required=True)
    extract_fit.set_defaults(func=cmd_extract_fit_candidate)

    has_alpha = sub.add_parser("has-alpha")
    has_alpha.add_argument("--input", required=True)
    has_alpha.set_defaults(func=cmd_has_alpha)

    compose_scene = sub.add_parser("compose-scene-guide")
    compose_scene.add_argument("--base", required=True)
    compose_scene.add_argument("--placements", required=True)
    compose_scene.add_argument("--out", required=True)
    compose_scene.set_defaults(func=cmd_compose_scene_guide)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
