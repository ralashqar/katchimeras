#!/usr/bin/env python3
"""Generate and slice Feastle Merge Feast's fixed 4x4 food sprite sheet.

Uses the app's deployed `generate-asset` edge function so image-model secrets remain
server-side. The exact cell order is shared with constants/feastle-merge-art.ts.

  python scripts/generate-feastle-merge-art.py --generate
  python scripts/generate-feastle-merge-art.py --slice path/to/approved-grid.png
  python scripts/generate-feastle-merge-art.py --placeholder  # offline development only
"""

from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "katchimeras" / "quests" / "feastle-merge"
REFERENCE = ROOT / "assets" / "images" / "katchimeras" / "environments" / "feastle_hearth" / "base.png"
RAW_GRID = OUT / "feastle-merge-grid-source.png"

CELLS = [
    "wheat", "flour", "dough", "noodles",
    "pasta", "carrot", "vegetables", "broth",
    "soup-pot", "stew", "berries", "compote",
    "tartlet", "berry-tart", "cake", "pantry",
]

# The generated final-row artwork can visually overhang its nominal cell (the
# cake crown does in the approved sheet). Move that horizontal UV split upward
# by 1/8 cell so row-three sprites do not inherit the overhang and row four
# retains the complete artwork. Values correspond to the three internal row
# boundaries and scale with source resolution.
ROW_SPLIT_OFFSETS = (0.0, 0.0, -0.125)

PROMPT = """Create one production game-asset sprite sheet: an exact 4 by 4 grid of sixteen equal square cells in reading order. Each cell contains exactly one centered, isolated food object with generous padding. Cell order: wheat sheaf; flour sack; dough ball; fresh noodles; tomato pasta bowl; carrot; chopped vegetables; broth bowl; soup pot; finished hearty stew; berry basket; berry compote jar; tartlet; berry tart; celebration layer cake; cozy pantry basket. Premium stylized 3D collectible mobile-game art matching the supplied Feastle Hearth reference: rounded readable silhouettes, warm cream/caramel/ember palette, tactile ceramic and painted wood, soft upper-left light, subtle ambient occlusion, polished Merge Mansion / Royal Match level of finish. Adjacent progression stages must remain visibly distinct at 58px. Perfectly flat uniform vivid #00FF00 chroma-key background across the entire image. No shadows on the background, no floor, no scene, no characters, no extra objects, no text, no letters, no numbers, no labels, no watermark, and no visible grid lines. Nothing may cross a cell boundary."""


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    with (ROOT / ".env.local").open(encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                values[key] = value
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("Missing Supabase public URL/key in .env.local")
    return url, key


def call(name: str, payload: dict[str, Any], timeout: int = 300) -> dict[str, Any]:
    url, key = load_env()
    request = urllib.request.Request(
        f"{url}/functions/v1/{name}", data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{name} HTTP {error.code}: {error.read().decode(errors='replace')[:900]}") from None


def reference_payload() -> tuple[str, str]:
    image = Image.open(REFERENCE).convert("RGB")
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, "JPEG", quality=88)
    return base64.b64encode(buffer.getvalue()).decode(), "image/jpeg"


def generate() -> Path:
    ref, mime = reference_payload()
    payload = {
        "prompt": PROMPT, "referenceBase64": ref, "referenceMime": mime,
        "mode": "single", "model": "gpt", "outputName": "feastle-merge-grid",
        "gptImageSize": 2048,
    }
    data = call("generate-asset", payload)
    if data.get("status") == "queued":
        request_id = data.get("requestId")
        for attempt in range(90):
            time.sleep(8)
            data = call("generate-asset", {"action": "poll", "requestId": request_id, "model": "gpt", "mode": "single", "outputName": "feastle-merge-grid"})
            print(f"poll {attempt + 1}/90: {data.get('status')}")
            if data.get("status") == "completed":
                break
    cells = data.get("cells")
    image_url = cells[0].get("url") if isinstance(cells, list) and cells else data.get("gridUrl") or data.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"Generation returned no image URL: {data}")
    OUT.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(str(image_url), RAW_GRID)
    return RAW_GRID


def chroma_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.getdata():
        dominance = green - max(red, blue)
        alpha = 0 if green > 145 and dominance > 45 else 255 if dominance < 10 else int(255 * (45 - dominance) / 35)
        if alpha < 255:
            green = min(green, max(red, blue))
        pixels.append((red, green, blue, max(0, min(255, alpha))))
    rgba.putdata(pixels)
    return rgba


def slice_grid(path: Path) -> None:
    source = Image.open(path).convert("RGBA")
    side = min(source.size)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    source = source.crop((left, top, left + side, top + side))
    cell = side // 4
    row_edges = [0]
    row_edges.extend(
        round(boundary * cell + ROW_SPLIT_OFFSETS[boundary - 1] * cell)
        for boundary in range(1, 4)
    )
    row_edges.append(side)
    if row_edges != sorted(row_edges) or len(set(row_edges)) != len(row_edges):
        raise RuntimeError(f"Invalid vertical sprite boundaries: {row_edges}")
    OUT.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(CELLS):
        row, col = divmod(index, 4)
        sprite = chroma_alpha(source.crop((col * cell, row_edges[row], (col + 1) * cell, row_edges[row + 1])))
        bbox = sprite.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"Cell {name} is empty after chroma removal")
        sprite = sprite.crop(bbox)
        sprite.thumbnail((220, 220), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256))
        canvas.alpha_composite(sprite, ((256 - sprite.width) // 2, (256 - sprite.height) // 2))
        corners = [canvas.getpixel(point)[3] for point in ((0, 0), (255, 0), (0, 255), (255, 255))]
        coverage = sum(1 for alpha in canvas.getchannel("A").getdata() if alpha > 24) / (256 * 256)
        if max(corners) > 8 or not 0.05 <= coverage <= 0.78:
            raise RuntimeError(f"Cell {name} failed alpha/coverage QA: corners={corners}, coverage={coverage:.3f}")
        canvas.save(OUT / f"{name}.png", optimize=True)
        canvas.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
    print(f"Wrote {len(CELLS)} PNG/WebP sprites to {OUT}")


def placeholders() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    colors = [(232, 183, 106), (217, 135, 99), (217, 155, 145)]
    for index, name in enumerate(CELLS):
        image = Image.new("RGBA", (256, 256))
        draw = ImageDraw.Draw(image)
        color = colors[min(index // 5, 2)] if index < 15 else (232, 183, 106)
        tier = index % 5 + 1
        radius = 45 + tier * 8 if index < 15 else 76
        draw.ellipse((128 - radius, 128 - radius, 128 + radius, 128 + radius), fill=(*color, 40), outline=(*color, 150), width=5)
        draw.rounded_rectangle((91, 93, 165, 163), radius=18, fill=(*color, 205))
        draw.ellipse((105, 105, 151, 151), fill=(255, 241, 213, 225))
        image.save(OUT / f"{name}.png", optimize=True)
        image.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"Wrote offline placeholders to {OUT}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--slice", type=Path)
    parser.add_argument("--placeholder", action="store_true")
    args = parser.parse_args()
    if args.placeholder:
        placeholders()
    path = generate() if args.generate else args.slice
    if path:
        slice_grid(path)
    if not args.placeholder and not path:
        parser.error("choose --generate, --slice PATH, or --placeholder")


if __name__ == "__main__":
    main()
