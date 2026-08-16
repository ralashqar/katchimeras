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
import subprocess
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
HAT_REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-hats-v4"
BODY_DRAFT_REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-body-drafts-v1"
FACE_REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-faces-v4"
HELD_REVIEW_DIR = ROOT / ".tmp" / "egg-avatar-held-v2"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
BODY_CATALOG_PATH = ROOT / "data" / "egg-avatar" / "bodies.json"
FACE_CATALOG_PATH = ROOT / "data" / "egg-avatar" / "faces.json"
HAT_CATALOG_PATH = ROOT / "data" / "egg-avatar" / "hats.json"
HELD_CATALOG_PATH = ROOT / "data" / "egg-avatar" / "held.json"
AVATAR_APP_SIZE = 512
AVATAR_HIGH_SIZE = 1536
AVATAR_THUMBNAIL_SIZE = 256
CURRENT_EGG = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "egg-base.png"
BARISTABBIT = ROOT / "assets" / "images" / "katchimeras" / "cutouts" / "baristabbit.png"
CLASSIC_APPROVED = OUTPUT_DIR / "classic.png"
TODAY_RUNTIME_BACKGROUND = ROOT / "assets" / "images" / "katchimeras" / "world" / "today" / "today_bg.webp"
CUTOUTS_DIR = ROOT / "assets" / "images" / "katchimeras" / "cutouts"
GENERATION_MODEL = "fal-ai/nano-banana-2/edit"
HAT_GENERATION_MODEL = "openai/gpt-image-2/edit"
BODY_DRAFT_GENERATION_MODEL = "openai/gpt-image-2/edit"
FACE_GENERATION_MODEL = "openai/gpt-image-2/edit"
HELD_GENERATION_MODEL = "openai/gpt-image-2/edit"
MATTING_MODEL = "fal-ai/birefnet/v2"
PIPELINE_VERSION = "egg-avatar-layers-v1"
HAT_PIPELINE_VERSION = "egg-avatar-hats-v4-style-mapped"
HAT_STYLE_CONTRACT_VERSION = "katchimeras-cozy-toy-v1"
BODY_DRAFT_PIPELINE_VERSION = "egg-avatar-body-drafts-v1-gpt-image-2"
FACE_PIPELINE_VERSION = "egg-avatar-faces-v4-magenta-matte-enclosed-hole-repair"
HELD_PIPELINE_VERSION = "egg-avatar-held-v2-style-mapped"
DEFAULT_FACE_ID = "classic-smile"
ACCESSORY_READY_SKINS = ("moss", "barista", "pumpkin")


