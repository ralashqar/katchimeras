#!/usr/bin/env python3
"""Generate or slice the manual-journal journey icon candidate sheet.

The production sheet is a fixed 4x4 grid containing two candidates for each
of the eight top-level journal journeys. Generation reuses the deployed
``generate-asset`` edge function; approved local or generated sheets can be
processed deterministically with ``--slice``.

  python scripts/generate-manual-journal-icons.py --generate
  python scripts/generate-manual-journal-icons.py --slice path/to/grid.png
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import base64
import json
import math
import time
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = game_root()
OUT = content_path(ROOT, "assets") / "images" / "katchimeras" / "manual-journal"
REFERENCE = content_path(ROOT, "assets") / "images" / "katchimeras" / "today-icons" / "_grid.png"
RAW_GRID = content_path(ROOT, ".tmp") / "manual-journal-art" / "manual-journal-grid-source.png"

# Two candidates appear consecutively for every journey. These approved cells
# intentionally choose the clearest silhouette from the generated pair.
APPROVED_CELLS = {
    "people": 1,
    "food": 2,
    "went_somewhere": 4,
    "movement": 6,
    "studio": 8,
    "work": 10,
    "big_event": 12,
    "general": 15,
}

PROMPT = """Create an exact 4 by 4 production sprite sheet with sixteen equal square cells. Each of eight cozy manual-journal journeys has two candidate icons in consecutive cells, in reading order: people and time A/B; food and drink A/B; places and days out A/B; movement A/B; watched, read or listened A/B; work, learn or create A/B; big milestone A/B; something else or general memory A/B. Match the supplied Today icon reference: polished friendly 3D mobile-game objects, rounded tactile forms, warm golden-hour highlights, consistent three-quarter camera, readable silhouette at 48px. Use two abstract friendly figures; cozy cup or nourishing bowl; wooden signpost or map pin; playful trainer; open book or headphones; leather satchel or art tools; trophy or celebration star; keepsake box or glowing memory jar. Perfectly flat uniform vivid #FF00FF chroma-key background. One centered object per cell with generous equal padding. No shadows on the background, no floor, no text, no letters, no numbers, no watermark, and nothing crossing a cell boundary."""


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    with (content_path(ROOT, ".env.local")).open(encoding="utf-8") as handle:
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
    reference, mime = reference_payload()
    data = call("generate-asset", {
        "prompt": PROMPT,
        "referenceBase64": reference,
        "referenceMime": mime,
        "mode": "4x4",
        "model": "gpt",
        "outputName": "manual-journal-icons",
        "gptImageSize": 2048,
    })
    if data.get("status") == "queued":
        request_id = data.get("requestId")
        for attempt in range(90):
            time.sleep(8)
            data = call("generate-asset", {
                "action": "poll", "requestId": request_id, "model": "gpt",
                "mode": "4x4", "outputName": "manual-journal-icons", "rawResult": True,
            })
            print(f"poll {attempt + 1}/90: {data.get('status')}")
            if data.get("status") == "completed":
                break
    image_url = data.get("imageUrl") or data.get("gridUrl")
    if not image_url:
        raise RuntimeError(f"Generation returned no image URL: {data}")
    RAW_GRID.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(str(image_url), RAW_GRID)
    return RAW_GRID


def chroma_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.getdata():
        # The generated key is close to #ff00f0. Color distance avoids
        # stripping legitimate purple, red, or gold pixels from the artwork.
        distance = math.sqrt((red - 255) ** 2 + green ** 2 + (blue - 240) ** 2)
        alpha = 0 if distance <= 28 else 255 if distance >= 105 else round(255 * (distance - 28) / 77)
        key_dominance = min(red, blue) - green
        if min(red, blue) > 160 and key_dominance > 85:
            dominance_alpha = 0 if key_dominance >= 170 else round(255 * (170 - key_dominance) / 85)
            alpha = min(alpha, dominance_alpha)
        if alpha < 255:
            # Suppress only the remaining key-colored fringe. The correction
            # fades to zero before fully opaque subject pixels.
            fringe = (1 - alpha / 255) * max(0, min(red, blue) - green)
            red = max(0, round(red - fringe * 0.72))
            blue = max(0, round(blue - fringe * 0.72))
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
    if cell < 128:
        raise RuntimeError(f"Candidate grid is too small: {source.size}")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, index in APPROVED_CELLS.items():
        row, col = divmod(index, 4)
        # Generated sheets often include a 6-10px white/key divider. A 4%
        # inset removes that divider without touching the padded subjects.
        inset = max(4, round(cell * 0.04))
        crop = source.crop((col * cell + inset, row * cell + inset, (col + 1) * cell - inset, (row + 1) * cell - inset))
        sprite = chroma_alpha(crop)
        bbox = sprite.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"Cell {name} is empty after chroma removal")
        sprite = sprite.crop(bbox)
        sprite.thumbnail((224, 224), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (256, 256))
        canvas.alpha_composite(sprite, ((256 - sprite.width) // 2, (256 - sprite.height) // 2))
        corners = [canvas.getpixel(point)[3] for point in ((0, 0), (255, 0), (0, 255), (255, 255))]
        coverage = sum(1 for alpha in canvas.getchannel("A").getdata() if alpha > 24) / (256 * 256)
        if max(corners) > 8 or not 0.06 <= coverage <= 0.72:
            raise RuntimeError(f"Cell {name} failed alpha/coverage QA: corners={corners}, coverage={coverage:.3f}")
        canvas.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        print(f"  {name}: cell {index + 1}, coverage {coverage:.3f}")
    print(f"Wrote {len(APPROVED_CELLS)} optimized WebP icons to {OUT}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--slice", type=Path)
    args = parser.parse_args()
    path = generate() if args.generate else args.slice
    if not path:
        parser.error("choose --generate or --slice PATH")
    slice_grid(path)


if __name__ == "__main__":
    main()
