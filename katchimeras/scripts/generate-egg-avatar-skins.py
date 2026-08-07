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
REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-skins"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
CURRENT_EGG = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "egg-base.png"
BARISTABBIT = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "baristabbit.png"
CLASSIC_APPROVED = OUTPUT_DIR / "classic.png"
CUTOUTS_DIR = ROOT / "assets" / "images" / "katchimeras" / "cutouts"
GENERATION_MODEL = "fal-ai/nano-banana-2/edit"
MATTING_MODEL = "fal-ai/birefnet/v2"
PIPELINE_VERSION = "egg-avatar-skins-v2"

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
    key_color = "#FF00FF" if skin_id == "moss" else "#00FF00"
    return " ".join(
        [
            IDENTITY_LOCK,
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
    manifest["skins"][skin_id] = {
        "name": SKINS[skin_id]["name"],
        "version": 1,
        "approvedCandidate": candidate_index,
        "approvedAt": datetime.now(timezone.utc).isoformat(),
        "prompt": run["prompt"],
        "generationModel": run["model"],
        "generationRecordId": candidate.get("recordId"),
        "references": run["references"],
        "mattingModel": candidate.get("mattingModel"),
        "mattingSettings": candidate.get("mattingSettings"),
        "outputs": {
            "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
            "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": 1024, "height": 1024, "sha256": sha256(webp_path)},
            "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": 256, "height": 256, "sha256": sha256(thumb_path)},
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved {skin_id} candidate {candidate_index}")


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
    manifest["artDirectionVersion"] = 2
    manifest["pipelineVersion"] = PIPELINE_VERSION
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
    else:
        gameplay_approve(args.crack_one, args.crack_two)


if __name__ == "__main__":
    main()
