#!/usr/bin/env python3
"""Generate Today growth eggs through FAL and matte them with BiRefNet Heavy.

The seven normal frames remain intact and grow monotonically. Crack frames are
edited from the final normal frame and are used only by the hatch presentation.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets/images/katchimeras/cutouts/growth-v2"
WORK = ROOT / "tmp/today-growth-v2-fal"
ENVIRONMENT_REF = ROOT / "assets/images/katchimeras/world/backgrounds/home/home-exploration-v1.png"
BARISTABBIT_REF = ROOT / "assets/images/katchimeras/evolution-grids/baristabbit-three-stage-medium-v3/cells/stage-03-adult.png"
GENERATION_MODEL = "fal-ai/nano-banana-2/edit"
MATTE_MODEL = "BiRefNet_lite"
TARGET_HEIGHTS = [260, 320, 380, 440, 500, 560, 620]
CANVAS_SIZE = 768
BASELINE = 724

STYLE = (
    "Match Image 1, the actual in-game Today environment: deliberately simplified low-detail "
    "toy-diorama 3D, large rounded shapes, bold clean color blocks, smooth materials, minimal "
    "surface texture, bright friendly daylight, and simple mobile-game highlights. Image 2 is "
    "only a secondary reference for polished cute 3D finish. Do not copy scene objects or add a face. "
)
BACKDROP = (
    "The object is isolated on one perfectly flat uniform pure-black background for BiRefNet Heavy. "
    "No gradient, scenery, floor, cast shadow, platform, pedestal, soil, pot, basket, nest, moss bed, "
    "twigs, text, border, watermark, UI, or other object. "
)

STAGE_REQUESTS = [
    "A very young tiny cream Katchimeras egg growing like a plant, intact, with two plump green seed leaves at its base and one tiny curled shoot on top. Sparse simple warm-gold oval markings.",
    "The exact same intact egg identity, visibly taller and fuller. Keep the two base leaves; the top curl unfurls into one short shoot with a rounded leaf. Keep markings sparse.",
    "The exact same intact egg, clearly larger again. The top shoot has two rounded leaves. One clean bright-green vine wraps only the lowest quarter of the shell with three chunky leaves.",
    "The exact same intact egg, larger and fuller again. Extend the vine in one loose turn around the lower third with five chunky rounded leaves. Keep the egg dominant.",
    "The exact same intact egg, larger and rounder again. The vine curls diagonally across the lower half with seven chunky leaves; a second short vine rises from the opposite base and ends in one closed bud.",
    "The exact same completely intact near-adult egg, taller and fuller. Two loose bright-green vines curl around the lower two-thirds with ten chunky leaves and two small closed white buds. Leave broad clean shell areas visible.",
    "The exact same completely intact fully grown egg at its largest mature size. Open the two buds into small simple five-petal white flowers with round yellow centers and add one tiny closed bud by the top sprout. Healthy warm sheen only; no magical aura.",
]

NORMAL_CONSTRAINTS = (
    "The shell is completely intact: absolutely no crack, fracture, hole, missing piece, internal "
    "light, glow aura, or particles. The egg grows like a plant but remains unmistakably an egg. "
    "No photoreal detail and no legacy illustration style."
)


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    with (ROOT / ".env.local").open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                values[key] = value
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing EXPO_PUBLIC_SUPABASE_URL / publishable key in .env.local")
    return url, key


SUPABASE_URL, SUPABASE_KEY = load_env()


def call(function_name: str, payload: dict, timeout: int = 360) -> dict:
    request = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/{function_name}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{function_name} HTTP {exc.code}: {exc.read().decode(errors='replace')[:800]}") from None


def data_uri(path: Path, max_side: int = 768) -> str:
    from PIL import Image

    image = Image.open(path).convert("RGB")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def generate(asset_id: str, prompt: str, references: list[str]) -> tuple[str, dict]:
    payload = {
        "modelId": GENERATION_MODEL,
        "input": {"image_urls": references, "aspect_ratio": "1:1", "resolution": "2K"},
        "renderProfile": {
            "id": asset_id,
            "displayName": asset_id,
            "topLevelType": "concept",
            "triggerCategory": "asset",
            "triggerSubtype": "today_growth_egg",
            "theme": "asset",
            "creatureKind": "asset",
            "caption": "Today growth egg",
            "imagePrompt": prompt + " Absolutely no text, numbers, letters, typography, or UI.",
        },
    }
    record = call("generate-katchimera-art", payload).get("record", {})
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"Generation failed for {asset_id}: {record}")
    return image_url, record


def matte(image_url: str, output_name: str) -> str:
    result = call("remove-image-background", {
        "imageUrl": image_url,
        "outputName": output_name,
        "model": MATTE_MODEL,
        "operatingResolution": "1024x1024",
        "refineForeground": True,
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"BiRefNet failed for {output_name}: {result}")
    return image_url


def matte_file(image_path: Path, output_name: str) -> str:
    with image_path.open('rb') as handle:
        image_base64 = base64.b64encode(handle.read()).decode()
    result = call("remove-image-background", {
        "imageBase64": image_base64,
        "outputName": output_name,
        "model": MATTE_MODEL,
        "operatingResolution": "1024x1024",
        "refineForeground": True,
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"BiRefNet failed for {output_name}: {result}")
    return image_url


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, destination)


def package(source: Path, destination: Path, target_height: int) -> dict:
    from PIL import Image

    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError(f"BiRefNet returned an empty matte: {source}")
    cutout = image.crop(bbox)
    scale = target_height / cutout.height
    target_width = max(1, round(cutout.width * scale))
    if target_width > 720:
        scale = 720 / cutout.width
        target_width = 720
        target_height = round(cutout.height * scale)
    cutout = cutout.resize((target_width, target_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    position = ((CANVAS_SIZE - target_width) // 2, BASELINE - target_height)
    canvas.alpha_composite(cutout, position)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)
    corners = [canvas.getpixel(point)[3] for point in [(2, 2), (765, 2), (2, 765), (765, 765)]]
    if any(corners):
        raise RuntimeError(f"Non-transparent packaged corners for {destination}: {corners}")
    return {"alphaBounds": list(canvas.getchannel("A").getbbox() or ()), "visibleHeight": target_height, "visibleWidth": target_width}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    environment = data_uri(ENVIRONMENT_REF)
    baristabbit = data_uri(BARISTABBIT_REF)
    manifest: dict = {
        "schemaVersion": 1,
        "generationModel": GENERATION_MODEL,
        "matteModel": "fal-ai/birefnet/v2 General Use (Heavy)",
        "repositoryMatteEnum": MATTE_MODEL,
        "matteSettings": {"operatingResolution": "1024x1024", "refineForeground": True},
        "styleReferences": [str(ENVIRONMENT_REF.relative_to(ROOT)), str(BARISTABBIT_REF.relative_to(ROOT))],
        "canvas": {"width": CANVAS_SIZE, "height": CANVAS_SIZE, "baseline": BASELINE},
        "assets": [],
    }
    previous_raw: Path | None = None
    generated_urls: list[str] = []
    for index, request in enumerate(STAGE_REQUESTS):
        raw = WORK / f"egg-growth-{index}-raw.png"
        matted = WORK / f"egg-growth-{index}-birefnet.png"
        final = OUTPUT / f"egg-growth-{index}.png"
        prompt = f"{STYLE} {request} {BACKDROP} {NORMAL_CONSTRAINTS}"
        if args.force or not raw.exists():
            refs = [environment, baristabbit]
            if previous_raw:
                refs.append(data_uri(previous_raw))
                prompt += " Image 3 is the immediately previous stage: preserve its exact egg identity, camera, lighting, markings, and baseline while applying only this next growth step."
            print(f"Generating normal stage {index} with {GENERATION_MODEL}...", flush=True)
            image_url, record = generate(f"today_growth_egg_v2_stage_{index}", prompt, refs)
            download(image_url, raw)
        else:
            image_url = "cached-local"
            record = {}
        print(f"Matting normal stage {index} with BiRefNet Heavy...", flush=True)
        matte_url = matte(image_url, f"today-growth-egg-v2-stage-{index}") if image_url != "cached-local" else matte_file(raw, f"today-growth-egg-v2-stage-{index}")
        download(matte_url, matted)
        geometry = package(matted, final, TARGET_HEIGHTS[index])
        manifest["assets"].append({"kind": "growth", "stage": index, "file": final.name, "prompt": prompt, "generationRecordId": record.get("id"), **geometry})
        generated_urls.append(image_url)
        previous_raw = raw

    final_raw = WORK / "egg-growth-6-raw.png"
    crack_prompts = [
        "Preserve Image 3 exactly. Add only one small readable hairline Y-shaped crack near the upper-middle shell with restrained warm-gold light in the line. Shell remains closed.",
        "Preserve Image 3 exactly. Extend its existing crack into five clean branching hairline cracks across the upper half with warm-gold light. Shell remains closed and one beat from opening.",
    ]
    previous_crack_raw: Path | None = None
    for crack_index, request in enumerate(crack_prompts, start=1):
        raw = WORK / f"egg-hatch-crack-{crack_index}-raw.png"
        matted = WORK / f"egg-hatch-crack-{crack_index}-birefnet.png"
        final = OUTPUT / f"egg-hatch-crack-{crack_index}.png"
        source = previous_crack_raw or final_raw
        prompt = (
            f"{STYLE} {request} {BACKDROP} This is a hatch-animation-only edit. Do not change size, "
            "shape, shell markings, sprout, vines, leaves, flowers, camera, lighting, or framing. "
            "No hole, missing piece, creature, particles, aura, nest, platform, scenery, text, or watermark."
        )
        print(f"Generating hatch crack {crack_index} with {GENERATION_MODEL}...", flush=True)
        image_url, record = generate(
            f"today_growth_egg_v2_hatch_crack_{crack_index}",
            prompt,
            [environment, baristabbit, data_uri(source)],
        )
        download(image_url, raw)
        print(f"Matting hatch crack {crack_index} with BiRefNet Heavy...", flush=True)
        matte_url = matte(image_url, f"today-growth-egg-v2-hatch-crack-{crack_index}")
        download(matte_url, matted)
        geometry = package(matted, final, TARGET_HEIGHTS[-1])
        manifest["assets"].append({"kind": "hatch", "phase": crack_index, "file": final.name, "prompt": prompt, "generationRecordId": record.get("id"), **geometry})
        previous_crack_raw = raw

    with (OUTPUT / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print(f"Saved production assets and manifest to {OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