def load_catalog(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def catalog_specs(path: Path, slot: str) -> dict[str, dict[str, Any]]:
    document = load_catalog(path)
    specs: dict[str, dict[str, Any]] = {}
    for item in document["items"]:
        design = item["visualDesign"]
        specs[item["id"]] = {
            "slot": slot,
            "direction": " ".join([
                design["summary"],
                f"Palette: {', '.join(design['palette'])}.",
                f"Shape language: {design['shapeLanguage']}",
                f"Constraints: {'; '.join(design['constraints'])}.",
            ]),
            "item": item,
        }
    return specs


FACE_CATALOG = load_catalog(FACE_CATALOG_PATH)
FACE_SPECS = {item["id"]: item for item in FACE_CATALOG["items"]}
HAT_CATALOG = load_catalog(HAT_CATALOG_PATH)
HELD_CATALOG = load_catalog(HELD_CATALOG_PATH)
ACCESSORY_SPECS = {
    **catalog_specs(HAT_CATALOG_PATH, "hat"),
    **catalog_specs(HELD_CATALOG_PATH, "held"),
}
ACCESSORY_BOUNDS = {
    "hat": (0.16, 0.01, 0.84, 0.34),
    "held": (0.70, 0.38, 0.99, 0.90),
}
HAT_IDS = tuple(accessory_id for accessory_id, spec in ACCESSORY_SPECS.items() if spec["slot"] == "hat")
HELD_IDS = tuple(accessory_id for accessory_id, spec in ACCESSORY_SPECS.items() if spec["slot"] == "held")
HAT_PRESENTATIONS = {
    item["id"]: item.get("presentation", {"scale": 1.0, "offsetX": 0.0, "offsetY": 0.0})
    for item in HAT_CATALOG["items"]
}
CROWN_ALIGNED_HAT_IDS = {
    "bear-hood",
    "bunny-ears",
    "cat-ear-headband",
    "dino-spikes",
    "dragon-horns",
    "duckling-cap",
    "frog-hood",
    "graduation-cap",
    "knight-circlet",
    "pirate-tricorn",
    "rainbow-arch",
    "snowflake-tiara",
    "soft-halo",
}
PLANNED_FACE_IDS = tuple(item["id"] for item in FACE_CATALOG["items"] if item["availability"] == "planned")
PLANNED_HAT_IDS = tuple(item["id"] for item in HAT_CATALOG["items"] if item["availability"] == "planned")
PLANNED_HELD_IDS = tuple(item["id"] for item in HELD_CATALOG["items"] if item["availability"] == "planned")
PENDING_HELD_IDS = tuple(
    item["id"] for item in HELD_CATALOG["items"]
    if item["availability"] == "planned" or item.get("layoutVersion", 1) < 2
)
BODY_PRESENTATIONS = {
    "classic": (1.0, 0.0, 0.0),
    "moss": (1.08, 0.0, -0.018),
    "tide": (1.0, 0.0, 0.0),
    "sunset": (1.0, 0.0, 0.0),
    "starglow": (1.0, 0.0, 0.0),
    "frost": (1.0, 0.0, 0.0),
    "ember": (1.0, 0.0, 0.0),
    "barista": (1.06, 0.0, -0.012),
    "robot": (1.0, 0.0, 0.0),
    "pumpkin": (1.05, 0.0, -0.01),
}


def load_body_specs() -> dict[str, dict[str, Any]]:
    document = json.loads(BODY_CATALOG_PATH.read_text(encoding="utf-8"))
    return {item["id"]: item for item in document["items"]}


BODY_SPECS = load_body_specs()
PLANNED_BODY_SPECS = {
    body_id: item for body_id, item in BODY_SPECS.items()
    if item["availability"] == "planned"
}
PLANNED_BODY_IDS = tuple(PLANNED_BODY_SPECS)
STARTER_BODY_BATCH = PLANNED_BODY_IDS[:4]
COSTUME_BODY_IDS = (
    "wizard-robes", "football-kit", "sunny-raincoat", "knight-tunic", "astronaut-suit",
    "explorer-vest", "royal-robe", "party-outfit", "sailor-uniform", "chef-apron",
    "superhero-suit", "cozy-pajamas", "garden-overalls", "detective-coat", "pirate-coat",
    "ballet-wrap", "racing-suit", "artist-smock",
)
NEXT_COSTUME_BODY_BATCH = tuple(body_id for body_id in COSTUME_BODY_IDS if body_id in PLANNED_BODY_SPECS)[:4]
MIXED_BODY_BATCH = (
    *(("watermelon",) if "watermelon" in PLANNED_BODY_SPECS else ()),
    *NEXT_COSTUME_BODY_BATCH[:3],
)

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


def image_data_uri(path: Path, max_side: int = 768, background: tuple[int, int, int] = (244, 238, 225)) -> str:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", image.size, background)
    canvas.paste(image, (0, 0), image)
    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def black_backed_data_uri(path: Path, max_side: int = 1536) -> str:
    return image_data_uri(path, max_side=max_side, background=(0, 0, 0))


def planned_body_prompt(body_id: str) -> str:
    spec = BODY_SPECS[body_id]
    design = spec["visualDesign"]
    return " ".join([
        "Use case: precise-object-edit. Asset type: faceless layered egg-avatar body.",
        "Image 1 is the exact faceless Classic egg body and the edit target. Preserve its full square canvas registration, upright front-facing camera, scale, placement, softly rounded egg silhouette, and two small feet.",
        "Image 2, Baristabbit, is the authoritative Katchimeras character-art reference. Match its simple cozy premium 3D toy language: broad rounded forms, smooth softly painted materials, clean transitions, restrained highlights, warm low-contrast light, and friendly mobile-game readability.",
        "Image 3 is the exact Today cinematic environment used at runtime. Match only its warm daylight, gentle saturation, simplified toy-diorama finish, and soft lighting direction. Do not copy its scenery or pedestal.",
        f"Transform only the egg body's shell design into {spec['name']}: {design['summary']}",
        f"Palette: {', '.join(design['palette'])}.",
        f"Shape language: {design['shapeLanguage']}",
        f"Design constraints: {'; '.join(design['constraints'])}.",
        "The central rounded face-safe area from normalized x 0.22 to 0.78 and y 0.34 to 0.66 must remain smooth, intact, low-detail, and empty so a separate face layer can be added later.",
        "Across normalized x 0.22 to 0.78, every collar, neckline, scarf, neckerchief, lapel, trim, strap, belt, button, jewel, seam, panel boundary, and costume edge must stay entirely below normalized y 0.68.",
        "In plain visual terms, treat the upper two-thirds of the egg as its unobstructed head and the lowest third as the costume torso; no clothing or emblem may overlap the eyes, cheeks, or mouth area.",
        "Keep the crown clear for separately layered hats and keep both outer sides clear enough for a separately layered held accessory.",
        "This body must contain no eyebrows, eyes, pupils, catchlights, mouth, blush, face marks, facial indentation, facial ghost, hat, headwear, top ornament, held prop, hand, arm, pedestal, nest, or scenery.",
        "Preserve a single solid continuous egg body with no transparent-looking holes, cutouts, broken shell, floating pieces, or missing interior regions.",
        "Render the one complete faceless egg body on a perfectly uniform pure-black #000000 background for BiRefNet Heavy. No floor, cast shadow, reflection, glow, gradient, texture, border, text, logo, watermark, or extra object.",
        "Do not zoom, crop, recenter, resize, rotate, or change the camera.",
    ])


def planned_body_review_dir(body_id: str) -> Path:
    return BODY_DRAFT_REVIEW_DIR / body_id


def generate_planned_body_draft(body_id: str) -> None:
    spec = BODY_SPECS[body_id]
    review = planned_body_review_dir(body_id)
    review.mkdir(parents=True, exist_ok=True)
    prompt = planned_body_prompt(body_id)
    references = [
        BASES_DIR / "classic.png",
        BARISTABBIT,
        TODAY_RUNTIME_BACKGROUND,
    ]
    if not all(path.exists() for path in references):
        missing = [str(path) for path in references if not path.exists()]
        raise SystemExit(f"Missing planned-body reference(s): {', '.join(missing)}")
    print(f"generating GPT Image 2 body draft {body_id} at quality low...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": BODY_DRAFT_GENERATION_MODEL,
        "input": {
            "image_urls": [
                black_backed_data_uri(references[0]),
                image_data_uri(references[1], max_side=1024),
                image_data_uri(references[2], max_side=1024),
            ],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-body-draft:{body_id}:v1",
        "skinId": body_id,
        "pipelineVersion": BODY_DRAFT_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_body_draft_{body_id.replace('-', '_')}_v1",
            "displayName": f"{spec['name']} faceless egg body draft v1",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "body-draft",
            "theme": body_id,
            "creatureKind": "egg-avatar-body",
            "caption": design_caption(spec),
            "skinId": body_id,
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No GPT Image 2 body image URL for {body_id}: {result}")
    output = review / "body-fal.png"
    download(image_url, output)
    (review / "generation.json").write_text(json.dumps({
        "id": body_id,
        "pipelineVersion": BODY_DRAFT_PIPELINE_VERSION,
        "prompt": prompt,
        "model": BODY_DRAFT_GENERATION_MODEL,
        "quality": "low",
        "references": [
            {"path": str(references[0].relative_to(ROOT)).replace("\\", "/"), "role": "exact-faceless-body-edit-target"},
            {"path": str(references[1].relative_to(ROOT)).replace("\\", "/"), "role": "character-art-style"},
            {"path": str(references[2].relative_to(ROOT)).replace("\\", "/"), "role": "runtime-lighting-palette"},
        ],
        "imageUrl": image_url,
        "recordId": record.get("id"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }, indent=2) + "\n", encoding="utf-8")


def design_caption(spec: dict[str, Any]) -> str:
    return spec["visualDesign"]["summary"]


def matte_planned_body_draft(body_id: str) -> None:
    review = planned_body_review_dir(body_id)
    raw = review / "body-fal.png"
    if not raw.exists():
        raise SystemExit(f"Missing GPT Image 2 draft: {raw}")
    print(f"matting body draft {body_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(raw.read_bytes()).decode(),
        "outputName": f"egg-avatar-body-draft-{body_id}-v1",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No BiRefNet body image URL for {body_id}: {result}")
    download(image_url, review / "body-birefnet.png")
    (review / "matting.json").write_text(json.dumps({
        "id": body_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }, indent=2) + "\n", encoding="utf-8")


def derive_body_accent(image: Image.Image) -> str:
    sample = image.convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
    colorful: list[tuple[int, int, int]] = []
    fallback: list[tuple[int, int, int]] = []
    for red, green, blue, alpha in sample.getdata():
        if alpha < 200:
            continue
        fallback.append((red, green, blue))
        high, low = max(red, green, blue), min(red, green, blue)
        if high - low >= 28 and 45 <= (red + green + blue) / 3 <= 225:
            colorful.append((red, green, blue))
    pixels = colorful or fallback
    if not pixels:
        return "#B99C72"
    pixels.sort(key=lambda color: sum(color))
    middle = pixels[len(pixels) // 2]
    return f"#{middle[0]:02X}{middle[1]:02X}{middle[2]:02X}"


def write_body_catalog(document: dict[str, Any]) -> None:
    items = document["items"]
    lines = [
        "{",
        f'  "schemaVersion": {document["schemaVersion"]},',
        f'  "category": {json.dumps(document["category"])},',
        '  "items": [',
        *[
            f"    {json.dumps(item, ensure_ascii=False)}{',' if index < len(items) - 1 else ''}"
            for index, item in enumerate(items)
        ],
        "  ]",
        "}",
    ]
    BODY_CATALOG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_item_catalog(path: Path, document: dict[str, Any]) -> None:
    items = document["items"]
    lines = [
        "{",
        f'  "schemaVersion": {document["schemaVersion"]},',
        f'  "category": {json.dumps(document["category"])},',
        '  "items": [',
        *[
            f"    {json.dumps(item, ensure_ascii=False)}{',' if index < len(items) - 1 else ''}"
            for index, item in enumerate(items)
        ],
        "  ]",
        "}",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def promote_catalog_item(
    path: Path,
    item_id: str,
    directory: str,
    *,
    presentation: dict[str, float] | None = None,
    layout_version: int | None = None,
) -> int:
    document = load_catalog(path)
    item = next(item for item in document["items"] if item["id"] == item_id)
    version = item["version"] + (1 if item["availability"] == "ready" else 0)
    item["availability"] = "ready"
    item["version"] = version
    item["assetRefs"] = {
        "high": f"assets/images/katchimeras/egg-avatars/{directory}/{item_id}.png",
        "app": f"assets/images/katchimeras/egg-avatars/{directory}/{item_id}.webp",
        "thumbnail": f"assets/images/katchimeras/egg-avatars/{directory}/thumbnails/{item_id}.webp",
    }
    if presentation is not None:
        item["presentation"] = presentation
    if layout_version is not None:
        item["layoutVersion"] = layout_version
    write_item_catalog(path, document)
    return version


def promote_planned_body_draft(body_id: str) -> None:
    review = planned_body_review_dir(body_id)
    raw = review / "body-fal.png"
    matted = review / "body-birefnet.png"
    generation_path = review / "generation.json"
    if not raw.exists() or not matted.exists() or not generation_path.exists():
        raise SystemExit(f"Missing generated body draft files for promotion: {review}")
    generation = json.loads(generation_path.read_text(encoding="utf-8"))
    if generation.get("model") != BODY_DRAFT_GENERATION_MODEL or generation.get("quality") != "low":
        raise RuntimeError(f"Body {body_id} was not generated with GPT Image 2 Edit at quality low")

    spec = load_body_specs()[body_id]
    base = normalize(matted, rgb_source=raw)
    base_outputs = save_layer_asset(base, BASES_DIR, BASE_THUMBS_DIR, body_id)

    face = Image.open(FACES_DIR / f"{DEFAULT_FACE_ID}.png").convert("RGBA")
    runtime_face_size = round(face.width * 0.92)
    runtime_face = face.resize((runtime_face_size, runtime_face_size), Image.Resampling.LANCZOS)
    composite = base.copy()
    composite.alpha_composite(
        runtime_face,
        ((composite.width - runtime_face_size) // 2, (composite.height - runtime_face_size) // 2),
    )
    outputs = save_layer_asset(composite, OUTPUT_DIR, THUMB_DIR, body_id)

    approved_at = datetime.now(timezone.utc).isoformat()
    promotion_version = spec["version"] + (1 if spec["availability"] == "ready" else 0)
    manifest = load_manifest()
    manifest.setdefault("skins", {})[body_id] = {
        "name": spec["name"],
        "version": promotion_version,
        "approvedCandidate": "auto-promoted-single-gpt-image-2-draft",
        "approvedAt": approved_at,
        "generationModel": BODY_DRAFT_GENERATION_MODEL,
        "generationQuality": "low",
        "pipelineVersion": BODY_DRAFT_PIPELINE_VERSION,
        "references": generation["references"],
        "artDirection": design_caption(spec),
        "mattingModel": MATTING_MODEL,
        "outputs": outputs,
        "faceLayoutVersion": FACE_LAYOUT["version"],
        "baseVersion": 1,
        "basePrompt": generation["prompt"],
        "baseGenerationModel": BODY_DRAFT_GENERATION_MODEL,
        "baseGenerationQuality": "low",
        "baseMattingModel": MATTING_MODEL,
        "baseMattingSettings": {
            "model": "General Use (Heavy)",
            "operatingResolution": "1024x1024",
            "refineForeground": True,
            "enclosedAlphaHoleRepair": True,
            "exteriorEdgeSource": "BiRefNet",
        },
        "baseOutputs": base_outputs,
    }
    manifest["updatedAt"] = approved_at
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    catalog = json.loads(BODY_CATALOG_PATH.read_text(encoding="utf-8"))
    item = next(item for item in catalog["items"] if item["id"] == body_id)
    item["version"] = promotion_version
    item["availability"] = "ready"
    item["assetRefs"] = {
        "high": f"assets/images/katchimeras/egg-avatars/bases/{body_id}.png",
        "app": f"assets/images/katchimeras/egg-avatars/bases/{body_id}.webp",
        "thumbnail": f"assets/images/katchimeras/egg-avatars/bases/thumbnails/{body_id}.webp",
    }
    write_body_catalog(catalog)

    accents_path = BODY_CATALOG_PATH.parent / "body-accents.json"
    accents = json.loads(accents_path.read_text(encoding="utf-8"))
    accents[body_id] = derive_body_accent(base)
    accents_path.write_text(json.dumps(accents, indent=2) + "\n", encoding="utf-8")
    print(f"promoted body {body_id} into production assets and catalog", flush=True)


def refresh_avatar_catalog_registry() -> None:
    subprocess.run(
        ["node", str(ROOT / "scripts" / "generate-egg-avatar-catalog.cjs")],
        cwd=ROOT,
        check=True,
    )


def face_review_dir(face_id: str) -> Path:
    return FACE_REVIEW_DIR / face_id


def face_prompt(face_id: str) -> str:
    spec = FACE_SPECS[face_id]
    design = spec["visualDesign"]
    return " ".join([
        "Use case: precise-object-edit. Asset type: transparent egg-avatar face expression layer.",
        "Image 1 is the exact Classic face layer and full-canvas registration edit target. Preserve its feature scale, warm friendly proportions, left/right eye anchors, brow anchors, cheek anchors, mouth anchor, front-facing camera, and square canvas placement.",
        "Image 2, Baristabbit, is the authoritative Katchimeras character-art reference. Match its simple cozy premium 3D toy language with broad clean forms, smooth softly painted materials, restrained highlights, and friendly mobile-game readability.",
        "Image 3 is the exact Today cinematic environment used at runtime. Match only its warm daylight, soft low-contrast lighting, and gentle saturation. Do not copy scenery.",
        f"Change only the expression into {spec['name']}: {design['summary']}",
        f"Palette: {', '.join(design['palette'])}.",
        f"Shape language: {design['shapeLanguage']}",
        f"Constraints: {'; '.join(design['constraints'])}.",
        "Draw only the brows, eyes, pupils and catchlights where applicable, two cheek marks where applicable, and one mouth expression. No egg shell, body color, feet, hair, hat, hand, prop, floating symbol, scenery, shadow, glow, text, logo, or extra mark.",
        "Keep every visible pixel inside the same compact central face zone as image 1. Do not zoom, crop, recenter, resize, rotate, or move the face.",
        "Render only the face layer on a perfectly uniform flat chroma-magenta #FF00FF background for BiRefNet Heavy. Do not use magenta in any face feature. The background has no gradient, texture, floor, reflection, shadow, atmosphere, or lighting variation.",
    ])


def generate_face_draft(face_id: str) -> None:
    review = face_review_dir(face_id)
    review.mkdir(parents=True, exist_ok=True)
    prompt = face_prompt(face_id)
    references = [FACES_DIR / f"{DEFAULT_FACE_ID}.png", BARISTABBIT, TODAY_RUNTIME_BACKGROUND]
    print(f"generating GPT Image 2 face {face_id} at quality low...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": FACE_GENERATION_MODEL,
        "input": {
            "image_urls": [
                image_data_uri(references[0], max_side=1536, background=(255, 0, 255)),
                image_data_uri(references[1], max_side=1024),
                image_data_uri(references[2], max_side=1024),
            ],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-face:{face_id}:v3",
        "pipelineVersion": FACE_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_face_{face_id.replace('-', '_')}_v3",
            "displayName": f"Egg avatar face {face_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "face",
            "theme": face_id,
            "creatureKind": "egg-avatar-face",
            "caption": FACE_SPECS[face_id]["visualDesign"]["summary"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No face image URL for {face_id}: {result}")
    download(image_url, review / "face-fal.png")
    (review / "generation.json").write_text(json.dumps({
        "id": face_id,
        "pipelineVersion": FACE_PIPELINE_VERSION,
        "prompt": prompt,
        "model": FACE_GENERATION_MODEL,
        "quality": "low",
        "references": [
            {"path": str(references[0].relative_to(ROOT)).replace("\\", "/"), "role": "exact-face-layout-edit-target"},
            {"path": str(references[1].relative_to(ROOT)).replace("\\", "/"), "role": "character-art-style"},
            {"path": str(references[2].relative_to(ROOT)).replace("\\", "/"), "role": "runtime-lighting-palette"},
        ],
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def matte_face_draft(face_id: str) -> None:
    review = face_review_dir(face_id)
    source = review / "face-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing generated face: {source}")
    print(f"matting face {face_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(source.read_bytes()).decode(),
        "outputName": f"egg-avatar-face-{face_id}-v3",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No face matte URL for {face_id}: {result}")
    download(image_url, review / "face-birefnet.png")
    (review / "matting.json").write_text(json.dumps({
        "id": face_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
    }, indent=2) + "\n", encoding="utf-8")

    # Save the exact automatically repaired layer used by promotion so review
    # catches both BiRefNet edge loss and any enclosed-hole restoration.
    compose_face_draft(source, review / "face-birefnet.png").save(review / "face-review.png")


def despill_chroma_edges(image: Image.Image, key: tuple[int, int, int] = (255, 0, 255)) -> Image.Image:
    """Suppress only chroma-magenta contamination in BiRefNet edge RGB."""
    image = image.convert("RGBA")
    corrected: list[tuple[int, int, int, int]] = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            corrected.append((0, 0, 0, 0))
            continue
        # BiRefNet can retain a partial- or fully-opaque one-pixel key fringe.
        # Chroma magenta is forbidden in face art, so remove only the shared
        # red/blue excess over green without dividing or amplifying channels.
        if red > 120 and blue > 120 and green + 40 < min(red, blue):
            spill = min(red, blue) - green
            red = max(0, red - spill)
            blue = max(0, blue - spill)
        # Lanczos resizing can ring a despilled edge into one or two isolated
        # green-dominant pixels. Face art contains no green, so clamp only that
        # validator-defined key-colour condition back to the neighbouring
        # red/blue channel range.
        if green > 80 and green > red * 1.4 and green > blue * 1.4:
            green = max(red, blue)
        corrected.append((red, green, blue, alpha))
    image.putdata(corrected)
    return image


def compose_face_draft(raw_path: Path, matte_path: Path) -> Image.Image:
    """Combine raw face RGB with BiRefNet alpha and restore enclosed alpha tears.

    BiRefNet remains authoritative for the exterior silhouette. A transparent
    region is restored only when it is completely disconnected from the canvas
    border, which safely recovers dark pupils or mouth interiors but cannot
    invent pixels across an eye whose damaged matte is open to the background.
    """
    raw = Image.open(raw_path).convert("RGBA")
    matte = Image.open(matte_path).convert("RGBA").resize(raw.size, Image.Resampling.LANCZOS)
    original_alpha = matte.getchannel("A")

    layered_raw = raw.copy()
    layered_raw.putalpha(original_alpha)
    repaired = repair_enclosed_alpha_holes(layered_raw)
    repaired_alpha = repaired.getchannel("A")

    # BiRefNet provides the antialiased exterior edge. Suppress only positively
    # identified chroma-magenta spill there. Untouched GPT RGB is restored only
    # in opaque interiors and proven enclosed holes.
    matte.putalpha(repaired_alpha)
    edge = despill_chroma_edges(matte)
    raw.putalpha(repaired_alpha)
    opaque_interior = repaired_alpha.point(lambda value: 255 if value > 250 else 0)
    opaque_interior = opaque_interior.filter(ImageFilter.MinFilter(5))
    repaired_holes = Image.new("L", repaired_alpha.size)
    repaired_holes.putdata([
        255 if before <= 8 and after > 8 else 0
        for before, after in zip(original_alpha.getdata(), repaired_alpha.getdata())
    ])
    repaired_holes = repaired_holes.filter(ImageFilter.MaxFilter(3))
    raw_regions = ImageChops.lighter(opaque_interior, repaired_holes)
    return Image.composite(raw, edge, raw_regions)


def promote_face_draft(face_id: str) -> None:
    review = face_review_dir(face_id)
    raw_path = review / "face-fal.png"
    matte_path = review / "face-birefnet.png"
    generation_path = review / "generation.json"
    if not raw_path.exists() or not matte_path.exists() or not generation_path.exists():
        raise SystemExit(f"Missing generated face files for {face_id}")
    generation = json.loads(generation_path.read_text(encoding="utf-8"))
    if generation.get("model") != FACE_GENERATION_MODEL or generation.get("quality") != "low":
        raise RuntimeError(f"Face {face_id} does not use GPT Image 2 Edit quality low")
    face = compose_face_draft(raw_path, matte_path).resize((2048, 2048), Image.Resampling.LANCZOS)
    face = despill_chroma_edges(face)
    magenta_pixels = sum(
        1
        for red, green, blue, alpha in face.getdata()
        if alpha > 8 and red > 120 and blue > 120 and green + 40 < min(red, blue)
    )
    if magenta_pixels:
        raise RuntimeError(f"Face {face_id} retains {magenta_pixels} visible chroma-magenta pixels")
    bounds = face.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible face in {matte_path}")
    allowed = tuple(round(value * 2048) for value in FACE_REMOVAL_BOUNDS)
    if bounds[0] < allowed[0] or bounds[1] < allowed[1] or bounds[2] > allowed[2] or bounds[3] > allowed[3]:
        raise RuntimeError(f"Face {face_id} escapes canonical face bounds: {bounds}")
    face.save(review / "face-review.png")
    review_composite = Image.open(BASES_DIR / "classic.png").convert("RGBA")
    review_composite.alpha_composite(face)
    review_composite.save(review / "face-composite.png")
    outputs = save_layer_asset(face, FACES_DIR, FACE_THUMBS_DIR, face_id)
    version = promote_catalog_item(FACE_CATALOG_PATH, face_id, "faces")
    manifest = load_manifest()
    manifest.setdefault("faces", {})[face_id] = {
        "name": FACE_SPECS[face_id]["name"],
        "version": version,
        "faceLayoutVersion": FACE_LAYOUT["version"],
        "pipelineVersion": FACE_PIPELINE_VERSION,
        "generationModel": FACE_GENERATION_MODEL,
        "generationQuality": "low",
        "prompt": generation["prompt"],
        "references": generation["references"],
        "mattingModel": MATTING_MODEL,
        "mattingSettings": {
            "model": "General Use (Heavy)",
            "refineForeground": True,
            "enclosedAlphaHoleRepair": True,
            "chromaEdgeDespill": "red-blue dominance suppression for #FF00FF",
            "exteriorEdgeSource": "BiRefNet",
        },
        "outputs": outputs,
        "layerBounds": list(FACE_LAYER_BOUNDS),
    }
    manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"promoted face {face_id}", flush=True)


def run_face_pipeline(face_ids: tuple[str, ...], *, phase: str, review_only: bool = False) -> None:
    for face_id in face_ids:
        if phase == "render":
            generate_face_draft(face_id)
            matte_face_draft(face_id)
            if not review_only:
                promote_face_draft(face_id)
        elif phase == "matte":
            matte_face_draft(face_id)
            if not review_only:
                promote_face_draft(face_id)
        else:
            promote_face_draft(face_id)
    if review_only:
        print(f"Created {len(face_ids)} face review draft(s) under {FACE_REVIEW_DIR.relative_to(ROOT)}.", flush=True)
    else:
        refresh_avatar_catalog_registry()
        print(f"Generated and promoted {len(face_ids)} face customization(s).", flush=True)


def run_planned_body_drafts(
    body_ids: tuple[str, ...],
    *,
    phase: str,
    review_only: bool,
) -> None:
    for body_id in body_ids:
        if phase == "render":
            generate_planned_body_draft(body_id)
            matte_planned_body_draft(body_id)
        elif phase == "matte":
            matte_planned_body_draft(body_id)
        if not review_only:
            promote_planned_body_draft(body_id)
    if not review_only:
        refresh_avatar_catalog_registry()
        print(f"Generated and promoted {len(body_ids)} body customization(s).")
    else:
        print(f"Created {len(body_ids)} review-only body draft(s) under {BODY_DRAFT_REVIEW_DIR.relative_to(ROOT)}.")


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


def accessory_ready_body_prompt(skin_id: str) -> str:
    removals = {
        "moss": "Remove the complete top sprout and its leaves. Keep the lower moss clusters.",
        "barista": "Remove the complete brown beret. Keep the small coffee pocket on the lower shell.",
        "pumpkin": "Remove the complete top stem. Keep the orange pumpkin shell, lobes, lower side vines, and leaves.",
    }
    return " ".join([
        "This is a precise production asset edit of image 1, not a redesign.",
        "Create the same egg as a clean faceless body base for a layered avatar system.",
        removals[skin_id],
        "Remove the complete face: eyebrows, eyes, eye highlights, mouth, and both blush marks.",
        "Regenerate the newly exposed shell naturally; it must be solid, continuous, intact, and free of holes or ghost outlines.",
        "Preserve the exact egg identity, shell material, palette, markings, feet, proportions, front camera, lighting direction, and canvas placement.",
        "Add no replacement hat, headwear, top ornament, face, text, scenery, platform, cast shadow, or extra object.",
        "Place the one complete egg on a perfectly uniform flat pure-black #000000 background for BiRefNet Heavy.",
        STYLE_LOCK,
        NEGATIVES,
    ])


def generate_accessory_ready_base(source_dir: Path, skin_id: str) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    prompt = accessory_ready_body_prompt(skin_id)
    print(f"generating accessory-ready FAL base for {skin_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": GENERATION_MODEL,
        "input": {
            "image_urls": [image_data_uri(OUTPUT_DIR / f"{skin_id}.png", max_side=1536)],
            "aspect_ratio": "1:1",
            "resolution": "2K",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-accessory-ready:{skin_id}:body-v1",
        "skinId": skin_id,
        "pipelineVersion": PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_{skin_id}_accessory_ready_body_v1",
            "displayName": f"{SKINS[skin_id]['name']} accessory-ready egg body v1",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "body",
            "theme": skin_id,
            "creatureKind": "egg-avatar-body",
            "caption": "faceless body with removable head accessory",
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No FAL body image URL for {skin_id}: {result}")
    download(image_url, source_dir / f"{skin_id}-keyed-fal.png")
    (source_dir / f"{skin_id}-generation.json").write_text(json.dumps({
        "skinId": skin_id,
        "prompt": prompt,
        "model": GENERATION_MODEL,
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def matte_accessory_ready_base(source_dir: Path, skin_id: str) -> None:
    keyed = source_dir / f"{skin_id}-keyed-fal.png"
    if not keyed.exists():
        raise SystemExit(f"Missing FAL source: {keyed}")
    print(f"matting accessory-ready {skin_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(keyed.read_bytes()).decode(),
        "outputName": f"egg-avatar-{skin_id}-accessory-ready-v1",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No BiRefNet image URL for {skin_id}: {result}")
    download(image_url, source_dir / f"{skin_id}-birefnet.png")
    (source_dir / f"{skin_id}-matting.json").write_text(json.dumps({
        "skinId": skin_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
    }, indent=2) + "\n", encoding="utf-8")


def approve_accessory_ready_base(source_dir: Path, skin_id: str) -> None:
    keyed = source_dir / f"{skin_id}-keyed-fal.png"
    birefnet = source_dir / f"{skin_id}-birefnet.png"
    if not keyed.exists() or not birefnet.exists():
        raise SystemExit(f"Missing generated or BiRefNet source for {skin_id}")
    # BiRefNet owns the exterior edge. The existing flood-fill repair restores
    # only fully enclosed alpha tears, while raw FAL pixels supply their colour.
    body = normalize(birefnet, rgb_source=keyed)
    outputs = save_layer_asset(body, BASES_DIR, BASE_THUMBS_DIR, skin_id)
    manifest = load_manifest()
    entry = manifest["skins"][skin_id]
    entry["baseVersion"] = 2
    entry["basePrompt"] = accessory_ready_body_prompt(skin_id)
    entry["baseGenerationModel"] = GENERATION_MODEL
    entry["baseMattingModel"] = MATTING_MODEL
    entry["baseMattingSettings"] = {
        "model": "General Use (Heavy)",
        "operatingResolution": "1024x1024",
        "refineForeground": True,
        "enclosedAlphaHoleRepair": True,
        "exteriorEdgeSource": "BiRefNet",
    }
    entry.pop("baseEditMask", None)
    entry["baseOutputs"] = outputs
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved accessory-ready FAL/BiRefNet base for {skin_id}")


def accessory_prompt(accessory_id: str) -> str:
    spec = ACCESSORY_SPECS[accessory_id]
    if spec["slot"] == "hat":
        fit = (
            "Create only the wearable head accessory, front-facing with a gentle concave underside that follows the crown of the egg in image 1. "
            "Keep its silhouette broad and compact; it must fit entirely above the face without covering the eyes. Do not render the egg."
        )
    else:
        fit = (
            "Create only the side-held prop, upright in a front three-quarter view for placement at the viewer-right side of the egg in image 1. "
            "Do not render a hand, arm, holder, egg, character, or support."
        )
    return " ".join([
        "Image 1 is the strict Katchimeras material, lighting, camera, and scale reference; do not copy its body or face.",
        f"Generate {spec['direction']}.",
        fit,
        "Premium cozy 3D toy-game art, broad rounded forms, tactile painted material, warm upper-left key light, restrained soft highlights, readable mobile-game silhouette.",
        "Center the single complete object on a perfectly uniform flat pure-black #000000 background for BiRefNet Heavy.",
        "No floor, cast shadow, scenery, text, logo, watermark, border, checkerboard, extra object, or cropped edge.",
    ])


def hat_front_prompt(accessory_id: str) -> str:
    spec = ACCESSORY_SPECS[accessory_id]
    if spec["slot"] != "hat":
        raise ValueError(f"{accessory_id} is not a hat")
    return " ".join([
        "Image 1 is the exact egg character and canvas placement reference.",
        f"Draw {spec['direction']} for this egg character.",
        "The hat will be layered directly on top of image 1 in the app.",
        "Draw only the front part of the hat layer that will show when fitted on this egg image.",
        "The visible lower edge must overlap the top of the egg enough to preserve the egg's rounded head shape.",
        "Do not draw an underside, inside, rear brim, back layer, hidden surface, egg, face, feet, body, pedestal, hand, or extra object.",
        "Preserve image 1's exact camera, zoom, and full square canvas registration. Do not zoom in on the hat or turn it into a centered product shot.",
        "Keep every hat pixel within the top 34 percent of the original canvas. Its lowest front edge sits just over the egg crown and remains entirely above the eyebrows and face.",
        "The result must overlay image 1 at 1:1 with no scaling, cropping, recentering, or repositioning.",
        "Match image 1's simple cozy premium 3D toy art, soft rounded forms, warm lighting, restrained detail, and mobile-game finish exactly.",
        "Render only that single visible-front hat layer on a perfectly uniform pure-black #000000 background with no floor, cast shadow, glow, scenery, text, logo, watermark, border, or checkerboard.",
    ])


def hat_style_prompt(accessory_id: str) -> str:
    spec = ACCESSORY_SPECS[accessory_id]
    return " ".join([
        "Use case: precise-object-edit. Asset type: final visible-front egg avatar hat layer.",
        "Image 1 is the exact approved hat geometry and the edit target. Preserve its silhouette, front-only construction, lower contact edge, scale, position, perspective, design, colors, and full square canvas registration.",
        "Image 2, Baristabbit, is the authoritative Katchimeras character-art reference. Map image 1 to its simple cozy premium 3D toy language: broad rounded forms, smooth softly painted materials, clean transitions, restrained highlights, and friendly mobile-game readability.",
        "Image 3 is the exact Today cinematic home environment used at runtime. Match only its warm daylight, soft low-contrast lighting, gentle saturation, and simplified toy-diorama finish. Do not copy its scenery, pedestal, nest, trees, path, sky, or objects.",
        f"Restyle {spec['direction']} from image 1 without redesigning it.",
        "Reduce surface detail strongly. Use smooth simple color fields and a few broad form-defining cues only.",
        "No realistic fibers, individual yarn strands, fabric fuzz, leather grain, embossing, pores, scratches, microtexture, noisy bump mapping, tiny stitching, photographic material detail, or hyper-detailed surface variation.",
        "Keep only the visible front layer. Do not add an underside, inside, rear brim, back layer, hidden surface, egg, face, feet, body, pedestal, hand, cast shadow, or extra object.",
        "Render that one style-mapped hat on a perfectly uniform pure-black #000000 background. Do not zoom, crop, recenter, resize, rotate, or move it.",
        "No scenery, floor, glow, text, logo, watermark, border, checkerboard, or additional object.",
    ])


def generate_hat_front(accessory_id: str) -> None:
    if accessory_id not in HAT_IDS:
        raise SystemExit(f"{accessory_id} is not a supported hat")
    review = hat_review_dir(accessory_id)
    review.mkdir(parents=True, exist_ok=True)
    prompt = hat_front_prompt(accessory_id)
    print(f"generating direct visible-front hat {accessory_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": HAT_GENERATION_MODEL,
        "input": {
            "image_urls": [black_backed_data_uri(CLASSIC_APPROVED)],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-hat-geometry:{accessory_id}:v4",
        "pipelineVersion": HAT_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_hat_geometry_{accessory_id.replace('-', '_')}_v4",
            "displayName": f"Visible-front egg avatar hat geometry {accessory_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "hat-front",
            "theme": accessory_id,
            "creatureKind": "egg-avatar-hat-front",
            "caption": ACCESSORY_SPECS[accessory_id]["direction"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No direct hat image URL for {accessory_id}: {result}")
    download(image_url, review / "geometry-fal.png")
    (review / "geometry-generation.json").write_text(json.dumps({
        "id": accessory_id,
        "pipelineVersion": HAT_PIPELINE_VERSION,
        "prompt": prompt,
        "model": HAT_GENERATION_MODEL,
        "quality": "low",
        "reference": {
            "path": str(CLASSIC_APPROVED.relative_to(ROOT)).replace("\\", "/"),
            "role": "exact-egg-geometry-style-and-placement",
        },
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def restyle_hat_front(accessory_id: str, *, use_production_source: bool) -> None:
    review = hat_review_dir(accessory_id)
    review.mkdir(parents=True, exist_ok=True)
    source = OUTPUT_DIR / "hats" / f"{accessory_id}.png" if use_production_source else review / "geometry-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing hat geometry source for {accessory_id}: {source}")
    prompt = hat_style_prompt(accessory_id)
    print(f"style-mapping visible-front hat {accessory_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": HAT_GENERATION_MODEL,
        "input": {
            "image_urls": [
                black_backed_data_uri(source),
                image_data_uri(BARISTABBIT, max_side=1024),
                image_data_uri(TODAY_RUNTIME_BACKGROUND, max_side=1024),
            ],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-hat-style:{accessory_id}:v4",
        "pipelineVersion": HAT_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_hat_style_{accessory_id.replace('-', '_')}_v4",
            "displayName": f"Style-mapped visible-front egg avatar hat {accessory_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "hat-front-style-map",
            "theme": accessory_id,
            "creatureKind": "egg-avatar-hat-front",
            "caption": ACCESSORY_SPECS[accessory_id]["direction"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No style-mapped hat image URL for {accessory_id}: {result}")
    download(image_url, review / "front-fal.png")
    (review / "front-generation.json").write_text(json.dumps({
        "id": accessory_id,
        "stage": "style-map",
        "pipelineVersion": HAT_PIPELINE_VERSION,
        "styleContractVersion": HAT_STYLE_CONTRACT_VERSION,
        "prompt": prompt,
        "model": HAT_GENERATION_MODEL,
        "quality": "low",
        "references": [
            {"path": str(source.relative_to(ROOT)).replace("\\", "/"), "role": "exact-hat-geometry-edit-target"},
            {"path": str(BARISTABBIT.relative_to(ROOT)).replace("\\", "/"), "role": "character-art-style"},
            {"path": str(TODAY_RUNTIME_BACKGROUND.relative_to(ROOT)).replace("\\", "/"), "role": "runtime-lighting-palette"},
        ],
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def hat_review_dir(accessory_id: str) -> Path:
    return HAT_REVIEW_DIR / accessory_id


def cover_image(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def matte_hat_front(accessory_id: str) -> None:
    review = hat_review_dir(accessory_id)
    source = review / "front-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing direct FAL source: {source}")
    print(f"matting direct visible-front hat {accessory_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(source.read_bytes()).decode(),
        "outputName": f"egg-avatar-hat-front-{accessory_id}-v4",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No direct hat matte URL for {accessory_id}: {result}")
    download(image_url, review / "front-birefnet.png")
    (review / "front-matting.json").write_text(json.dumps({
        "id": accessory_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
    }, indent=2) + "\n", encoding="utf-8")


def load_matted_hat_source(accessory_id: str) -> Image.Image:
    review = hat_review_dir(accessory_id)
    raw_path = review / "front-fal.png"
    matte_path = review / "front-birefnet.png"
    if not raw_path.exists() or not matte_path.exists():
        raise SystemExit(f"Missing direct generated or BiRefNet source for {accessory_id}")
    raw = Image.open(raw_path).convert("RGBA")
    matte = Image.open(matte_path).convert("RGBA")
    if raw.width != raw.height or matte.width != matte.height:
        raise RuntimeError(f"Hat source must remain square: raw={raw.size}, matte={matte.size}")
    alpha = matte.getchannel("A")
    if alpha.size != raw.size:
        alpha = alpha.resize(raw.size, Image.Resampling.LANCZOS)
    raw.putalpha(alpha)
    interior = alpha.point(lambda value: 255 if value > 250 else 0).filter(ImageFilter.MinFilter(9))
    art = Image.composite(raw, matte.resize(raw.size, Image.Resampling.LANCZOS), interior)
    return art.resize((2048, 2048), Image.Resampling.LANCZOS)


def fit_layer_presentation(
    source_bounds: tuple[int, int, int, int],
    allowed_bounds: tuple[int, int, int, int],
) -> dict[str, float]:
    source_width = source_bounds[2] - source_bounds[0]
    source_height = source_bounds[3] - source_bounds[1]
    allowed_width = allowed_bounds[2] - allowed_bounds[0]
    allowed_height = allowed_bounds[3] - allowed_bounds[1]
    scale = min(1.0, allowed_width / source_width, allowed_height / source_height)
    scaled_left = 1024 + (source_bounds[0] - 1024) * scale
    scaled_right = 1024 + (source_bounds[2] - 1024) * scale
    scaled_bottom = 1024 + (source_bounds[3] - 1024) * scale
    target_center_x = (allowed_bounds[0] + allowed_bounds[2]) / 2
    offset_x = target_center_x - (scaled_left + scaled_right) / 2
    offset_y = allowed_bounds[3] - scaled_bottom
    return {
        "scale": round(scale, 4),
        "offsetX": round(offset_x / 2048, 4),
        "offsetY": round(offset_y / 2048, 4),
    }


def presented_bounds(source_bounds: tuple[int, int, int, int], presentation: dict[str, float]) -> tuple[int, int, int, int]:
    scale = presentation["scale"]
    offset_x = presentation["offsetX"] * 2048
    offset_y = presentation["offsetY"] * 2048
    return tuple(
        round(1024 + (value - 1024) * scale + (offset_x if index % 2 == 0 else offset_y))
        for index, value in enumerate(source_bounds)
    )


def approve_hat_front(accessory_id: str) -> None:
    review = hat_review_dir(accessory_id)
    matte_path = review / "front-birefnet.png"
    metadata_path = review / "front-generation.json"
    if not matte_path.exists() or not metadata_path.exists():
        raise SystemExit(f"Missing direct generated or BiRefNet source for {accessory_id}")
    generation = json.loads(metadata_path.read_text(encoding="utf-8"))
    if generation.get("model") != HAT_GENERATION_MODEL:
        raise RuntimeError(f"Reviewed hat {accessory_id} was not generated with {HAT_GENERATION_MODEL}")
    if generation.get("quality") != "low":
        raise RuntimeError(f"Reviewed hat {accessory_id} was not generated at GPT Image quality low")
    if generation.get("pipelineVersion") != HAT_PIPELINE_VERSION:
        raise RuntimeError(f"Reviewed hat {accessory_id} uses a stale pipeline version")
    if generation.get("styleContractVersion") != HAT_STYLE_CONTRACT_VERSION:
        raise RuntimeError(f"Reviewed hat {accessory_id} uses a stale or missing style contract")
    if generation.get("stage") != "style-map":
        raise RuntimeError(f"Reviewed hat {accessory_id} did not complete the required style-map stage")
    references = generation.get("references")
    expected_style_references = {
        ("character-art-style", str(BARISTABBIT.relative_to(ROOT)).replace("\\", "/")),
        ("runtime-lighting-palette", str(TODAY_RUNTIME_BACKGROUND.relative_to(ROOT)).replace("\\", "/")),
    }
    recorded_style_references = {
        (reference.get("role"), reference.get("path"))
        for reference in references
        if isinstance(reference, dict)
    } if isinstance(references, list) else set()
    if not any(
        isinstance(reference, dict) and reference.get("role") == "exact-hat-geometry-edit-target"
        for reference in references or []
    ):
        raise RuntimeError(f"Reviewed hat {accessory_id} is missing its exact geometry edit target")
    if not expected_style_references.issubset(recorded_style_references):
        raise RuntimeError(f"Reviewed hat {accessory_id} is missing the locked Baristabbit or Today style reference")
    # Preserve normalized full-canvas placement. Never crop, recenter, or fit to
    # a generic box: those operations reintroduce the floating-hat defect.
    canvas = load_matted_hat_source(accessory_id)
    source_bounds = canvas.getchannel("A").getbbox()
    if not source_bounds:
        raise RuntimeError(f"No visible hat in {matte_path}")
    allowed = tuple(round(value * 2048) for value in ACCESSORY_BOUNDS["hat"])
    catalog_item = ACCESSORY_SPECS[accessory_id]["item"]
    presentation = catalog_item.get("presentation") or fit_layer_presentation(source_bounds, allowed)
    bounds = presented_bounds(source_bounds, presentation)
    if bounds[0] < allowed[0] - 4 or bounds[1] < allowed[1] - 4 or bounds[2] > allowed[2] + 4 or bounds[3] > allowed[3] + 4:
        raise RuntimeError(f"Direct hat {accessory_id} escapes canonical bounds: {bounds} not within {allowed}")
    directory = OUTPUT_DIR / "hats"
    outputs = save_layer_asset(canvas, directory, directory / "thumbnails", accessory_id)
    manifest = load_manifest()
    manifest["artDirectionVersion"] = max(6, int(manifest.get("artDirectionVersion", 0)))
    accessories = manifest.setdefault("accessories", {})
    accessories["hatLayoutVersion"] = 2
    accessories["hatPipelineVersion"] = HAT_PIPELINE_VERSION
    accessories["hatStyleContractVersion"] = HAT_STYLE_CONTRACT_VERSION
    accessories["hatReferences"] = [
        {"path": "assets/images/katchimeras/egg-avatars/hats/<hat-id>.png", "role": "exact-hat-geometry-edit-target"},
        {"path": str(BARISTABBIT.relative_to(ROOT)).replace("\\", "/"), "role": "character-art-style"},
        {"path": str(TODAY_RUNTIME_BACKGROUND.relative_to(ROOT)).replace("\\", "/"), "role": "runtime-lighting-palette"},
    ]
    entry = accessories.setdefault("hats", {}).setdefault(accessory_id, {})
    catalog_version = promote_catalog_item(HAT_CATALOG_PATH, accessory_id, "hats", presentation=presentation)
    entry["version"] = catalog_version
    entry["accessoryLayoutVersion"] = 2
    entry["pipelineVersion"] = HAT_PIPELINE_VERSION
    entry["styleContractVersion"] = HAT_STYLE_CONTRACT_VERSION
    entry.pop("selectedFitCandidate", None)
    entry.pop("fitPrompt", None)
    entry.pop("extractionPrompt", None)
    entry["prompt"] = generation["prompt"]
    entry["generationStage"] = generation.get("stage", "style-map")
    entry["generationModel"] = HAT_GENERATION_MODEL
    entry["generationQuality"] = generation["quality"]
    entry["presentation"] = presentation
    entry["mattingModel"] = MATTING_MODEL
    entry["mattingSettings"] = {"model": "General Use (Heavy)", "refineForeground": True, "preserveNegativeSpace": True}
    entry["normalization"] = "full-canvas-resize-only; no crop, recenter, or slot fitting"
    entry["outputs"] = outputs
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved direct visible-front hat {accessory_id}")


def runtime_layer(image: Image.Image, scale: float, offset_x: float, offset_y: float) -> Image.Image:
    size = round(2048 * scale)
    resized = image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    left = round((2048 - size) / 2 + offset_x * 2048)
    top = round((2048 - size) / 2 + offset_y * 2048)
    canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (left, top))
    return canvas


def make_hat_sheet(accessory_ids: tuple[str, ...], *, review_sources: bool, filename: str) -> Path:
    cell_size = 384
    background = cover_image(Image.open(TODAY_RUNTIME_BACKGROUND).convert("RGBA"), (cell_size, cell_size))
    face = Image.open(FACES_DIR / f"{DEFAULT_FACE_ID}.png").convert("RGBA")
    hats = {
        accessory_id: (
            load_matted_hat_source(accessory_id)
            if review_sources
            else Image.open(OUTPUT_DIR / "hats" / f"{accessory_id}.png").convert("RGBA")
        )
        for accessory_id in accessory_ids
    }
    sheet = Image.new("RGBA", (cell_size * len(accessory_ids), cell_size * len(BODY_PRESENTATIONS)), (30, 24, 20, 255))
    for row, (skin_id, (body_scale, body_x, body_y)) in enumerate(BODY_PRESENTATIONS.items()):
        body = Image.open(BASES_DIR / f"{skin_id}.png").convert("RGBA")
        body_layer = runtime_layer(body, body_scale, body_x, body_y)
        face_layer = runtime_layer(face, 0.92, 0, 0)
        for column, accessory_id in enumerate(accessory_ids):
            hat = hats[accessory_id]
            catalog_item = ACCESSORY_SPECS[accessory_id]["item"]
            allowed = tuple(round(value * 2048) for value in ACCESSORY_BOUNDS["hat"])
            source_bounds = hat.getchannel("A").getbbox()
            if not source_bounds:
                raise RuntimeError(f"No visible hat for review: {accessory_id}")
            presentation = catalog_item.get("presentation") or fit_layer_presentation(source_bounds, allowed)
            hat_layer = runtime_layer(
                hat,
                body_scale * presentation["scale"],
                body_x + presentation["offsetX"],
                body_y + presentation["offsetY"],
            )
            composite = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
            composite.alpha_composite(body_layer)
            composite.alpha_composite(face_layer)
            composite.alpha_composite(hat_layer)
            cell = background.copy()
            cell.alpha_composite(composite.resize((cell_size, cell_size), Image.Resampling.LANCZOS))
            label = Image.new("RGBA", (cell_size, 30), (34, 26, 21, 190))
            ImageDraw.Draw(label).text((10, 9), f"{skin_id} / {accessory_id}", fill=(255, 247, 232, 255))
            cell.alpha_composite(label)
            sheet.alpha_composite(cell, (column * cell_size, row * cell_size))
    HAT_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    path = HAT_REVIEW_DIR / filename
    sheet.convert("RGB").save(path, quality=92)
    print(path.relative_to(ROOT))
    return path


def make_hat_compatibility_sheet() -> Path:
    ready_ids = tuple(accessory_id for accessory_id in HAT_IDS if (OUTPUT_DIR / "hats" / f"{accessory_id}.png").exists())
    return make_hat_sheet(ready_ids, review_sources=False, filename="compatibility-sheet.png")


def make_hat_review_sheet(accessory_ids: tuple[str, ...]) -> Path:
    suffix = "all" if accessory_ids == HAT_IDS else "-".join(accessory_ids)
    return make_hat_sheet(accessory_ids, review_sources=True, filename=f"review-sheet-{suffix}.png")


def run_hat_pipeline(accessory_ids: tuple[str, ...], *, phase: str) -> None:
    if phase == "promote":
        for accessory_id in accessory_ids:
            approve_hat_front(accessory_id)
        refresh_avatar_catalog_registry()
        path = make_hat_compatibility_sheet()
        print(f"Promoted reviewed hat source(s). Verify production compatibility: {path.relative_to(ROOT)}")
        return
    for accessory_id in accessory_ids:
        if phase == "render":
            generate_hat_front(accessory_id)
            restyle_hat_front(accessory_id, use_production_source=False)
        else:
            restyle_hat_front(accessory_id, use_production_source=True)
        matte_hat_front(accessory_id)
    path = make_hat_review_sheet(accessory_ids)
    print("Generation stopped at the required human review gate.")
    print(f"Review the raw source, BiRefNet matte, and composite sheet: {path.relative_to(ROOT)}")
    target = "all" if accessory_ids == HAT_IDS else accessory_ids[0]
    print(f"After visual approval, run: python scripts/generate-egg-avatar-skins.py hat-pipeline {target} promote")


def held_review_dir(accessory_id: str) -> Path:
    return HELD_REVIEW_DIR / accessory_id


def held_front_prompt(accessory_id: str) -> str:
    spec = ACCESSORY_SPECS[accessory_id]
    return " ".join([
        "Use case: precise-object-edit. Asset type: side-held egg-avatar prop layer without a hand.",
        "Image 1 is the exact egg character and full square canvas placement reference.",
        f"Draw {spec['direction']} for this egg character.",
        "The prop will be layered directly on top of image 1 at the viewer-right side of the egg.",
        "Draw only the complete visible prop layer. Do not draw any hand, fingers, arm, sleeve, holder, egg, character, face, feet, pedestal, or support.",
        "Place the prop upright beside and slightly overlapping the egg's viewer-right edge, inside the rightmost 30 percent of the original canvas and between 38 and 90 percent of canvas height. Keep it clear of the eyes, cheek, and mouth.",
        "Preserve image 1's exact camera, zoom, and square canvas registration. The result must overlay image 1 at 1:1 with no scaling, cropping, recentering, or repositioning.",
        "Match image 1's simple cozy premium 3D toy art, broad rounded forms, warm lighting, restrained detail, and mobile-game finish.",
        "Render only that single prop on a perfectly uniform pure-black #000000 background for BiRefNet Heavy. No floor, cast shadow, glow, scenery, text, logo, watermark, border, checkerboard, or extra object.",
    ])


def held_style_prompt(accessory_id: str) -> str:
    spec = ACCESSORY_SPECS[accessory_id]
    return " ".join([
        "Use case: precise-object-edit. Asset type: final side-held egg-avatar prop layer without a hand.",
        "Image 1 is the exact approved prop geometry and edit target. Preserve its silhouette, negative spaces, scale, viewer-right position, perspective, design, colors, and full square canvas registration.",
        "Image 2, Baristabbit, is the authoritative Katchimeras character-art reference. Map image 1 to its simple cozy premium 3D toy language: broad rounded forms, smooth softly painted materials, clean transitions, restrained highlights, and friendly mobile-game readability.",
        "Image 3 is the exact Today cinematic home environment used at runtime. Match only its warm daylight, soft low-contrast lighting, gentle saturation, and simplified toy-diorama finish. Do not copy its scenery or pedestal.",
        f"Restyle {spec['direction']} from image 1 without redesigning or moving it.",
        "Reduce surface detail strongly. Use smooth simple color fields and a few broad form-defining cues only. No realistic fibers, grain, scratches, microtexture, tiny stitching, photographic detail, or noisy bump mapping.",
        "Keep only the prop. Do not add a hand, fingers, arm, sleeve, holder, egg, character, face, feet, pedestal, support, cast shadow, or extra object.",
        "Render the one style-mapped prop on a perfectly uniform pure-black #000000 background. Do not zoom, crop, recenter, resize, rotate, or move it.",
        "No scenery, floor, glow, text, logo, watermark, border, checkerboard, or additional object.",
    ])


def generate_held_front(accessory_id: str) -> None:
    review = held_review_dir(accessory_id)
    review.mkdir(parents=True, exist_ok=True)
    prompt = held_front_prompt(accessory_id)
    print(f"generating direct side-held prop {accessory_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": HELD_GENERATION_MODEL,
        "input": {
            "image_urls": [black_backed_data_uri(CLASSIC_APPROVED)],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-held-geometry:{accessory_id}:v2",
        "pipelineVersion": HELD_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_held_geometry_{accessory_id.replace('-', '_')}_v2",
            "displayName": f"Side-held egg avatar prop geometry {accessory_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "held-geometry",
            "theme": accessory_id,
            "creatureKind": "egg-avatar-held",
            "caption": ACCESSORY_SPECS[accessory_id]["direction"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No held geometry URL for {accessory_id}: {result}")
    download(image_url, review / "geometry-fal.png")
    (review / "geometry-generation.json").write_text(json.dumps({
        "id": accessory_id,
        "pipelineVersion": HELD_PIPELINE_VERSION,
        "prompt": prompt,
        "model": HELD_GENERATION_MODEL,
        "quality": "low",
        "reference": {"path": str(CLASSIC_APPROVED.relative_to(ROOT)).replace("\\", "/"), "role": "exact-egg-placement-reference"},
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def restyle_held_front(accessory_id: str, *, use_production_source: bool) -> None:
    review = held_review_dir(accessory_id)
    source = OUTPUT_DIR / "held" / f"{accessory_id}.png" if use_production_source else review / "geometry-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing held geometry source for {accessory_id}: {source}")
    prompt = held_style_prompt(accessory_id)
    print(f"style-mapping side-held prop {accessory_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": HELD_GENERATION_MODEL,
        "input": {
            "image_urls": [
                black_backed_data_uri(source),
                image_data_uri(BARISTABBIT, max_side=1024),
                image_data_uri(TODAY_RUNTIME_BACKGROUND, max_side=1024),
            ],
            "image_size": "square_hd",
            "quality": "low",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-held-style:{accessory_id}:v2",
        "pipelineVersion": HELD_PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_held_style_{accessory_id.replace('-', '_')}_v2",
            "displayName": f"Style-mapped side-held egg avatar prop {accessory_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": "held-style-map",
            "theme": accessory_id,
            "creatureKind": "egg-avatar-held",
            "caption": ACCESSORY_SPECS[accessory_id]["direction"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No style-mapped held URL for {accessory_id}: {result}")
    download(image_url, review / "front-fal.png")
    (review / "front-generation.json").write_text(json.dumps({
        "id": accessory_id,
        "stage": "style-map",
        "pipelineVersion": HELD_PIPELINE_VERSION,
        "styleContractVersion": HAT_STYLE_CONTRACT_VERSION,
        "prompt": prompt,
        "model": HELD_GENERATION_MODEL,
        "quality": "low",
        "references": [
            {"path": str(source.relative_to(ROOT)).replace("\\", "/"), "role": "exact-held-geometry-edit-target"},
            {"path": str(BARISTABBIT.relative_to(ROOT)).replace("\\", "/"), "role": "character-art-style"},
            {"path": str(TODAY_RUNTIME_BACKGROUND.relative_to(ROOT)).replace("\\", "/"), "role": "runtime-lighting-palette"},
        ],
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def matte_held_front(accessory_id: str) -> None:
    review = held_review_dir(accessory_id)
    source = review / "front-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing held FAL source: {source}")
    print(f"matting side-held prop {accessory_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(source.read_bytes()).decode(),
        "outputName": f"egg-avatar-held-{accessory_id}-v2",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No held matte URL for {accessory_id}: {result}")
    download(image_url, review / "front-birefnet.png")
    (review / "front-matting.json").write_text(json.dumps({
        "id": accessory_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
    }, indent=2) + "\n", encoding="utf-8")


def promote_held_front(accessory_id: str) -> None:
    review = held_review_dir(accessory_id)
    raw_path = review / "front-fal.png"
    matte_path = review / "front-birefnet.png"
    metadata_path = review / "front-generation.json"
    if not raw_path.exists() or not matte_path.exists() or not metadata_path.exists():
        raise SystemExit(f"Missing held files for promotion: {accessory_id}")
    generation = json.loads(metadata_path.read_text(encoding="utf-8"))
    if generation.get("model") != HELD_GENERATION_MODEL or generation.get("quality") != "low":
        raise RuntimeError(f"Held prop {accessory_id} does not use GPT Image 2 Edit quality low")
    if generation.get("pipelineVersion") != HELD_PIPELINE_VERSION or generation.get("stage") != "style-map":
        raise RuntimeError(f"Held prop {accessory_id} did not complete the v2 style-map pipeline")
    raw = Image.open(raw_path).convert("RGBA")
    matte = Image.open(matte_path).convert("RGBA").resize(raw.size, Image.Resampling.LANCZOS)
    raw.putalpha(matte.getchannel("A"))
    canvas = raw.resize((2048, 2048), Image.Resampling.LANCZOS)
    bounds = canvas.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible held prop in {matte_path}")
    allowed = tuple(round(value * 2048) for value in ACCESSORY_BOUNDS["held"])
    presentation = fit_layer_presentation(bounds, allowed)
    fitted_bounds = presented_bounds(bounds, presentation)
    if fitted_bounds[0] < allowed[0] - 4 or fitted_bounds[1] < allowed[1] - 4 or fitted_bounds[2] > allowed[2] + 4 or fitted_bounds[3] > allowed[3] + 4:
        raise RuntimeError(f"Held prop {accessory_id} escapes canonical bounds after presentation: {fitted_bounds} not within {allowed}")
    directory = OUTPUT_DIR / "held"
    outputs = save_layer_asset(canvas, directory, directory / "thumbnails", accessory_id)
    version = promote_catalog_item(
        HELD_CATALOG_PATH,
        accessory_id,
        "held",
        presentation=presentation,
        layout_version=2,
    )
    manifest = load_manifest()
    accessories = manifest.setdefault("accessories", {})
    accessories["heldLayoutVersion"] = 2
    accessories["heldPipelineVersion"] = HELD_PIPELINE_VERSION
    accessories["heldStyleContractVersion"] = HAT_STYLE_CONTRACT_VERSION
    entry = accessories.setdefault("held", {}).setdefault(accessory_id, {})
    entry.update({
        "version": version,
        "accessoryLayoutVersion": 2,
        "pipelineVersion": HELD_PIPELINE_VERSION,
        "styleContractVersion": HAT_STYLE_CONTRACT_VERSION,
        "prompt": generation["prompt"],
        "generationStage": "style-map",
        "generationModel": HELD_GENERATION_MODEL,
        "generationQuality": "low",
        "references": generation["references"],
        "mattingModel": MATTING_MODEL,
        "mattingSettings": {"model": "General Use (Heavy)", "refineForeground": True, "preserveNegativeSpace": True},
        "normalization": "full-canvas-resize-only; no crop, recenter, or slot fitting",
        "presentation": presentation,
        "outputs": outputs,
    })
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"promoted side-held prop {accessory_id}", flush=True)


def make_held_review_sheet(accessory_ids: tuple[str, ...]) -> Path:
    cell_size = 384
    preview_bodies = ("classic", "moss", "watermelon")
    background = cover_image(Image.open(TODAY_RUNTIME_BACKGROUND).convert("RGBA"), (cell_size, cell_size))
    face = Image.open(FACES_DIR / f"{DEFAULT_FACE_ID}.png").convert("RGBA")
    catalog = load_catalog(HELD_CATALOG_PATH)
    items = {item["id"]: item for item in catalog["items"]}
    sheet = Image.new("RGBA", (cell_size * len(accessory_ids), cell_size * len(preview_bodies)), (30, 24, 20, 255))
    for row, body_id in enumerate(preview_bodies):
        body = Image.open(BASES_DIR / f"{body_id}.png").convert("RGBA")
        body_scale, body_x, body_y = BODY_PRESENTATIONS.get(body_id, (1.0, 0.0, 0.0))
        body_layer = runtime_layer(body, body_scale, body_x, body_y)
        face_layer = runtime_layer(face, 0.92, 0, 0)
        for column, accessory_id in enumerate(accessory_ids):
            prop = Image.open(OUTPUT_DIR / "held" / f"{accessory_id}.png").convert("RGBA")
            presentation = items[accessory_id].get("presentation", {"scale": 1, "offsetX": 0, "offsetY": 0})
            prop_layer = runtime_layer(prop, presentation["scale"], presentation["offsetX"], presentation["offsetY"])
            composite = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
            composite.alpha_composite(body_layer)
            composite.alpha_composite(face_layer)
            composite.alpha_composite(prop_layer)
            cell = background.copy()
            cell.alpha_composite(composite.resize((cell_size, cell_size), Image.Resampling.LANCZOS))
            label = Image.new("RGBA", (cell_size, 30), (34, 26, 21, 190))
            ImageDraw.Draw(label).text((10, 9), f"{body_id} / {accessory_id}", fill=(255, 247, 232, 255))
            cell.alpha_composite(label)
            sheet.alpha_composite(cell, (column * cell_size, row * cell_size))
    HELD_REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "-".join(accessory_ids)
    path = HELD_REVIEW_DIR / f"review-sheet-{suffix}.png"
    sheet.convert("RGB").save(path, quality=92)
    print(path.relative_to(ROOT))
    return path


def run_held_pipeline(accessory_ids: tuple[str, ...], *, phase: str) -> None:
    for accessory_id in accessory_ids:
        if phase == "render":
            generate_held_front(accessory_id)
            restyle_held_front(accessory_id, use_production_source=False)
            matte_held_front(accessory_id)
            promote_held_front(accessory_id)
        elif phase == "restyle":
            restyle_held_front(accessory_id, use_production_source=True)
            matte_held_front(accessory_id)
            promote_held_front(accessory_id)
        elif phase == "matte":
            matte_held_front(accessory_id)
            promote_held_front(accessory_id)
        else:
            promote_held_front(accessory_id)
    refresh_avatar_catalog_registry()
    if accessory_ids:
        make_held_review_sheet(accessory_ids)
    print(f"Generated and promoted {len(accessory_ids)} held customization(s).", flush=True)


def generate_accessory_source(source_dir: Path, accessory_id: str) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    prompt = accessory_prompt(accessory_id)
    print(f"generating FAL accessory {accessory_id}...", flush=True)
    result = call_function("generate-katchimera-art", {
        "modelId": GENERATION_MODEL,
        "input": {
            "image_urls": [image_data_uri(CLASSIC_APPROVED, max_side=1536)],
            "aspect_ratio": "1:1",
            "resolution": "2K",
        },
        "assetType": "other",
        "assetKey": f"egg-avatar-accessory:{accessory_id}:v1",
        "pipelineVersion": PIPELINE_VERSION,
        "renderProfile": {
            "id": f"egg_avatar_accessory_{accessory_id.replace('-', '_')}_v1",
            "displayName": f"Egg avatar accessory {accessory_id}",
            "topLevelType": "avatar-layer",
            "triggerCategory": "egg-avatar",
            "triggerSubtype": ACCESSORY_SPECS[accessory_id]["slot"],
            "theme": accessory_id,
            "creatureKind": "egg-avatar-accessory",
            "caption": ACCESSORY_SPECS[accessory_id]["direction"],
            "imagePrompt": prompt,
        },
    })
    record = result.get("record") or {}
    image_url = record.get("image_url")
    if not image_url:
        raise RuntimeError(f"No FAL accessory image URL for {accessory_id}: {result}")
    download(image_url, source_dir / f"{accessory_id}-fal.png")
    (source_dir / f"{accessory_id}-generation.json").write_text(json.dumps({
        "id": accessory_id,
        "prompt": prompt,
        "model": GENERATION_MODEL,
        "imageUrl": image_url,
        "recordId": record.get("id"),
    }, indent=2) + "\n", encoding="utf-8")


def matte_accessory_source(source_dir: Path, accessory_id: str) -> None:
    source = source_dir / f"{accessory_id}-fal.png"
    if not source.exists():
        raise SystemExit(f"Missing FAL source: {source}")
    print(f"matting {accessory_id} with BiRefNet Heavy...", flush=True)
    result = call_function("remove-image-background", {
        "imageBase64": base64.b64encode(source.read_bytes()).decode(),
        "outputName": f"egg-avatar-accessory-{accessory_id}-v1",
    })
    image_url = result.get("imageUrl")
    if not image_url:
        raise RuntimeError(f"No BiRefNet image URL for {accessory_id}: {result}")
    download(image_url, source_dir / f"{accessory_id}-birefnet.png")
    (source_dir / f"{accessory_id}-matting.json").write_text(json.dumps({
        "id": accessory_id,
        "model": MATTING_MODEL,
        "modelProfile": result.get("falModelInput", "General Use (Heavy)"),
        "operatingResolution": result.get("operatingResolution", "1024x1024"),
        "refineForeground": result.get("refineForeground", True),
        "imageUrl": image_url,
    }, indent=2) + "\n", encoding="utf-8")


def approve_accessory_source(source_dir: Path, accessory_id: str) -> None:
    raw_path = source_dir / f"{accessory_id}-fal.png"
    matte_path = source_dir / f"{accessory_id}-birefnet.png"
    if not raw_path.exists() or not matte_path.exists():
        raise SystemExit(f"Missing generated or BiRefNet source for {accessory_id}")
    matte = Image.open(matte_path).convert("RGBA")
    raw = Image.open(raw_path).convert("RGBA")
    if raw.size != matte.size:
        raw = raw.resize(matte.size, Image.Resampling.LANCZOS)
    raw.putalpha(matte.getchannel("A"))
    # Props can contain intentional negative spaces (handles, crown openings,
    # hat undersides), so BiRefNet's alpha is authoritative and is never
    # flood-filled. Only opaque interior RGB is restored from the FAL source.
    interior = matte.getchannel("A").point(lambda value: 255 if value > 250 else 0).filter(ImageFilter.MinFilter(9))
    art = Image.composite(raw, matte, interior)
    bounds = art.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible accessory in {matte_path}")
    subject = art.crop(bounds)
    slot = ACCESSORY_SPECS[accessory_id]["slot"]
    left, top, right, bottom = ACCESSORY_BOUNDS[slot]
    subject.thumbnail((round((right - left) * 2048), round((bottom - top) * 2048)), Image.Resampling.LANCZOS)
    x = round((left + right) * 1024 - subject.width / 2)
    y = round(bottom * 2048 - subject.height)
    canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    canvas.alpha_composite(subject, (x, y))
    directory = OUTPUT_DIR / ("hats" if slot == "hat" else "held")
    outputs = save_layer_asset(canvas, directory, directory / "thumbnails", accessory_id)
    manifest = load_manifest()
    accessories = manifest.setdefault("accessories", {})
    accessories["generationModel"] = GENERATION_MODEL
    accessories["matting"] = "fal-ai/birefnet/v2 General Use (Heavy), refined foreground; alpha preserved exactly"
    entry = accessories["hats" if slot == "hat" else "held"][accessory_id]
    entry.pop("keyColor", None)
    entry["prompt"] = accessory_prompt(accessory_id)
    entry["generationModel"] = GENERATION_MODEL
    entry["mattingModel"] = MATTING_MODEL
    entry["mattingSettings"] = {"model": "General Use (Heavy)", "refineForeground": True, "preserveNegativeSpace": True}
    entry["outputs"] = outputs
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"approved FAL/BiRefNet accessory {accessory_id}")


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
    high_directory = directory / "high"
    high_directory.mkdir(parents=True, exist_ok=True)
    png_path = directory / f"{asset_id}.png"
    high_path = high_directory / f"{asset_id}.webp"
    webp_path = directory / f"{asset_id}.webp"
    thumb_path = thumbnails / f"{asset_id}.webp"
    image.save(png_path, optimize=True)
    image.resize((AVATAR_HIGH_SIZE, AVATAR_HIGH_SIZE), Image.Resampling.LANCZOS).save(
        high_path,
        format="WEBP",
        quality=92,
        method=6,
    )
    image.resize((AVATAR_APP_SIZE, AVATAR_APP_SIZE), Image.Resampling.LANCZOS).save(
        webp_path,
        format="WEBP",
        quality=88,
        method=6,
    )
    image.resize((AVATAR_THUMBNAIL_SIZE, AVATAR_THUMBNAIL_SIZE), Image.Resampling.LANCZOS).save(
        thumb_path,
        format="WEBP",
        quality=88,
        method=6,
    )
    return {
        "png": {"path": str(png_path.relative_to(ROOT)).replace("\\", "/"), "width": 2048, "height": 2048, "sha256": sha256(png_path)},
        "highWebp": {"path": str(high_path.relative_to(ROOT)).replace("\\", "/"), "width": AVATAR_HIGH_SIZE, "height": AVATAR_HIGH_SIZE, "sha256": sha256(high_path)},
        "webp": {"path": str(webp_path.relative_to(ROOT)).replace("\\", "/"), "width": AVATAR_APP_SIZE, "height": AVATAR_APP_SIZE, "sha256": sha256(webp_path)},
        "thumbnail": {"path": str(thumb_path.relative_to(ROOT)).replace("\\", "/"), "width": AVATAR_THUMBNAIL_SIZE, "height": AVATAR_THUMBNAIL_SIZE, "sha256": sha256(thumb_path)},
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
    ids = [skin_id] if skin_id else [
        body_id for body_id, item in load_body_specs().items()
        if item["availability"] == "ready"
    ]
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
        separated_top_accessories = set(
            manifest.get("accessories", {}).get("separatedTopAccessoryBodies", [])
        )
        if original_path.exists() and base_path.exists() and item not in separated_top_accessories:
            original = Image.open(original_path).convert("RGBA")
            base = Image.open(base_path).convert("RGBA")
            outside = Image.eval(face_removal_mask(original.size), lambda value: 255 if value == 0 else 0)
            outside_difference = ImageChops.difference(original, base).convert("RGB")
            if ImageChops.multiply(outside_difference, Image.merge("RGB", (outside, outside, outside))).getbbox():
                errors.append(f"layered base changed source pixels outside face mask: {item}")
        if item in manifest.get("skins", {}) and not manifest["skins"][item].get("baseOutputs"):
            errors.append(f"manifest missing layered base outputs for {item}")
    ready_face_ids = tuple(
        item["id"] for item in load_catalog(FACE_CATALOG_PATH)["items"]
        if item["availability"] == "ready"
    )
    for face_id in ready_face_ids:
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
        # The neutral anchor safe zone describes the default expression, while
        # generated brows and novelty eyes may use the documented outer face
        # layer bounds. Validate against that full contract without modifying
        # the generated matte.
        left, top, right, bottom = FACE_REMOVAL_BOUNDS
        safe = Image.new("L", alpha.size, 0)
        ImageDraw.Draw(safe).rectangle((round(left * alpha.width), round(top * alpha.height), round(right * alpha.width), round(bottom * alpha.height)), fill=255)
        if ImageChops.subtract(alpha, safe).getbbox():
            errors.append(f"face layer escapes canonical outer bounds: {face_id}")
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
        # BiRefNet Heavy preserves a wider antialiased fringe than the legacy
        # key-colour mattes. Values above 18% remain suspicious while allowing
        # the visually reviewed clean production output (currently <= 16.3%).
        if visible_pixels and partial_pixels / visible_pixels > 0.18:
            errors.append(f"face layer has implausibly soft edges: {face_id}")
    accessory_manifest = manifest.get("accessories", {})
    if accessory_manifest.get("hatPipelineVersion") != HAT_PIPELINE_VERSION:
        errors.append("manifest hat pipeline version is missing or stale")
    if accessory_manifest.get("hatStyleContractVersion") != HAT_STYLE_CONTRACT_VERSION:
        errors.append("manifest hat style contract is missing or stale")
    expected_hat_references = {
        ("character-art-style", str(BARISTABBIT.relative_to(ROOT)).replace("\\", "/")),
        ("runtime-lighting-palette", str(TODAY_RUNTIME_BACKGROUND.relative_to(ROOT)).replace("\\", "/")),
    }
    recorded_hat_references = {
        (reference.get("role"), reference.get("path"))
        for reference in accessory_manifest.get("hatReferences", [])
        if isinstance(reference, dict)
    }
    if not expected_hat_references.issubset(recorded_hat_references):
        errors.append("manifest is missing the locked Baristabbit or Today hat style reference")
    for slot, directory_name, bounds_key in [
        ("hats", "hats", "hatBounds"),
        ("held", "held", "heldBounds"),
    ]:
        directory = OUTPUT_DIR / directory_name
        bounds = accessory_manifest.get(bounds_key)
        if not isinstance(bounds, list) or len(bounds) != 4:
            errors.append(f"manifest missing canonical {slot} bounds")
            continue
        for accessory_id, accessory_entry in accessory_manifest.get(slot, {}).items():
            for path, expected_size in [
                (directory / f"{accessory_id}.png", (2048, 2048)),
                (directory / f"{accessory_id}.webp", (1024, 1024)),
                (directory / "thumbnails" / f"{accessory_id}.webp", (256, 256)),
            ]:
                if not path.exists():
                    errors.append(f"missing accessory layer {path.relative_to(ROOT)}")
                    continue
                metrics = image_metrics(path)
                if tuple(metrics["size"]) != expected_size:
                    errors.append(f"wrong accessory size {path.relative_to(ROOT)}: {metrics['size']}")
                if any(metrics["corners"]):
                    errors.append(f"non-transparent accessory corner in {path.relative_to(ROOT)}")
            master = directory / f"{accessory_id}.png"
            if master.exists():
                alpha_bounds = Image.open(master).convert("RGBA").getchannel("A").getbbox()
                presentation = accessory_entry.get("presentation")
                if slot == "hats":
                    if not isinstance(presentation, dict):
                        errors.append(f"hat missing runtime presentation: {accessory_id}")
                    else:
                        values = [presentation.get(key) for key in ("scale", "offsetX", "offsetY")]
                        if not all(isinstance(value, (int, float)) for value in values) or presentation.get("scale", 0) <= 0:
                            errors.append(f"hat has invalid runtime presentation: {accessory_id}")
                        catalog_presentation = ACCESSORY_SPECS.get(accessory_id, {}).get("item", {}).get("presentation")
                        if presentation != catalog_presentation:
                            errors.append(f"hat catalog/manifest presentation mismatch: {accessory_id}")
                    if accessory_entry.get("pipelineVersion") != HAT_PIPELINE_VERSION:
                        errors.append(f"hat uses stale pipeline: {accessory_id}")
                    if accessory_entry.get("styleContractVersion") != HAT_STYLE_CONTRACT_VERSION:
                        errors.append(f"hat uses stale style contract: {accessory_id}")
                    if accessory_entry.get("generationModel") != HAT_GENERATION_MODEL:
                        errors.append(f"hat uses wrong generation model: {accessory_id}")
                    if accessory_entry.get("generationQuality") != "low":
                        errors.append(f"hat uses wrong GPT Image quality: {accessory_id}")
                if isinstance(presentation, dict) and alpha_bounds:
                    alpha_bounds = presented_bounds(alpha_bounds, presentation)
                    if slot == "hats" and accessory_id in CROWN_ALIGNED_HAT_IDS:
                        presented_width = alpha_bounds[2] - alpha_bounds[0]
                        if presented_width > 1210:
                            errors.append(f"crown-aligned hat is too wide ({presented_width}px): {accessory_id}")
                        if not 690 <= alpha_bounds[3] <= 702:
                            errors.append(f"crown-aligned hat lost its contact edge ({alpha_bounds[3]}px): {accessory_id}")
                if slot == "held" and accessory_entry.get("pipelineVersion") == HELD_PIPELINE_VERSION:
                    if accessory_entry.get("generationModel") != HELD_GENERATION_MODEL:
                        errors.append(f"held prop uses wrong generation model: {accessory_id}")
                    if accessory_entry.get("generationQuality") != "low":
                        errors.append(f"held prop uses wrong GPT Image quality: {accessory_id}")
                allowed = tuple(round(value * 2048) for value in bounds)
                if alpha_bounds and (
                    alpha_bounds[0] < allowed[0] - 4
                    or alpha_bounds[1] < allowed[1] - 4
                    or alpha_bounds[2] > allowed[2] + 4
                    or alpha_bounds[3] > allowed[3] + 4
                ):
                    errors.append(f"accessory escapes canonical {slot} bounds: {accessory_id}")
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
    check.add_argument("--skin", choices=BODY_SPECS.keys())
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
    for command in ("accessory-base-generate", "accessory-base-matte", "accessory-base-approve"):
        child = sub.add_parser(command)
        child.add_argument("--source-dir", type=Path, required=True)
        child.add_argument("--skin", required=True, choices=ACCESSORY_READY_SKINS)
    for command in ("accessory-generate", "accessory-matte", "accessory-approve"):
        child = sub.add_parser(command)
        child.add_argument("--source-dir", type=Path, required=True)
        child.add_argument("--id", required=True, choices=HELD_IDS)
    hat_generation = sub.add_parser("hat-generate")
    hat_generation.add_argument("--id", required=True, choices=HAT_IDS)
    hat_matte = sub.add_parser("hat-matte")
    hat_matte.add_argument("--id", required=True, choices=HAT_IDS)
    hat_approval = sub.add_parser("hat-approve")
    hat_approval.add_argument("--id", required=True, choices=HAT_IDS)
    sub.add_parser("hat-compatibility-sheet")
    hat_review = sub.add_parser("hat-review-sheet")
    hat_review.add_argument("target", choices=(*HAT_IDS, "all"))
    hat_pipeline = sub.add_parser("hat-pipeline")
    hat_pipeline.add_argument("target", choices=(*HAT_IDS, "batch", "remaining", "all"))
    hat_pipeline.add_argument(
        "phase",
        nargs="?",
        default="render",
        choices=("render", "restyle", "promote"),
        help="Render creates new geometry then style-maps it; restyle edits production geometry; promote writes reviewed files.",
    )
    face_pipeline = sub.add_parser("face-pipeline")
    face_pipeline.add_argument("target", choices=(*FACE_SPECS.keys(), "batch", "remaining", "all"))
    face_pipeline.add_argument("phase", nargs="?", default="render", choices=("render", "matte", "promote"))
    face_pipeline.add_argument(
        "--review-only",
        action="store_true",
        help="Generate and matte into the review directory without replacing production assets.",
    )
    held_pipeline = sub.add_parser("held-pipeline")
    held_pipeline.add_argument("target", choices=(*HELD_IDS, "batch", "remaining", "all"))
    held_pipeline.add_argument("phase", nargs="?", default="render", choices=("render", "restyle", "matte", "promote"))
    body_draft = sub.add_parser("body-draft")
    body_draft.add_argument("target", choices=(*BODY_SPECS.keys(), "starter-batch", "costume-batch", "mixed-batch", "all"))
    body_draft.add_argument(
        "phase",
        nargs="?",
        default="render",
        choices=("render", "matte", "promote"),
        help="Render creates, mattes, and promotes; matte reruns BiRefNet before promotion; promote uses existing draft files.",
    )
    body_draft.add_argument(
        "--review-only",
        action="store_true",
        help="Keep generated files under .tmp instead of promoting them into the runtime catalog.",
    )
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
    elif args.command == "accessory-base-generate":
        generate_accessory_ready_base(args.source_dir, args.skin)
    elif args.command == "accessory-base-matte":
        matte_accessory_ready_base(args.source_dir, args.skin)
    elif args.command == "accessory-base-approve":
        approve_accessory_ready_base(args.source_dir, args.skin)
    elif args.command == "accessory-generate":
        generate_accessory_source(args.source_dir, args.id)
    elif args.command == "accessory-matte":
        matte_accessory_source(args.source_dir, args.id)
    elif args.command == "accessory-approve":
        approve_accessory_source(args.source_dir, args.id)
    elif args.command == "hat-generate":
        generate_hat_front(args.id)
    elif args.command == "hat-matte":
        matte_hat_front(args.id)
    elif args.command == "hat-approve":
        approve_hat_front(args.id)
    elif args.command == "hat-compatibility-sheet":
        make_hat_compatibility_sheet()
    elif args.command == "hat-review-sheet":
        make_hat_review_sheet(HAT_IDS if args.target == "all" else (args.target,))
    elif args.command == "hat-pipeline":
        hat_ids = (
            HAT_IDS if args.target == "all"
            else PLANNED_HAT_IDS if args.target == "remaining"
            else PLANNED_HAT_IDS[:4] if args.target == "batch"
            else (args.target,)
        )
        run_hat_pipeline(hat_ids, phase=args.phase)
    elif args.command == "face-pipeline":
        face_ids = (
            tuple(FACE_SPECS) if args.target == "all"
            else PLANNED_FACE_IDS if args.target == "remaining"
            else PLANNED_FACE_IDS[:4] if args.target == "batch"
            else (args.target,)
        )
        run_face_pipeline(face_ids, phase=args.phase, review_only=args.review_only)
    elif args.command == "held-pipeline":
        held_ids = (
            HELD_IDS if args.target == "all"
            else PENDING_HELD_IDS if args.target == "remaining"
            else PENDING_HELD_IDS[:4] if args.target == "batch"
            else (args.target,)
        )
        run_held_pipeline(held_ids, phase=args.phase)
    elif args.command == "body-draft":
        body_ids = (
            PLANNED_BODY_IDS if args.target == "all"
            else STARTER_BODY_BATCH if args.target == "starter-batch"
            else NEXT_COSTUME_BODY_BATCH if args.target == "costume-batch"
            else MIXED_BODY_BATCH if args.target == "mixed-batch"
            else (args.target,)
        )
        run_planned_body_drafts(body_ids, phase=args.phase, review_only=args.review_only)
    else:
        gameplay_approve(args.crack_one, args.crack_two)


if __name__ == "__main__":
    main()
