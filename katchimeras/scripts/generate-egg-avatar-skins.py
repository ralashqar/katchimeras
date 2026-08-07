#!/usr/bin/env python3
"""Generate, matte, approve, and validate Katchimera egg-avatar skins.

Production generation goes through the deployed Supabase functions so FAL_KEY and
the service-role key remain server-side. Review candidates live under the ignored
`.tmp/egg-avatar-skins` directory. Only `approve` writes production assets.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "assets" / "images" / "katchimeras" / "egg-avatars"
THUMB_DIR = OUTPUT_DIR / "thumbnails"
EFFECTS_DIR = OUTPUT_DIR / "effects"
BASES_DIR = OUTPUT_DIR / "bases"
BASE_THUMBS_DIR = BASES_DIR / "thumbnails"
FACES_DIR = OUTPUT_DIR / "faces"
FACE_THUMBS_DIR = FACES_DIR / "thumbnails"
REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-skins"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
CURRENT_EGG = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "egg-base.png"
BARISTABBIT = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "baristabbit.png"
CLASSIC_APPROVED = OUTPUT_DIR / "classic.png"
CUTOUTS_DIR = ROOT / "assets" / "images" / "katchimeras" / "cutouts"
GENERATION_MODEL = "fal-ai/nano-banana-2/edit"
MATTING_MODEL = "fal-ai/birefnet/v2"
PIPELINE_VERSION = "egg-avatar-layers-v1"
DEFAULT_FACE_ID = "classic-smile"

FACE_VARIATIONS: dict[str, dict[str, str]] = {
    "classic-smile": {
        "name": "Classic Smile",
        "description": "Bright eyes, a tiny smile, and warm rosy cheeks.",
        "expression": "Friendly open-eyed smile with a tiny open mouth.",
    },
    "happy-squint": {
        "name": "Happy Squint",
        "description": "Closed happy eyes and a delighted little grin.",
        "expression": "Closed upward-curving happy eyes with an open delighted smile.",
    },
    "sleepy": {
        "name": "Sleepy",
        "description": "Restful closed eyes and a peaceful smile.",
        "expression": "Relaxed closed eyelids with a tiny content smile.",
    },
    "curious": {
        "name": "Curious",
        "description": "Wondering eyes and a tiny surprised mouth.",
        "expression": "Eyes looking upward with one raised brow and a tiny round mouth.",
    },
    "determined": {
        "name": "Determined",
        "description": "A cute, confident ready-to-try expression.",
        "expression": "Friendly focused eyes, confident brows, and a small closed smile.",
    },
}

FACE_LAYOUT = {
    "version": 1,
    "canvas": {"width": 2048, "height": 2048},
    "safeZone": {"shape": "roundedRectangle", "left": 0.22, "top": 0.34, "right": 0.78, "bottom": 0.66},
    "anchors": {
        "leftBrow": {"x": 0.39, "y": 0.405},
        "rightBrow": {"x": 0.61, "y": 0.405},
        "leftEye": {"x": 0.385, "y": 0.505},
        "rightEye": {"x": 0.615, "y": 0.505},
        "leftBlush": {"x": 0.31, "y": 0.565},
        "rightBlush": {"x": 0.69, "y": 0.565},
        "mouth": {"x": 0.5, "y": 0.57},
    },
}

# Feathered facial canvas where generated clean shell is allowed to replace the
# approved composite. Everything outside this region remains source-exact.
FACE_REMOVAL_BOUNDS = (0.20, 0.30, 0.80, 0.70)
FACE_LAYER_BOUNDS = (0.230, 0.365, 0.770, 0.625)

SKINS: dict[str, dict[str, str]] = {
    "classic": {
        "name": "Classic",
        "theme": (
            "Preserve the warm cream shell, aqua and tan speckles, complete happy face, rosy cheeks, "
            "and two small cream feet exactly. Add no accessory."
        ),
    },
    "moss": {
        "name": "Moss",
        "theme": (
            "Add clean rounded sage moss clusters around the lower shell and one small two-leaf sprout."
        ),
    },
    "tide": {
        "name": "Tide",
        "theme": (
            "Recolor the shell pastel sea-glass blue with rounded wave bands and a few pearl bubbles."
        ),
    },
    "sunset": {
        "name": "Sunset",
        "theme": (
            "Recolor the shell coral, peach, and warm gold with a sparse scattering of tiny gold stars."
        ),
    },
    "starglow": {
        "name": "Starglow",
        "theme": (
            "Recolor the shell velvety midnight-indigo with tiny warm constellations and one crescent."
        ),
    },
    "frost": {
        "name": "Frost",
        "theme": (
            "Recolor the shell powder blue with softly embossed snowflakes and pearl frost at the bottom."
        ),
    },
    "ember": {
        "name": "Ember",
        "theme": (
            "Recolor the shell warm charcoal-brown with a few smooth amber seams near the lower third."
        ),
    },
    "barista": {
        "name": "Barista",
        "theme": (
            "Keep the cream and caramel shell and add a small soft barista beret plus a tiny apron-pocket motif."
        ),
    },
    "robot": {
        "name": "Robot",
        "theme": (
            "Use a warm pearl-ivory ceramic-metal shell, sparse rounded panel seams outside the face-safe zone, "
            "small cyan circular energy ports on the outer upper sides, and softly brushed graphite-metal feet. "
            "Keep the face directly on a clean warm ivory panel; never replace it with a visor."
        ),
    },
    "pumpkin": {
        "name": "Pumpkin",
        "theme": (
            "Use a warm pumpkin-orange shell with soft vertical lobes outside the face-safe zone, one small curled "
            "brown stem, and restrained green leaves and vine curls around the crown and lower outer edges. "
            "Keep the central face panel smooth and make it cozy rather than spooky."
        ),
    },
}

STYLE_LOCK = (
    "Premium cute 3D cartoon mascot art matching Baristabbit: cozy handcrafted toy quality, broad rounded "
    "forms, tactile painted shell and soft materials, warm low-contrast cinematic key light, gentle peach "
    "bounce, and restrained eye gloss. Emotionally friendly and playful, never realistic or uncanny."
)

IDENTITY_LOCK = (
    "The subject is the exact upright front-facing egg character from image 1. Preserve its softly rounded "
    "silhouette, camera, scale, placement, two small feet, aqua and tan speckles, large friendly black-and-brown "
    "cartoon eyes with intact pupils and small catchlights, tiny curved eyebrows, rosy cheeks, happy open mouth, "
    "and warm expression. Do not move, resize, remove, or redesign any facial feature or foot. The egg must remain "
    "unmistakably the same character. Any accessory is singular, small, and does not obscure the face."
)

FACE_LAYOUT_LOCK = (
    "Treat the canonical central facial canvas as a protected rounded rectangle spanning normalized x 0.22 to 0.78 and "
    "y 0.34 to 0.66 on the final square canvas. Keep this zone smooth, low-detail, and uninterrupted. No seam, "
    "groove, ridge, pattern, emblem, accessory, hard shadow edge, specular hotspot, or material boundary may cross "
    "behind or touch the brows, eyes, blush, or mouth. Preserve generous clear space around each facial feature so "
    "the body remains compatible with future separately composited face layers."
)

NEGATIVES = (
    "No text, letters, numbers, logos, watermark, UI, frame, multiple characters, broken shell, photorealism, "
    "flat illustration, uncanny doll eyes, hollow pupils, missing mouth, missing feet, realistic animal anatomy, "
    "grime, mold, busy ornament, glossy plastic finish, or background objects."
)

GAMEPLAY_STAGES = {
    "crack-1": (
        "Edit only the shell state: add a few delicate, narrow hairline cracks across the ceramic with "
        "a restrained warm amber light visible inside them. Keep both eyes completely unchanged, clear, "
        "and unobstructed. Keep the egg whole, upright, and calm; no missing pieces and no large openings."
    ),
    "crack-2": (
        "Edit only the shell state into the final instant before hatching: create larger connected glowing "
        "cracks and two or three slightly lifted shell edges with bright warm light inside. Keep both eyes "
        "completely unchanged, visible, and unobstructed. Preserve the full outer egg silhouette and exact pose; "
        "do not reveal a creature and do not remove a large central section."
    ),
}


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    path = ROOT / ".env.local"
    if not path.exists():
        sys.exit("Missing .env.local")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing EXPO_PUBLIC_SUPABASE_URL / key in .env.local")
    return url, key


def call_function(name: str, payload: dict[str, Any], timeout: int = 360) -> dict[str, Any]:
    url, key = load_env()
    request = urllib.request.Request(
        f"{url}/functions/v1/{name}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            body = error.read().decode(errors="replace")
            if error.code in {429, 502, 503, 504} and attempt < 3:
                wait_seconds = attempt * 3
                print(f"{name} returned HTTP {error.code}; retrying in {wait_seconds}s...")
                time.sleep(wait_seconds)
                continue
            raise RuntimeError(f"{name} HTTP {error.code}: {body[:800]}") from None
    raise RuntimeError(f"{name} failed after retries")


def image_data_uri(path: Path, max_side: int = 768) -> str:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", image.size, (244, 238, 225))
    canvas.paste(image, (0, 0), image)
    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def prompt_for(skin_id: str) -> str:
    key_color = "#FF00FF" if skin_id in {"moss", "robot", "pumpkin"} else "#00FF00"
    return " ".join(
        [
            IDENTITY_LOCK,
            FACE_LAYOUT_LOCK,
            STYLE_LOCK,
            SKINS[skin_id]["theme"],
            f"Set the whole image on a perfectly flat, uniform solid {key_color} background for matting. ",
            "The background has no gradient, texture, floor, reflection, shadow, atmosphere, or lighting variation.",
            NEGATIVES,
        ]
    )


def candidate_dir(skin_id: str) -> Path:
    return REVIEW_DIR / skin_id


def generation_references(skin_id: str) -> list[Path]:
    if skin_id == "classic":
        return [CLASSIC_APPROVED if CLASSIC_APPROVED.exists() else CURRENT_EGG, BARISTABBIT]
    if not CLASSIC_APPROVED.exists():
        sys.exit("Approve Classic before generating themed skins.")
    return [CLASSIC_APPROVED, BARISTABBIT]


def generate(skin_id: str, count: int) -> None:
    review = candidate_dir(skin_id)
    raw_dir = review / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    prompt = prompt_for(skin_id)
    references = generation_references(skin_id)
    run: dict[str, Any] = {
        "schemaVersion": 1,
        "pipelineVersion": PIPELINE_VERSION,
        "skinId": skin_id,
        "prompt": prompt,
        "model": GENERATION_MODEL,
        "references": [{"path": str(path.relative_to(ROOT)).replace("\\", "/"), "role": "identity" if index == 0 else "style"} for index, path in enumerate(references)],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "candidates": [],
    }
    image_urls = [image_data_uri(path) for path in references]
    for index in range(1, count + 1):
        print(f"generating {skin_id} candidate {index}/{count}...")
        payload = {
            "modelId": GENERATION_MODEL,
            "input": {"image_urls": image_urls, "aspect_ratio": "1:1", "resolution": "2K"},
            "assetType": "other",
            "assetKey": f"egg-avatar:{skin_id}:candidate-{index}",
            "skinId": skin_id,
            "pipelineVersion": PIPELINE_VERSION,
            "renderProfile": {
                "id": f"egg_avatar_{skin_id}_{index}",
                "displayName": f"{SKINS[skin_id]['name']} egg avatar candidate {index}",
                "topLevelType": "avatar",
                "triggerCategory": "egg-avatar",
                "triggerSubtype": skin_id,
                "theme": skin_id,
                "creatureKind": "egg-avatar",
                "caption": "egg avatar skin candidate",
                "skinId": skin_id,
                "imagePrompt": prompt,
            },
        }
        result = call_function("generate-katchimera-art", payload)
        record = result.get("record") or {}
        image_url = record.get("image_url")
        if not image_url:
            raise RuntimeError(f"No image URL for {skin_id} candidate {index}: {result}")
        path = raw_dir / f"candidate-{index}.png"
        download(image_url, path)
        run["candidates"].append({"index": index, "recordId": record.get("id"), "imageUrl": image_url, "rawPath": str(path.relative_to(ROOT)).replace("\\", "/")})
    (review / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def matte(skin_id: str) -> None:
    review = candidate_dir(skin_id)
    run_path = review / "run.json"
    if not run_path.exists():
        sys.exit(f"No generation run for {skin_id}.")
    run = json.loads(run_path.read_text(encoding="utf-8"))
    matte_dir = review / "matted"
    matte_dir.mkdir(parents=True, exist_ok=True)
    for candidate in run["candidates"]:
        index = int(candidate["index"])
        print(f"matting {skin_id} candidate {index}...")
        result = call_function(
            "remove-image-background",
            {"imageUrl": candidate["imageUrl"], "outputName": f"egg-avatar-{skin_id}-{index}"},
        )
        image_url = result.get("imageUrl")
        if not image_url:
            raise RuntimeError(f"No matted image URL: {result}")
        path = matte_dir / f"candidate-{index}.png"
        download(image_url, path)
        candidate.update({
            "matteUrl": image_url,
            "mattePath": str(path.relative_to(ROOT)).replace("\\", "/"),
            "mattingModel": MATTING_MODEL,
            "mattingSettings": {"model": "General Use (Heavy)", "operatingResolution": "1024x1024", "refineForeground": True},
        })
    run_path.write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def gameplay_prompt(stage: str) -> str:
    return " ".join([
        "Image 1 is the exact approved Katchimera Classic egg avatar and must remain the same character.",
        IDENTITY_LOCK,
        STYLE_LOCK,
        GAMEPLAY_STAGES[stage],
        "Set the whole image on a perfectly flat uniform solid #00FF00 background with no ground or cast shadow.",
        NEGATIVES.replace("cracks suggesting a hatch, broken shell, ", ""),
    ])


def gameplay_generate(count: int) -> None:
    if not CLASSIC_APPROVED.exists():
        sys.exit("Approve Classic before generating gameplay states.")
    image_urls = [image_data_uri(CLASSIC_APPROVED)]
    for stage in GAMEPLAY_STAGES:
        review = REVIEW_DIR / "gameplay" / stage
        raw_dir = review / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)
        prompt = gameplay_prompt(stage)
        run: dict[str, Any] = {
            "schemaVersion": 1,
            "pipelineVersion": PIPELINE_VERSION,
            "stage": stage,
            "prompt": prompt,
            "model": GENERATION_MODEL,
            "references": [{"path": str(CLASSIC_APPROVED.relative_to(ROOT)).replace("\\", "/"), "role": "identity"}],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "candidates": [],
        }
        for index in range(1, count + 1):
            print(f"generating gameplay {stage} candidate {index}/{count}...")
            payload = {
                "modelId": GENERATION_MODEL,
                "input": {"image_urls": image_urls, "aspect_ratio": "1:1", "resolution": "2K"},
                "assetType": "other",
                "assetKey": f"egg-avatar:gameplay:{stage}:candidate-{index}",
                "skinId": "classic",
                "pipelineVersion": PIPELINE_VERSION,
                "renderProfile": {
                    "id": f"egg_avatar_gameplay_{stage.replace('-', '_')}_{index}",
                    "displayName": f"Classic egg avatar {stage} candidate {index}",
                    "topLevelType": "avatar",
                    "triggerCategory": "egg-avatar-gameplay",
                    "triggerSubtype": stage,
                    "theme": "classic",
                    "creatureKind": "egg-avatar",
                    "caption": "egg avatar gameplay state",
                    "skinId": "classic",
                    "imagePrompt": prompt,
                },
            }
            result = call_function("generate-katchimera-art", payload)
            record = result.get("record") or {}
            image_url = record.get("image_url")
            if not image_url:
                raise RuntimeError(f"No image URL for gameplay {stage} candidate {index}: {result}")
            path = raw_dir / f"candidate-{index}.png"
            download(image_url, path)
            run["candidates"].append({"index": index, "recordId": record.get("id"), "imageUrl": image_url, "rawPath": str(path.relative_to(ROOT)).replace("\\", "/")})
        (review / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def gameplay_matte() -> None:
    for stage in GAMEPLAY_STAGES:
        review = REVIEW_DIR / "gameplay" / stage
        run_path = review / "run.json"
        if not run_path.exists():
            sys.exit(f"No generation run for gameplay {stage}.")
        run = json.loads(run_path.read_text(encoding="utf-8"))
        matte_dir = review / "matted"
        matte_dir.mkdir(parents=True, exist_ok=True)
        for candidate in run["candidates"]:
            index = int(candidate["index"])
            print(f"matting gameplay {stage} candidate {index}...")
            result = call_function("remove-image-background", {"imageUrl": candidate["imageUrl"], "outputName": f"egg-avatar-gameplay-{stage}-{index}"})
            image_url = result.get("imageUrl")
            if not image_url:
                raise RuntimeError(f"No matted image URL: {result}")
            path = matte_dir / f"candidate-{index}.png"
            download(image_url, path)
            candidate.update({
                "matteUrl": image_url,
                "mattePath": str(path.relative_to(ROOT)).replace("\\", "/"),
                "mattingModel": MATTING_MODEL,
                "mattingSettings": {"model": "General Use (Heavy)", "operatingResolution": "1024x1024", "refineForeground": True},
            })
        run_path.write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def repair_enclosed_alpha_holes(image: Image.Image) -> Image.Image:
    """Restore dark foreground details that a background remover made transparent."""
    image = image.copy()
    alpha = image.getchannel("A")
    binary = alpha.point(lambda value: 255 if value > 8 else 0)
    padded = Image.new("L", (image.width + 2, image.height + 2), 0)
    padded.paste(binary, (1, 1))
    ImageDraw.floodfill(padded, (0, 0), 128)
    exterior = padded.crop((1, 1, image.width + 1, image.height + 1))
    repaired_alpha = Image.new("L", image.size)
    repaired_alpha.putdata([
        255 if region == 0 else original
        for original, region in zip(alpha.getdata(), exterior.getdata())
    ])
    image.putalpha(repaired_alpha)
    return image


def normalize(source: Path, rgb_source: Path | None = None) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    original_alpha = image.getchannel("A")
    image = repair_enclosed_alpha_holes(image)
    if rgb_source is not None:
        raw = Image.open(rgb_source).convert("RGBA")
        if raw.size != image.size:
            raw = raw.resize(image.size, Image.Resampling.LANCZOS)
        raw.putalpha(image.getchannel("A"))
        repaired_alpha = image.getchannel("A")
        # BiRefNet supplies the clean antialiased edge; the raw generation supplies
        # unmodified foreground colour, including dark eyes and bright crack gaps.
        foreground_interior = repaired_alpha.point(lambda value: 255 if value > 250 else 0)
        foreground_interior = foreground_interior.filter(ImageFilter.MinFilter(9))
        repaired_holes = Image.new("L", image.size)
        repaired_holes.putdata([
            255 if before <= 8 and after > 8 else 0
            for before, after in zip(original_alpha.getdata(), repaired_alpha.getdata())
        ])
        repaired_holes = repaired_holes.filter(ImageFilter.MaxFilter(11))
        raw_regions = ImageChops.lighter(foreground_interior, repaired_holes)
        image = Image.composite(raw, image, raw_regions)
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError(f"No visible subject in {source}")
    subject = image.crop(bbox)
    target_width, target_height = 1500, 1740
    scale = min(target_width / subject.width, target_height / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    left = (canvas.width - subject.width) // 2
    top = 1940 - subject.height
    if top < 64:
        top = 64
    canvas.alpha_composite(subject, (left, top))
    return canvas


def normalize_overlay(source: Path, identity_source: Path) -> Image.Image:
    """Apply the identity master's exact crop transform to an aligned VFX layer."""
    overlay = Image.open(source).convert("RGBA")
    identity = Image.open(identity_source).convert("RGBA")
    bbox = identity.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError(f"No visible identity subject in {identity_source}")
    identity_subject = identity.crop(bbox)
    target_width, target_height = 1500, 1740
    scale = min(target_width / identity_subject.width, target_height / identity_subject.height)
    size = (max(1, round(identity_subject.width * scale)), max(1, round(identity_subject.height * scale)))
    subject = overlay.crop(bbox).resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    left = (canvas.width - subject.width) // 2
    top = max(64, 1940 - subject.height)
    canvas.alpha_composite(subject, (left, top))
    return canvas


