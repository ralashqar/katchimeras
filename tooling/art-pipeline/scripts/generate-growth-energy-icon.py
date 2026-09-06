#!/usr/bin/env python3
"""Generate the readable Today Energy token with FAL and BiRefNet Heavy."""
from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import base64
import io
import json
from pathlib import Path
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = game_root()
REFERENCE = content_path(ROOT, "assets/images/katchimeras/world/backgrounds/home/home-exploration-v1.png")
OUTPUT = content_path(ROOT, "assets/images/katchimeras/today-icons")
WORK = content_path(ROOT, "tmp/today-growth-energy-v2")
GENERATION_MODEL = "fal-ai/nano-banana-2/edit"
MATTE_MODEL = "BiRefNet_lite"

PROMPT = """
Use Image 1 only as the art-style reference: the actual Katchimeras Today environment's
deliberately simple cozy toy-diorama 3D style, broad rounded forms, clean color blocks,
smooth soft material, and bold mobile-game readability. Create ONE Growth Energy currency
token centered and very large: a SOLID chunky rounded warm-gold coin shaped like a soft
hexagonal pebble, with its entire silhouette filled by opaque gold and ONE large cream
four-point sparkle raised on its front face. It is a solid coin, never a ring. Use at
most three broad colors, a single soft highlight, a thick soft bevel, and no tiny detail.
It must remain unmistakable and readable at 20 pixels. It is a currency token, NOT an egg.
Isolate it on a perfectly flat uniform pure-black background for background removal.
No ring, opening, cutout, hole, egg, shell speckles, cracks, facets, crystal texture, moss, vines, leaves, flowers,
particles, aura, scenery, floor, platform, cast shadow, text, letters, numbers, border,
watermark, UI, or any second object.
""".strip()


def env() -> tuple[str, str]:
    values: dict[str, str] = {}
    for line in (content_path(ROOT, ".env.local")).read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing Supabase public configuration in .env.local")
    return url, key


def call(name: str, payload: dict) -> dict:
    url, key = env()
    request = urllib.request.Request(
        f"{url}/functions/v1/{name}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=360) as response:
        return json.load(response)


def reference_data_uri() -> str:
    image = Image.open(REFERENCE).convert("RGB")
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, destination)


def restore_enclosed_foreground(raw: Image.Image, matted: Image.Image) -> tuple[Image.Image, int]:
    """Restore only matte holes that cannot reach the canvas exterior.

    BiRefNet remains authoritative for the outer silhouette and antialiased
    edge. Dark inset colors sometimes get classified as background; because
    this token is specified as solid, transparent components fully enclosed
    by the detected outer silhouette are false holes. Their original RGBA is
    copied from the untouched FAL render.
    """
    raw = raw.convert("RGBA")
    matted = matted.convert("RGBA")
    if raw.size != matted.size:
        raise RuntimeError(f"Raw and matte sizes differ: {raw.size} != {matted.size}")

    alpha = matted.getchannel("A")
    subject = alpha.point(lambda value: 255 if value >= 16 else 0)
    transparent = ImageOps.invert(subject)
    exterior = transparent.copy()
    # The source render has generous black padding, so the corner is always
    # exterior. Mark only its connected transparent component as reachable.
    ImageDraw.floodfill(exterior, (0, 0), 128, thresh=0)
    enclosed = exterior.point(lambda value: 255 if value == 255 else 0)
    # Include the narrow partially erased fringe BiRefNet leaves around a
    # false hole. This expansion remains internal to the coin and removes the
    # visible cut seam without touching the actual exterior matte boundary.
    enclosed = enclosed.filter(ImageFilter.MaxFilter(17))
    restored_pixels = enclosed.histogram()[255]
    if restored_pixels:
        matted.paste(raw, (0, 0), enclosed)
    return matted, restored_pixels


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repair-only",
        action="store_true",
        help="Reuse the cached FAL source and BiRefNet matte; only rebuild repaired runtime assets.",
    )
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    raw = WORK / "growth-energy-v2-fal.png"
    matted = WORK / "growth-energy-v2-birefnet.png"
    existing_manifest_path = OUTPUT / "growth-energy-v2.art.json"
    existing_manifest = json.loads(existing_manifest_path.read_text(encoding="utf-8")) if existing_manifest_path.exists() else {}

    if args.repair_only:
        if not raw.exists() or not matted.exists():
            raise RuntimeError("--repair-only requires cached FAL and BiRefNet images in tmp/today-growth-energy-v2")
        record = {"id": existing_manifest.get("generationRecordId")}
        source_url = existing_manifest.get("sourceUrl", "cached-local")
    else:
        generation = call("generate-katchimera-art", {
            "modelId": GENERATION_MODEL,
            "input": {"image_urls": [reference_data_uri()], "aspect_ratio": "1:1", "resolution": "2K"},
            "renderProfile": {
                "id": "today_growth_energy_v2",
                "displayName": "Today Growth Energy v2",
                "topLevelType": "concept",
                "triggerCategory": "asset",
                "triggerSubtype": "today_growth_energy",
                "theme": "asset",
                "creatureKind": "asset",
                "caption": "Growth Energy currency",
                "imagePrompt": PROMPT + " Absolutely no typography or UI.",
            },
        })
        record = generation.get("record", {})
        source_url = record.get("image_url")
        if not source_url:
            raise RuntimeError(f"FAL generation failed: {generation}")
        download(source_url, raw)

        matte = call("remove-image-background", {
            "imageUrl": source_url,
            "outputName": "today-growth-energy-v2",
            "model": MATTE_MODEL,
            "operatingResolution": "1024x1024",
            "refineForeground": True,
        })
        matte_url = matte.get("imageUrl")
        if not matte_url:
            raise RuntimeError(f"BiRefNet failed: {matte}")
        download(matte_url, matted)

    repaired, restored_pixels = restore_enclosed_foreground(Image.open(raw), Image.open(matted))
    repaired.save(WORK / "growth-energy-v2-repaired.png", optimize=True)
    cutout = repaired
    bounds = cutout.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("BiRefNet returned an empty matte")
    cutout = cutout.crop(bounds)
    cutout.thumbnail((430, 430), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(cutout, ((512 - cutout.width) // 2, (512 - cutout.height) // 2))
    png = OUTPUT / "growth-energy-v2.png"
    webp = OUTPUT / "growth-energy-v2.webp"
    canvas.save(png, optimize=True)
    canvas.save(webp, format="WEBP", lossless=True, method=6)

    manifest = {
        "schemaVersion": 1,
        "generationModel": GENERATION_MODEL,
        "generationRecordId": record.get("id"),
        "sourceUrl": source_url,
        "styleReference": str(logical_path(ROOT, REFERENCE)).replace("\\", "/"),
        "prompt": PROMPT,
        "matteModel": "fal-ai/birefnet/v2 General Use (Heavy)",
        "repositoryMatteEnum": MATTE_MODEL,
        "matteSettings": {"operatingResolution": "1024x1024", "refineForeground": True},
        "matteRepair": {
            "method": "restore-border-disconnected-transparent-components-from-fal-source",
            "alphaSubjectThreshold": 16,
            "interiorFringeRestoreRadius": 8,
            "restoredPixels": restored_pixels,
            "preservesBiRefNetExteriorEdge": True,
        },
        "outputs": {"master": png.name, "runtime": webp.name},
        "alphaBounds": list(canvas.getchannel("A").getbbox() or ()),
    }
    (OUTPUT / "growth-energy-v2.art.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
