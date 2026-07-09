#!/usr/bin/env python3
"""Generate Feastle's local environment art through the deployed Supabase/FAL pipeline.

This replaces the deterministic placeholder art with production-ish bitmap art:
  1. Generate the 1536 square Feastle Hearth base from the placeholder layout,
     using the coffee cafe base as the style reference.
  2. Regenerate the slot guide over that base.
  3. Generate transparent station props per level, fit them into the existing
     JSON art bounds, and save WebP files consumed by constants/local-environments.ts.

Secrets stay server-side: this script only reads the Supabase public URL/key from
.env.local and invokes existing edge functions.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ENV_ID = "feastle_hearth"
ENV_DIR = ROOT / "assets" / "images" / "katchimeras" / "environments" / ENV_ID
PROPS_DIR = ENV_DIR / "props"
LAYOUT_PATH = ROOT / "data" / "local-environments" / f"{ENV_ID}.json"
ART_PATH = ROOT / "data" / "local-environments" / f"{ENV_ID}.art.json"
STYLE_REF_PATH = ROOT / "assets" / "images" / "katchimeras" / "environments" / "coffee_cafe" / "base.jpg"
BASE_PATH = ENV_DIR / "base.png"
GUIDE_PATH = ENV_DIR / "guide_slots.png"
TMP_DIR = ROOT / ".tmp" / "feastle-art"

NO_TEXT = (
    "Absolutely no readable text, no numbers, no letters, no typography, no UI, "
    "no watermark, no captions, no labels."
)

LEVEL_DETAILS: dict[str, dict[int, str]] = {
    "feast_table": {
        1: "Level 1: a simple rounded wooden feast table with a few plates and serving bowls.",
        2: "Level 2: the same table with a fuller warm meal spread and more dishes.",
        3: "Level 3: the same table as a generous glowing feast centerpiece, richer but not cluttered.",
    },
    "spice_rack": {
        1: "Level 1: a small wall spice rack with a few jars and herbs.",
        2: "Level 2: a fuller rack with more colorful spice jars and cuisine keepsakes.",
        3: "Level 3: a lush abundant spice and herb collection, still clean and readable.",
    },
    "hearth_pot": {
        1: "Level 1: a small cozy cooking pot with faint warm steam.",
        2: "Level 2: the same pot actively simmering with utensils and a warmer glow.",
        3: "Level 3: a rich glowing hearth-pot setup with a tiny flame motif and fuller cooking energy.",
    },
    "market_map": {
        1: "Level 1: a simple food journey map on a small stand.",
        2: "Level 2: the same map with several produce pins and small market tokens.",
        3: "Level 3: a full food journey board with baskets and pins, rich but readable.",
    },
    "photo_menu": {
        1: "Level 1: a few framed food-photo cards on a warm wooden menu board.",
        2: "Level 2: an expanded board with more photo cards, no readable text.",
        3: "Level 3: an abundant curated photo menu wall, still no readable text.",
    },
    "dessert_case": {
        1: "Level 1: a small rounded dessert display case with a few pastries.",
        2: "Level 2: the same case with more sweets and warmer glass highlights.",
        3: "Level 3: a celebratory glowing dessert case with abundant pastries, not cluttered.",
    },
    "quest_board": {
        1: "Level 1: a small warm wooden quest board with a few pinned cards and utensil motif.",
        2: "Level 2: the same board with more pinned cards and small decorations.",
        3: "Level 3: a decorated glowing quest board, no readable text anywhere.",
    },
    "trophy_cupboard": {
        1: "Level 1: a small trophy cupboard with one golden plate trophy.",
        2: "Level 2: the same cupboard with more shelves and food keepsakes.",
        3: "Level 3: a full glowing milestone cupboard with tiny plate trophies, clean silhouette.",
    },
}


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    with (ROOT / ".env.local").open(encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env[key] = value
    url = env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing EXPO_PUBLIC_SUPABASE_URL / key in .env.local")
    return url, key


SUPABASE_URL, SUPABASE_KEY = load_env()


def call_function(name: str, payload: dict[str, Any], timeout: int = 300) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"{name} HTTP {exc.code}: {body[:900]}") from None


def image_b64(path: Path, max_side: int = 1024, flatten: bool = False) -> tuple[str, str]:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    if flatten:
        bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
        bg.alpha_composite(image)
        image = bg
    output = BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii"), "image/png"


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def invoke_generation(
    *,
    output_name: str,
    prompt: str,
    reference: Path,
    guide: Path | None = None,
    transparent: bool = False,
    image_size: int = 1536,
    model: str = "gpt",
) -> str:
    ref_b64, ref_mime = image_b64(reference, max_side=1024, flatten=False)
    body: dict[str, Any] = {
        "prompt": prompt,
        "referenceBase64": ref_b64,
        "referenceMime": ref_mime,
        "mode": "single",
        "model": model,
        "outputName": output_name,
    }
    if model == "gpt":
        body["gptImageSize"] = image_size
        if transparent:
            body["transparentBackground"] = True
    else:
        body["resolution"] = "2K"
    if guide:
        guide_b64, guide_mime = image_b64(guide, max_side=1024, flatten=False)
        body["guideBase64"] = guide_b64
        body["guideMime"] = guide_mime

    data = call_function("generate-asset", body, timeout=300)
    if data.get("status") == "queued":
        request_id = str(data.get("requestId", ""))
        if not request_id:
            raise RuntimeError(f"{output_name}: queued without requestId")
        for attempt in range(90):
            time.sleep(8)
            poll = call_function(
                "generate-asset",
                {
                    "action": "poll",
                    "requestId": request_id,
                    "model": model,
                    "mode": "single",
                    "outputName": output_name,
                },
                timeout=300,
            )
            status = poll.get("status")
            print(f"  poll {output_name}: {status} ({attempt + 1}/90)")
            if status == "completed":
                data = poll
                break
        else:
            raise TimeoutError(f"{output_name}: generation did not complete")

    if data.get("error"):
        raise RuntimeError(f"{output_name}: {data['error']}")
    cells = data.get("cells")
    if isinstance(cells, list) and cells and isinstance(cells[0], dict) and isinstance(cells[0].get("url"), str):
        return str(cells[0]["url"])
    if isinstance(data.get("gridUrl"), str):
        return str(data["gridUrl"])
    if isinstance(data.get("imageUrl"), str):
        return str(data["imageUrl"])
    raise RuntimeError(f"{output_name}: generation returned no image URL: {data}")


def has_useful_alpha(path: Path) -> bool:
    image = Image.open(path).convert("RGBA")
    w, h = image.size
    corners = [image.getpixel(point)[3] for point in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
    return max(corners) < 12


def matte_if_needed(source: Path, output_name: str) -> Path:
    if has_useful_alpha(source):
        return source
    with source.open("rb") as handle:
        payload = {
            "imageBase64": base64.b64encode(handle.read()).decode("ascii"),
            "outputName": output_name,
            "model": "General Use (Heavy)",
            "operatingResolution": "2048x2048",
            "refineForeground": True,
        }
    data = call_function("remove-image-background", payload, timeout=300)
    if not isinstance(data.get("imageUrl"), str):
        raise RuntimeError(f"{output_name}: matting returned no URL: {data}")
    matted = TMP_DIR / f"{output_name}-matted.png"
    download(str(data["imageUrl"]), matted)
    return matted


def fit_prop(source: Path, output: Path, width: int, height: int) -> None:
    image = Image.open(source).convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    pad_x = max(8, round(image.width * 0.06))
    pad_y = max(8, round(image.height * 0.06))
    padded = Image.new("RGBA", (image.width + pad_x * 2, image.height + pad_y * 2), (0, 0, 0, 0))
    padded.alpha_composite(image, (pad_x, pad_y))
    padded.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(padded, ((width - padded.width) // 2, height - padded.height))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG")


def generate_base(layout: dict[str, Any], art: dict[str, Any], model: str) -> None:
    prompt = (
        "Use the first image as the exact room-layout and camera composition guide. "
        "Use the second image only as the art-style, lighting, rounded 3D material, palette, and polish reference. "
        f"{art['basePrompt']} "
        "The central board/sign area must be decorative only and completely blank, with no readable word. "
        "Keep the station sockets empty. Do not include any station props in the base image. "
        "Specifically remove/avoid feast tables, spice jars, cooking pots or wells, market maps, photo boards, "
        "dessert display cases, quest boards, trophy cupboards, loose food, serving dishes, pinned cards, "
        "and milestone shelves. The base should contain only architecture, floor, walls, windows, lighting, "
        "empty shelves, blank frames, blank counters, blank rugs, and clear placement pads for future props. "
        "Keep a square, scrollable, game-ready environment plate. "
        f"{art['stylePrompt']} {art['negativePrompt']} {NO_TEXT}"
    )
    print("generating Feastle base...")
    url = invoke_generation(
        output_name="feastle-hearth-base",
        prompt=prompt,
        reference=BASE_PATH,
        guide=STYLE_REF_PATH,
        transparent=False,
        image_size=int(layout["plate"]["width"]),
        model=model,
    )
    generated = TMP_DIR / "feastle_hearth_base_generated.png"
    download(url, generated)
    image = Image.open(generated).convert("RGB").resize(
        (int(layout["plate"]["width"]), int(layout["plate"]["height"])),
        Image.Resampling.LANCZOS,
    )
    image.save(BASE_PATH)
    print(f"wrote {BASE_PATH.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "generate-local-environment-guide.py"), ENV_ID], check=True)


def level_prompt(station: dict[str, Any], art_prompt: str, level: int) -> str:
    detail = LEVEL_DETAILS.get(station["id"], {}).get(level, f"Level {level}: richer version of the same prop.")
    anchor = station["anchor"]
    hitbox = station["hitbox"]
    return (
        "Use the first image as the Feastle Hearth style and lighting reference. "
        "Generate only the requested station prop as a standalone game asset, not a crop from the room. "
        f"Station id: {station['id']}. Anchor point: x {anchor['x']}, y {anchor['y']}. "
        f"Target slot rectangle: x {hitbox['x']}, y {hitbox['y']}, width {hitbox['w']}, height {hitbox['h']}. "
        f"{art_prompt} {detail} "
        "Output one single isolated prop only, transparent background, same isometric three-quarter top-down camera, "
        "same warm lighting as the room, crisp readable mobile-game silhouette, generous padding, no floor patch, "
        f"no colored backing rectangle, no guide overlay colors, no wall rectangle, no extra station props, no creature, no humans. {NO_TEXT}"
    )


def generate_prop(station: dict[str, Any], art_prompt: str, level: int, model: str) -> None:
    asset_key = station["art"]["levels"][level - 1]
    output = PROPS_DIR / f"{asset_key}.png"
    raw = TMP_DIR / f"{asset_key}.png"
    print(f"generating {asset_key}...")
    url = invoke_generation(
        output_name=asset_key.replace("_", "-"),
        prompt=level_prompt(station, art_prompt, level),
        reference=BASE_PATH,
        guide=None,
        transparent=model == "gpt",
        image_size=1024,
        model=model,
    )
    download(url, raw)
    source = matte_if_needed(raw, asset_key.replace("_", "-"))
    fit_prop(source, output, int(station["art"]["width"]), int(station["art"]["height"]))
    print(f"wrote {output.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-base", action="store_true")
    parser.add_argument("--only-base", action="store_true")
    parser.add_argument("--station", help="Generate only one station id.")
    parser.add_argument("--level", type=int, choices=[1, 2, 3], help="Generate only one level.")
    parser.add_argument("--model", choices=["gpt", "nano"], default="gpt")
    args = parser.parse_args()

    layout = json.loads(LAYOUT_PATH.read_text(encoding="utf-8"))
    art = json.loads(ART_PATH.read_text(encoding="utf-8"))
    art_by_station = {item["stationId"]: item["prompt"] for item in art["props"]}
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    PROPS_DIR.mkdir(parents=True, exist_ok=True)

    if not args.skip_base:
        generate_base(layout, art, args.model)
    if args.only_base:
        return

    for station in layout["stations"]:
        if args.station and station["id"] != args.station:
            continue
        levels = [args.level] if args.level else [1, 2, 3]
        for level in levels:
            generate_prop(station, art_by_station[station["id"]], level, args.model)


if __name__ == "__main__":
    main()