def face_removal_mask(size: tuple[int, int] = (2048, 2048), feather: int = 12) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    width, height = size
    left, top, right, bottom = FACE_REMOVAL_BOUNDS
    draw.rounded_rectangle(
        (round(left * width), round(top * height), round(right * width), round(bottom * height)),
        radius=round(width * 0.05),
        fill=255,
    )
    return mask.filter(ImageFilter.GaussianBlur(feather))


def align_generated_subject(generated: Image.Image, reference: Image.Image) -> Image.Image:
    generated = generated.convert("RGBA")
    reference = reference.convert("RGBA")
    generated_box = generated.getchannel("A").getbbox()
    reference_box = reference.getchannel("A").getbbox()
    if not generated_box or not reference_box:
        raise RuntimeError("Layer source or reference has no visible subject")
    subject = generated.crop(generated_box).resize(
        (reference_box[2] - reference_box[0], reference_box[3] - reference_box[1]),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    canvas.alpha_composite(subject, (reference_box[0], reference_box[1]))
    return canvas


def build_faceless_base(reference_path: Path, generated_path: Path) -> tuple[Image.Image, Image.Image]:
    reference = Image.open(reference_path).convert("RGBA")
    generated = Image.open(generated_path).convert("RGBA")
    aligned = align_generated_subject(generated, reference)
    mask = face_removal_mask(reference.size)
    mask = ImageChops.multiply(mask, reference.getchannel("A"))
    return Image.composite(aligned, reference, mask), mask


def build_face_layer(source: Path) -> Image.Image:
    generated = Image.open(source).convert("RGBA")
    source_box = generated.getchannel("A").getbbox()
    if not source_box:
        raise RuntimeError(f"No visible face in {source}")
    face = generated.crop(source_box)
    left, top, right, bottom = FACE_LAYER_BOUNDS
    target_box = (
        round(left * 2048),
        round(top * 2048),
        round(right * 2048),
        round(bottom * 2048),
    )
    face = face.resize(
        (target_box[2] - target_box[0], target_box[3] - target_box[1]),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    canvas.alpha_composite(face, (target_box[0], target_box[1]))
    return canvas


def layered_body_prompt(skin_id: str) -> str:
    return " ".join([
        "This is a precise production asset edit of image 1, not a redesign.",
        "Remove the COMPLETE face: both eyebrows, both eyes including every rim and highlight, the mouth, and both pink cheek/blush marks.",
        "There must be no face, expression, pink cheek tint, indentation, ghost, outline, or facial remnant anywhere.",
        "Reconstruct the missing area with the continuous underlying shell material and lighting so it is a clean neutral interchangeable body layer.",
        "Keep every non-face element identical to image 1: exact canvas, silhouette, proportions, position, camera, feet, accessory, pattern, seams outside the face area, palette, texture, highlights, and shadows.",
        "Keep the central facial canvas smooth and low-detail.",
        "Place the one complete object on a perfectly uniform flat #FF00FF background with no floor, cast shadow, gradient, texture, or extra object.",
        STYLE_LOCK,
        NEGATIVES,
    ])


def layered_face_prompt() -> str:
    return " ".join([
        "Generate a new clean face sprite from scratch; image 1 is only a layout, personality, and premium-toy style reference. Do not extract, trace, crop, or copy its pixels.",
        "Create exactly seven separated components: two simple glossy oval eyes, two small curved eyebrows, one tiny smiling mouth, and two compact solid rounded blush ovals.",
        "Use clean vector-like silhouettes with subtle premium 3D toy shading confined inside each shape, crisp professionally antialiased boundaries, and smooth Bezier-like curves.",
        "Blush must have a finite opaque edge, never airbrushed, fuzzy, translucent, textured, or feathered. Do not add cream, white, or gray outer rims.",
        "Keep the friendly relative placement, scale, symmetry, warm brown-black eye colors, restrained white catchlights, and amber lower irises.",
        "Include no egg shell, feet, body texture, accessory, shadow, glow, or extra mark.",
        "Keep the face centered at its original relative layout on a full square canvas and place it on a perfectly uniform flat #00FF00 background.",
        "No gradient, floor, checkerboard, text, watermark, or additional object.",
    ])


def generate_layered_sources(source_dir: Path) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    run: dict[str, Any] = {
        "schemaVersion": 1,
        "pipelineVersion": PIPELINE_VERSION,
        "generationModel": GENERATION_MODEL,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "bodies": {},
    }
    for skin_id in SKINS:
        print(f"generating faceless FAL source for {skin_id}...", flush=True)
        prompt = layered_body_prompt(skin_id)
        result = call_function("generate-katchimera-art", {
            "modelId": GENERATION_MODEL,
            "input": {
                "image_urls": [image_data_uri(OUTPUT_DIR / f"{skin_id}.png", max_side=1536)],
                "aspect_ratio": "1:1",
                "resolution": "2K",
            },
            "assetType": "other",
            "assetKey": f"egg-avatar-layer:{skin_id}:body-v1",
            "skinId": skin_id,
            "pipelineVersion": PIPELINE_VERSION,
            "renderProfile": {
                "id": f"egg_avatar_{skin_id}_faceless_body_v1",
                "displayName": f"{SKINS[skin_id]['name']} faceless egg body v1",
                "topLevelType": "avatar-layer",
                "triggerCategory": "egg-avatar",
                "triggerSubtype": "body",
                "theme": skin_id,
                "creatureKind": "egg-avatar-body",
                "caption": "faceless interchangeable egg avatar body",
                "skinId": skin_id,
                "imagePrompt": prompt,
            },
        })
        record = result.get("record") or {}
        image_url = record.get("image_url")
        if not image_url:
            raise RuntimeError(f"No FAL body image URL for {skin_id}: {result}")
        output = source_dir / f"{skin_id}-keyed-fal.png"
        download(image_url, output)
        run["bodies"][skin_id] = {"prompt": prompt, "imageUrl": image_url, "recordId": record.get("id")}

    print("generating FAL classic face layer source...", flush=True)
    prompt = layered_face_prompt()
    result = call_function("generate-katchimera-art", {
        "modelId": GENERATION_MODEL,
        "input": {
            "image_urls": [image_data_uri(OUTPUT_DIR / "classic.png", max_side=1536)],
            "aspect_ratio": "1:1",
            "resolution": "2K",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-layer:{DEFAULT_FACE_ID}:face-v1",
        "pipelineVersion": PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_{DEFAULT_FACE_ID.replace('-', '_')}_face_v1",
            "displayName": "Classic Smile egg face layer v1",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "face",
            "theme": "classic",
            "creatureKind": "egg-avatar-face",
            "caption": "interchangeable egg avatar face",
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No FAL face image URL: {result}")
    download(image_url, source_dir / f"{DEFAULT_FACE_ID}-keyed-fal.png")
    run["face"] = {"id": DEFAULT_FACE_ID, "prompt": prompt, "imageUrl": image_url, "recordId": record.get("id")}
    (source_dir / "layered-run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")


def matte_layered_sources(source_dir: Path) -> None:
    ids = [*SKINS.keys(), DEFAULT_FACE_ID]
    records: dict[str, Any] = {}
    for asset_id in ids:
        keyed = source_dir / f"{asset_id}-keyed-fal.png"
        if not keyed.exists():
            keyed = source_dir / f"{asset_id}-keyed.png"
        if not keyed.exists():
            raise SystemExit(f"Missing keyed layer source for {asset_id}")
        print(f"matting {asset_id} with BiRefNet Heavy...", flush=True)
        encoded = base64.b64encode(keyed.read_bytes()).decode()
        result = call_function("remove-image-background", {
            "imageBase64": encoded,
            "outputName": f"egg-avatar-layer-{asset_id.replace('_', '-')}-v1",
        })
        image_url = result.get("imageUrl")
        if not image_url:
            raise RuntimeError(f"No BiRefNet image URL for {asset_id}: {result}")
        download(image_url, source_dir / f"{asset_id}-birefnet.png")
        records[asset_id] = {
            "imageUrl": image_url,
            "model": MATTING_MODEL,
            "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
            "operatingResolution": result.get("operatingResolution", "1024x1024"),
            "refineForeground": result.get("refineForeground", True),
        }
    (source_dir / "layered-matting.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def save_layer_asset(image: Image.Image, directory: Path, thumbnails: Path, asset_id: str) -> dict[str, Any]:
    directory.mkdir(parents=True, exist_ok=True)
    thumbnails.mkdir(parents=True, exist_ok=True)
    png_path = directory / f"{asset_id}.png"
    webp_path = directory / f"{asset_id}.webp"
    thumb_path = thumbnails / f"{asset_id}.webp"
    image.save(png_path, optimize=True)
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
    image.resize((256, 256), Image.Resampling.LANCZOS).save(thumb_path, format="WEBP", quality=88, method=6)
    return {
        "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
        "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
        "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": 256, "height": 256, "sha256": sha256(thumb_path)},
    }


def import_layered_v1(source_dir: Path) -> None:
    def layer_source(asset_id: str) -> Path:
        birefnet = source_dir / f"{asset_id}-birefnet.png"
        return birefnet if birefnet.exists() else source_dir / f"{asset_id}-matted.png"

    missing = [skin_id for skin_id in SKINS if not layer_source(skin_id).exists()]
    # A face is a set of disconnected dark and semi-transparent components;
    # BiRefNet may treat the key plate between them as foreground. The
    # component-aware chroma matte is authoritative unless a future face matte
    # passes the disconnected-component QA gate.
    face_source = source_dir / f"{DEFAULT_FACE_ID}-matted.png"
    if not face_source.exists():
        missing.append(DEFAULT_FACE_ID)
    if missing:
        sys.exit(f"Missing layered source art: {', '.join(missing)}")

    manifest = load_manifest()
    approved_at = datetime.now(timezone.utc).isoformat()
    body_prompt = (
        "Remove only eyebrows, eyes, mouth, and blush; reconstruct clean shell beneath them; preserve the exact "
        "approved silhouette, accessories, palette, patterns, lighting, feet, pose, and canvas."
    )
    for skin_id in SKINS:
        reference_path = OUTPUT_DIR / f"{skin_id}.png"
        base, mask = build_faceless_base(reference_path, layer_source(skin_id))
        outputs = save_layer_asset(base, BASES_DIR, BASE_THUMBS_DIR, skin_id)
        entry = manifest["skins"][skin_id]
        entry["baseVersion"] = 1
        entry["faceLayoutVersion"] = FACE_LAYOUT["version"]
        entry["basePrompt"] = body_prompt
        entry["baseGenerationModel"] = GENERATION_MODEL if (source_dir / f"{skin_id}-keyed-fal.png").exists() else "OpenAI built-in image generation"
        entry["baseMattingModel"] = MATTING_MODEL if (source_dir / f"{skin_id}-birefnet.png").exists() else "local chroma-key soft matte"
        entry["baseMattingSettings"] = {"model": "General Use (Heavy)", "operatingResolution": "1024x1024", "refineForeground": True}
        entry["baseEditMask"] = {
            "shape": "roundedRectangle",
            "bounds": list(FACE_REMOVAL_BOUNDS),
            "featherPixels": 12,
            "outsideMaskSource": str(reference_path.relative_to(ROOT)).replace("\\", "/"),
        }
        entry["baseOutputs"] = outputs
        # Keep a QA composite beside review inputs, never as a runtime asset.
        qa_dir = source_dir / "qa"
        qa_dir.mkdir(parents=True, exist_ok=True)
        base.save(qa_dir / f"{skin_id}-base.png", optimize=True)
        mask.save(qa_dir / f"{skin_id}-edit-mask.png", optimize=True)

    face = build_face_layer(face_source)
    face_outputs = save_layer_asset(face, FACES_DIR, FACE_THUMBS_DIR, DEFAULT_FACE_ID)
    manifest["faces"] = {
        DEFAULT_FACE_ID: {
            "name": "Classic Smile",
            "version": 2,
            "approvedAt": approved_at,
            "faceLayoutVersion": FACE_LAYOUT["version"],
            "prompt": layered_face_prompt(),
            "generationModel": "OpenAI built-in image generation",
            "mattingModel": "component-aware chroma soft matte",
            "mattingSettings": {"keyColor": "#00FF00", "disconnectedComponents": True, "edgeMode": "soft", "despill": True},
            "qa": {"birefnetCandidateRejected": "visible key-color fringe on disconnected components"},
            "layerBounds": list(FACE_LAYER_BOUNDS),
            "outputs": face_outputs,
        }
    }
    manifest["schemaVersion"] = 2
    manifest["pipelineVersion"] = PIPELINE_VERSION
    manifest["artDirectionVersion"] = 4
    manifest["faceLayout"] = FACE_LAYOUT
    manifest["layering"] = {
        "version": 1,
        "order": ["body", "face", "effects"],
        "defaultFaceId": DEFAULT_FACE_ID,
        "legacyCompositePathsRetained": True,
    }
    manifest["updatedAt"] = approved_at
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"imported {len(SKINS)} faceless bases and face {DEFAULT_FACE_ID}")


def import_face_set(source_dir: Path) -> None:
    """Promote reviewed, component-aware matted expressions without touching bodies."""
    face_ids = [face_id for face_id in FACE_VARIATIONS if face_id != DEFAULT_FACE_ID]
    missing = [face_id for face_id in face_ids if not (source_dir / f"{face_id}-matted.png").exists()]
    if missing:
        sys.exit(f"Missing reviewed face mattes: {', '.join(missing)}")

    manifest = load_manifest()
    approved_at = datetime.now(timezone.utc).isoformat()
    faces = manifest.setdefault("faces", {})
    qa_dir = source_dir / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    classic_body = Image.open(BASES_DIR / "classic.png").convert("RGBA")
    for face_id in face_ids:
        definition = FACE_VARIATIONS[face_id]
        face = build_face_layer(source_dir / f"{face_id}-matted.png")
        outputs = save_layer_asset(face, FACES_DIR, FACE_THUMBS_DIR, face_id)
        faces[face_id] = {
            "name": definition["name"],
            "description": definition["description"],
            "version": 1,
            "approvedAt": approved_at,
            "faceLayoutVersion": FACE_LAYOUT["version"],
            "prompt": layered_face_prompt(),
            "expressionDirection": definition["expression"],
            "generationModel": "OpenAI built-in image generation",
            "mattingModel": "component-aware chroma soft matte",
            "mattingSettings": {
                "keyColor": "#00FF00",
                "disconnectedComponents": True,
                "edgeMode": "soft",
                "despill": True,
                "edgeContractPixels": 2 if face_id == "happy-squint" else 1,
            },
            "layerBounds": list(FACE_LAYER_BOUNDS),
            "outputs": outputs,
        }
        # Match EggAvatarArtwork's current global face presentation scale so
        # reviewers see the same proportions the app will render.
        runtime_size = round(face.width * 0.92)
        runtime_face = face.resize((runtime_size, runtime_size), Image.Resampling.LANCZOS)
        preview = classic_body.copy()
        preview.alpha_composite(runtime_face, ((preview.width - runtime_size) // 2, (preview.height - runtime_size) // 2))
        preview.resize((512, 512), Image.Resampling.LANCZOS).save(qa_dir / f"{face_id}-classic-preview.png", optimize=True)
    manifest["updatedAt"] = approved_at
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"imported {len(face_ids)} interchangeable face variations")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest() -> dict[str, Any]:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"schemaVersion": 1, "pipelineVersion": PIPELINE_VERSION, "skins": {}}


def approve(skin_id: str, candidate_index: int) -> None:
    review = candidate_dir(skin_id)
    source = review / "matted" / f"candidate-{candidate_index}.png"
    run_path = review / "run.json"
    if not source.exists() or not run_path.exists():
        sys.exit(f"Missing matted candidate {candidate_index} for {skin_id}.")
    run = json.loads(run_path.read_text(encoding="utf-8"))
    candidate = next((item for item in run["candidates"] if int(item["index"]) == candidate_index), None)
    if not candidate:
        sys.exit("Candidate metadata not found.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    full = normalize(source)
    png_path = OUTPUT_DIR / f"{skin_id}.png"
    webp_path = OUTPUT_DIR / f"{skin_id}.webp"
    thumb_path = THUMB_DIR / f"{skin_id}.webp"
    full.save(png_path, optimize=True)
    full.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
    full.resize((256, 256), Image.Resampling.LANCZOS).save(thumb_path, format="WEBP", quality=88, method=6)

    manifest = load_manifest()
    manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest["pipelineVersion"] = PIPELINE_VERSION
    manifest["artDirectionVersion"] = 3
    manifest["faceLayout"] = FACE_LAYOUT
    manifest["skins"][skin_id] = {
        "name": SKINS[skin_id]["name"],
        "version": 3,
        "approvedCandidate": candidate_index,
        "approvedAt": datetime.now(timezone.utc).isoformat(),
        "prompt": run["prompt"],
        "generationModel": run["model"],
        "generationRecordId": candidate.get("recordId"),
        "references": run["references"],
        "mattingModel": candidate.get("mattingModel"),
        "mattingSettings": candidate.get("mattingSettings"),
        "faceLayoutVersion": FACE_LAYOUT["version"],
        "outputs": {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
            "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": 256, "height": 256, "sha256": sha256(thumb_path)},
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved {skin_id} candidate {candidate_index}")


def import_approved_skin(skin_id: str, source: Path) -> None:
    """Promote one reviewed, already-matted reference-led skin."""
    if not source.exists():
        sys.exit(f"Missing approved source art: {source}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    full = normalize(source)
    png_path = OUTPUT_DIR / f"{skin_id}.png"
    webp_path = OUTPUT_DIR / f"{skin_id}.webp"
    thumb_path = THUMB_DIR / f"{skin_id}.webp"
    full.save(png_path, optimize=True)
    full.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
    full.resize((256, 256), Image.Resampling.LANCZOS).save(thumb_path, format="WEBP", quality=88, method=6)

    approved_at = datetime.now(timezone.utc).isoformat()
    manifest = load_manifest()
    manifest["updatedAt"] = approved_at
    manifest["pipelineVersion"] = PIPELINE_VERSION
    manifest["artDirectionVersion"] = 3
    manifest["faceLayout"] = FACE_LAYOUT
    for existing_skin in manifest["skins"].values():
        existing_skin.setdefault("faceLayoutVersion", FACE_LAYOUT["version"])
    manifest["skins"][skin_id] = {
        "name": SKINS[skin_id]["name"],
        "version": 3,
        "approvedCandidate": "reference-locked-built-in-v1",
        "approvedAt": approved_at,
        "prompt": prompt_for(skin_id),
        "generationModel": "OpenAI built-in image generation",
        "references": [
            {"path": "assets/images/katchimeras/egg-avatars/classic.png", "role": "identity and face anchor master"},
            {"path": "user-provided Robot and Pumpkin concept crop", "role": "theme reference"},
            {"path": "assets/images/katchimeras/cutouts/baristabbit.png", "role": "Katchimeras premium 3D toy style"},
        ],
        "artDirection": "Reference-led theme with the canonical v1 facial safe zone kept visually clear for future face-layer compositing.",
        "faceLayoutVersion": FACE_LAYOUT["version"],
        "mattingModel": "local chroma-key soft matte",
        "outputs": {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
            "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": 256, "height": 256, "sha256": sha256(thumb_path)},
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"imported approved {skin_id} skin")


def import_art_direction_v2(source_dir: Path) -> None:
    """Promote the reference-locked cute-toy art pass into production assets."""
    missing = [skin_id for skin_id in SKINS if not (source_dir / f"{skin_id}.png").exists()]
    if missing:
        sys.exit(f"Missing v2 source art: {', '.join(missing)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    approved_at = datetime.now(timezone.utc).isoformat()
    for skin_id in SKINS:
        full = normalize(source_dir / f"{skin_id}.png")
        png_path = OUTPUT_DIR / f"{skin_id}.png"
        webp_path = OUTPUT_DIR / f"{skin_id}.webp"
        thumb_path = THUMB_DIR / f"{skin_id}.webp"
        full.save(png_path, optimize=True)
        full.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
        full.resize((256, 256), Image.Resampling.LANCZOS).save(thumb_path, format="WEBP", quality=88, method=6)
        manifest["skins"][skin_id] = {
            "name": SKINS[skin_id]["name"],
            "version": 2,
            "approvedCandidate": "reference-locked-v2",
            "approvedAt": approved_at,
            "generationModel": "OpenAI built-in image generation",
            "references": [
                {"path": "user-provided egg customisation concept", "role": "cute face proportions and skin concepts"},
                {"path": "assets/images/katchimeras/cutouts/baristabbit.png", "role": "Katchimeras premium 3D toy style"},
                {"path": "classic v2 identity master", "role": "silhouette, camera, and face lock"},
            ],
            "artDirection": "Approved happy egg reference: rounded shell, two feet, large friendly cartoon eyes, curved brows, blush, smiling mouth, warm low-contrast premium toy lighting.",
            "mattingModel": "local chroma-key soft matte",
            "faceLayoutVersion": FACE_LAYOUT["version"],
            "outputs": {
                "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
                "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
                "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": 256, "height": 256, "sha256": sha256(thumb_path)},
            },
        }
        print(f"imported {skin_id} v2")
    EFFECTS_DIR.mkdir(parents=True, exist_ok=True)
    effects: dict[str, Any] = {}
    for stage in ("crack-1", "crack-2"):
        source = source_dir / f"{stage}.png"
        if not source.exists():
            sys.exit(f"Missing v2 effect art: {source}")
        full = normalize_overlay(source, source_dir / "classic.png")
        png_path = EFFECTS_DIR / f"{stage}.png"
        webp_path = EFFECTS_DIR / f"{stage}.webp"
        full.save(png_path, optimize=True)
        full.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=94, method=6)
        effects[stage] = {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
        }
        print(f"imported {stage} v2 overlay")
    CUTOUTS_DIR.mkdir(parents=True, exist_ok=True)
    classic_full = Image.open(OUTPUT_DIR / "classic.png").convert("RGBA")
    legacy_outputs: dict[str, Any] = {}
    for name, image in {
        "egg-base": classic_full,
        "egg-crack-1": Image.alpha_composite(classic_full, Image.open(EFFECTS_DIR / "crack-1.png").convert("RGBA")),
        "egg-crack-2": Image.alpha_composite(classic_full, Image.open(EFFECTS_DIR / "crack-2.png").convert("RGBA")),
    }.items():
        png_path = CUTOUTS_DIR / f"{name}.png"
        webp_path = CUTOUTS_DIR / f"{name}.webp"
        image.save(png_path, optimize=True)
        image.resize((1024, 1024), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
        legacy_outputs[name] = {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
        }
    manifest["updatedAt"] = approved_at
    manifest["artDirectionVersion"] = 3
    manifest["pipelineVersion"] = PIPELINE_VERSION
    manifest["faceLayout"] = FACE_LAYOUT
    manifest["effects"] = effects
    manifest["gameplay"] = {
        "version": 2,
        "mode": "equipped skin with reusable crack overlays",
        "base": "The Today runtime reads EggAvatarProvider.equippedSkin.",
        "effects": effects,
        "legacyClassicOutputs": legacy_outputs,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def gameplay_approve(crack_one: int, crack_two: int) -> None:
    selected = {"crack-1": crack_one, "crack-2": crack_two}
    images = {"egg-base": normalize(CLASSIC_APPROVED)}
    runs: dict[str, dict[str, Any]] = {}
    candidates: dict[str, dict[str, Any]] = {}
    for stage, index in selected.items():
        review = REVIEW_DIR / "gameplay" / stage
        source = review / "matted" / f"candidate-{index}.png"
        run_path = review / "run.json"
        if not source.exists() or not run_path.exists():
            sys.exit(f"Missing matted gameplay {stage} candidate {index}.")
        run = json.loads(run_path.read_text(encoding="utf-8"))
        candidate = next((item for item in run["candidates"] if int(item["index"]) == index), None)
        if not candidate:
            sys.exit(f"Missing candidate metadata for gameplay {stage} {index}.")
        runs[stage] = run
        candidates[stage] = candidate
        raw_source = review / "raw" / f"candidate-{index}.png"
        if not raw_source.exists():
            sys.exit(f"Missing raw gameplay {stage} candidate {index}.")
        images[f"egg-{stage}"] = normalize(source, rgb_source=raw_source)

    boxes = [image.getchannel("A").getbbox() for image in images.values()]
    if any(box is None for box in boxes):
        raise RuntimeError("A gameplay state has no alpha subject.")
    typed_boxes = [box for box in boxes if box is not None]
    padding = 24
    union = (
        max(0, min(box[0] for box in typed_boxes) - padding),
        max(0, min(box[1] for box in typed_boxes) - padding),
        min(2048, max(box[2] for box in typed_boxes) + padding),
        min(2048, max(box[3] for box in typed_boxes) + padding),
    )
    CUTOUTS_DIR.mkdir(parents=True, exist_ok=True)
    outputs: dict[str, Any] = {}
    for name, image in images.items():
        cropped = image.crop(union)
        png_path = CUTOUTS_DIR / f"{name}.png"
        webp_path = CUTOUTS_DIR / f"{name}.webp"
        cropped.save(png_path, optimize=True)
        webp_width = round(cropped.width * (1100 / cropped.height))
        cropped.resize((webp_width, 1100), Image.Resampling.LANCZOS).save(webp_path, format="WEBP", quality=92, method=6)
        outputs[name] = {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "size": list(cropped.size), "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "size": [webp_width, 1100], "sha256": sha256(webp_path)},
        }

    manifest = load_manifest()
    manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest["gameplay"] = {
        "version": 1,
        "approvedAt": datetime.now(timezone.utc).isoformat(),
        "baseSkin": "classic",
        "sharedCanvasCrop": list(union),
        "stages": {
            stage: {
                "approvedCandidate": selected[stage],
                "prompt": runs[stage]["prompt"],
                "generationModel": runs[stage]["model"],
                "generationRecordId": candidates[stage].get("recordId"),
                "mattingModel": candidates[stage].get("mattingModel"),
                "mattingSettings": candidates[stage].get("mattingSettings"),
            }
            for stage in GAMEPLAY_STAGES
        },
        "outputs": outputs,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved gameplay states: crack-1={crack_one}, crack-2={crack_two}")


def image_metrics(path: Path) -> dict[str, Any]:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)), alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1))]
    coverage = sum(1 for pixel in alpha.getdata() if pixel > 8) / (image.width * image.height)
    return {"size": image.size, "bbox": bbox, "corners": corners, "coverage": round(coverage, 4)}


def validate(skin_id: str | None = None) -> None:
    ids = [skin_id] if skin_id else list(SKINS)
    errors: list[str] = []
    manifest = load_manifest()
    if manifest.get("faceLayout") != FACE_LAYOUT:
        errors.append("manifest facial layout is missing or differs from the canonical v1 contract")
    for item in ids:
        for path, expected_size in [
            (OUTPUT_DIR / f"{item}.png", (2048, 2048)),
            (OUTPUT_DIR / f"{item}.webp", (1024, 1024)),
            (THUMB_DIR / f"{item}.webp", (256, 256)),
        ]:
            if not path.exists():
                errors.append(f"missing {path.relative_to(ROOT)}")
                continue
            metrics = image_metrics(path)
            if tuple(metrics["size"]) != expected_size:
                errors.append(f"wrong size {path.relative_to(ROOT)}: {metrics['size']}")
            if any(metrics["corners"]):
                errors.append(f"non-transparent corner in {path.relative_to(ROOT)}")
            if not 0.2 <= metrics["coverage"] <= 0.7:
                errors.append(f"implausible alpha coverage in {path.relative_to(ROOT)}: {metrics['coverage']}")
            print(item, path.suffix, metrics)
        if item not in manifest.get("skins", {}):
            errors.append(f"manifest missing {item}")
        elif manifest["skins"][item].get("faceLayoutVersion") != FACE_LAYOUT["version"]:
            errors.append(f"manifest skin {item} does not use canonical face layout v{FACE_LAYOUT['version']}")
        for path, expected_size in [
            (BASES_DIR / f"{item}.png", (2048, 2048)),
            (BASES_DIR / f"{item}.webp", (1024, 1024)),
            (BASE_THUMBS_DIR / f"{item}.webp", (256, 256)),
        ]:
            if not path.exists():
                errors.append(f"missing layered base {path.relative_to(ROOT)}")
                continue
            metrics = image_metrics(path)
            if tuple(metrics["size"]) != expected_size:
                errors.append(f"wrong layered base size {path.relative_to(ROOT)}: {metrics['size']}")
            if any(metrics["corners"]):
                errors.append(f"non-transparent layered base corner in {path.relative_to(ROOT)}")
        original_path = OUTPUT_DIR / f"{item}.png"
        base_path = BASES_DIR / f"{item}.png"
        if original_path.exists() and base_path.exists():
            original = Image.open(original_path).convert("RGBA")
            base = Image.open(base_path).convert("RGBA")
            outside = Image.eval(face_removal_mask(original.size), lambda value: 255 if value == 0 else 0)
            outside_difference = ImageChops.difference(original, base).convert("RGB")
            if ImageChops.multiply(outside_difference, Image.merge("RGB", (outside, outside, outside))).getbbox():
                errors.append(f"layered base changed source pixels outside face mask: {item}")
        if item in manifest.get("skins", {}) and not manifest["skins"][item].get("baseOutputs"):
            errors.append(f"manifest missing layered base outputs for {item}")
    for face_id in FACE_VARIATIONS:
        face_entry = manifest.get("faces", {}).get(face_id)
        if not face_entry:
            errors.append(f"manifest missing face {face_id}")
        elif face_entry.get("faceLayoutVersion") != FACE_LAYOUT["version"]:
            errors.append(f"manifest face {face_id} does not use canonical face layout v{FACE_LAYOUT['version']}")
        for path, expected_size in [
            (FACES_DIR / f"{face_id}.png", (2048, 2048)),
            (FACES_DIR / f"{face_id}.webp", (1024, 1024)),
            (FACE_THUMBS_DIR / f"{face_id}.webp", (256, 256)),
        ]:
            if not path.exists():
                errors.append(f"missing face layer {path.relative_to(ROOT)}")
                continue
            metrics = image_metrics(path)
            if tuple(metrics["size"]) != expected_size:
                errors.append(f"wrong face layer size {path.relative_to(ROOT)}: {metrics['size']}")
            if any(metrics["corners"]):
                errors.append(f"non-transparent face layer corner in {path.relative_to(ROOT)}")
        face_master = FACES_DIR / f"{face_id}.png"
        if not face_master.exists():
            continue
        face_rgba = Image.open(face_master).convert("RGBA")
        alpha = face_rgba.getchannel("A")
        left, top, right, bottom = FACE_LAYOUT["safeZone"]["left"], FACE_LAYOUT["safeZone"]["top"], FACE_LAYOUT["safeZone"]["right"], FACE_LAYOUT["safeZone"]["bottom"]
        safe = Image.new("L", alpha.size, 0)
        ImageDraw.Draw(safe).rounded_rectangle((round(left * alpha.width), round(top * alpha.height), round(right * alpha.width), round(bottom * alpha.height)), radius=round(alpha.width * 0.04), fill=255)
        if ImageChops.subtract(alpha, safe).getbbox():
            errors.append(f"face layer escapes canonical safe zone: {face_id}")
        visible_pixels = 0
        green_spill_pixels = 0
        partial_pixels = 0
        for red, green, blue, opacity in face_rgba.getdata():
            if opacity > 16:
                visible_pixels += 1
                if green > 80 and green > red * 1.4 and green > blue * 1.4:
                    green_spill_pixels += 1
            if 16 < opacity < 239:
                partial_pixels += 1
        if green_spill_pixels:
            errors.append(f"face layer contains {green_spill_pixels} visible key-color pixels: {face_id}")
        if visible_pixels and partial_pixels / visible_pixels > 0.08:
            errors.append(f"face layer has implausibly soft edges: {face_id}")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"validated {len(ids)} egg-avatar skin(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Katchimera egg-avatar skin pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("generate", "matte", "approve"):
        child = sub.add_parser(command)
        child.add_argument("--skin", required=True, choices=SKINS.keys())
        if command == "generate":
            child.add_argument("--count", type=int, default=4)
        if command == "approve":
            child.add_argument("--candidate", type=int, required=True)
    check = sub.add_parser("validate")
    check.add_argument("--skin", choices=SKINS.keys())
    gameplay_generation = sub.add_parser("gameplay-generate")
    gameplay_generation.add_argument("--count", type=int, default=3)
    sub.add_parser("gameplay-matte")
    gameplay_approval = sub.add_parser("gameplay-approve")
    gameplay_approval.add_argument("--crack-one", type=int, required=True)
    gameplay_approval.add_argument("--crack-two", type=int, required=True)
    import_v2 = sub.add_parser("import-art-direction-v2")
    import_v2.add_argument("--source-dir", type=Path, required=True)
    import_skin = sub.add_parser("import-approved-skin")
    import_skin.add_argument("--skin", required=True, choices=SKINS.keys())
    import_skin.add_argument("--source", type=Path, required=True)
    import_layers = sub.add_parser("import-layered-v1")
    import_layers.add_argument("--source-dir", type=Path, required=True)
    import_faces = sub.add_parser("import-face-set")
    import_faces.add_argument("--source-dir", type=Path, required=True)
    generate_layers = sub.add_parser("layered-generate")
    generate_layers.add_argument("--source-dir", type=Path, required=True)
    matte_layers = sub.add_parser("layered-matte")
    matte_layers.add_argument("--source-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "generate":
        generate(args.skin, args.count)
    elif args.command == "matte":
        matte(args.skin)
    elif args.command == "approve":
        approve(args.skin, args.candidate)
    elif args.command == "validate":
        validate(args.skin)
    elif args.command == "gameplay-generate":
        gameplay_generate(args.count)
    elif args.command == "gameplay-matte":
        gameplay_matte()
    elif args.command == "import-art-direction-v2":
        import_art_direction_v2(args.source_dir)
    elif args.command == "import-approved-skin":
        import_approved_skin(args.skin, args.source)
    elif args.command == "import-layered-v1":
        import_layered_v1(args.source_dir)
    elif args.command == "import-face-set":
        import_face_set(args.source_dir)
    elif args.command == "layered-generate":
        generate_layered_sources(args.source_dir)
    elif args.command == "layered-matte":
        matte_layered_sources(args.source_dir)
    else:
        gameplay_approve(args.crack_one, args.crack_two)


if __name__ == "__main__":
    main()
