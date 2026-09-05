#!/usr/bin/env python3
"""Generate square, horizontally explorable environment background candidates.

Generation uses the existing Supabase/FAL generate-asset route with
fal-ai/nano-banana-2/edit at 2K. The approved square composition template is
the only image supplied to the model. Every provider-facing prompt must be
self-contained and describe the requested result in ordinary visual language;
internal project names and references to unsupplied images are rejected before
generation. The pipeline creates normalized 2048 and 1024 outputs plus
phone-width left/center/right QA crops.

Examples:
  python scripts/generate-exploration-background.py plan home
  python scripts/generate-exploration-background.py generate home
  python scripts/generate-exploration-background.py generate feastle
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import shutil
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "design" / "exploration-backgrounds" / "manifest.json"
WORK_ROOT = ROOT / ".tmp" / "exploration-backgrounds"
RUNTIME_KEYS_PATH = ROOT / "constants" / "today-exploration-background-keys.gen.ts"
RUNTIME_SOURCES_PATH = ROOT / "constants" / "today-exploration-background-sources.gen.ts"
HOME_RUNTIME_SOURCE = "assets/images/katchimeras/world/backgrounds/home/home-exploration-v1.png"
PROMPT_SECTION_LABELS = (
    ("ART STYLE", "artStyle"),
    ("ENVIRONMENT DESIGN", "environmentDesign"),
    ("COMPOSITION", "composition"),
    ("REDESIGN FREEDOM", "redesignFreedom"),
    ("EXCLUSIONS", "exclusions"),
)


def load_spec() -> dict[str, Any]:
    try:
        return json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Could not read {SPEC_PATH.relative_to(ROOT)}: {exc}") from None


def background_for(spec: dict[str, Any], key: str) -> dict[str, Any]:
    background = spec.get("backgrounds", {}).get(key)
    if not isinstance(background, dict):
        known = ", ".join(sorted(spec.get("backgrounds", {})))
        raise SystemExit(f"Unknown background key {key!r}. Known keys: {known}")
    return background


def project_path(value: str, *, label: str) -> Path:
    path = (ROOT / value).resolve()
    try:
        path.relative_to(ROOT)
    except ValueError:
        raise SystemExit(f"{label} must stay inside the project: {value}") from None
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")
    return path


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                env_key, value = line.split("=", 1)
                values[env_key] = value.strip().strip('"').strip("'")
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get(
        "EXPO_PUBLIC_SUPABASE_KEY"
    )
    if not url or not key:
        raise SystemExit("Missing Supabase URL/key in .env.local.")
    return url.rstrip("/"), key


def image_b64(path: Path, *, max_side: int, jpeg: bool) -> tuple[str, str]:
    with Image.open(path) as opened:
        image = opened.convert("RGB")
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        if jpeg:
            image.save(buffer, "JPEG", quality=95, subsampling=0)
            mime = "image/jpeg"
        else:
            image.save(buffer, "PNG", optimize=True)
            mime = "image/png"
    return base64.b64encode(buffer.getvalue()).decode("ascii"), mime


def call_function(
    name: str,
    payload: dict[str, Any],
    *,
    timeout: int = 180,
    retries: int = 4,
) -> dict[str, Any]:
    supabase_url, supabase_key = load_env()
    request = urllib.request.Request(
        f"{supabase_url}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            transient = exc.code in {429, 500, 502, 503, 504}
            if transient and attempt < retries:
                delay = min(8, 2 ** (attempt - 1))
                print(f"  {name} HTTP {exc.code}; retrying in {delay}s...", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} HTTP {exc.code}: {body[:1200]}") from None
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < retries:
                delay = min(8, 2 ** (attempt - 1))
                print(f"  {name} transport error; retrying in {delay}s...", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} transport failure: {exc}") from None
    raise RuntimeError(f"{name} failed after {retries} attempts")


def _prompt_contains_term(prompt: str, term: str) -> bool:
    return bool(
        re.search(
            rf"(?<![\w-]){re.escape(term)}(?![\w-])",
            prompt,
            flags=re.IGNORECASE,
        )
    )


def validate_provider_prompt(
    spec: dict[str, Any],
    key: str,
    background: dict[str, Any],
    prompt: str,
) -> None:
    contract = spec.get("providerPromptContract")
    if not isinstance(contract, dict):
        raise SystemExit("Manifest is missing providerPromptContract.")

    reference_count = contract.get("referenceCount")
    if reference_count != 1:
        raise SystemExit(
            "providerPromptContract.referenceCount must be 1 for the "
            "template-only environment pipeline."
        )
    if background.get("referenceMode") != "template-only":
        raise SystemExit(
            f"Background {key!r} must use referenceMode 'template-only'; "
            "provider prompts may only assume the supplied composition image."
        )

    prompt_template = spec.get("providerPromptTemplate")
    if not isinstance(prompt_template, dict):
        raise SystemExit("Manifest is missing providerPromptTemplate.")
    injected_field = contract.get("injectedField")
    if injected_field != "environmentDesign":
        raise SystemExit(
            "providerPromptContract.injectedField must be 'environmentDesign'."
        )
    if "promptSections" in background:
        raise SystemExit(
            f"Background {key!r} must not override shared prompt sections. "
            "Define only environmentDesign."
        )
    environment_design = background.get(injected_field)
    if not isinstance(environment_design, str) or not environment_design.strip():
        raise SystemExit(
            f"Background {key!r} must define one non-empty {injected_field!r} "
            "prompt injection."
        )

    required_template_sections = contract.get(
        "requiredTemplateSections",
        ["artStyle", "composition", "redesignFreedom", "exclusions"],
    )
    missing_template_sections = [
        field
        for field in required_template_sections
        if not isinstance(prompt_template.get(field), str)
        or not prompt_template[field].strip()
    ]
    if missing_template_sections:
        raise SystemExit(
            "providerPromptTemplate has missing shared sections: "
            + ", ".join(missing_template_sections)
        )

    all_backgrounds = spec.get("backgrounds", {})
    internal_terms: list[str] = []
    for value in contract.get("forbiddenTerms", []):
        if isinstance(value, str) and value.strip():
            internal_terms.append(value.strip())
    for other_key, other_background in all_backgrounds.items():
        if not isinstance(other_background, dict):
            continue
        declared_terms = other_background.get("internalPromptTerms")
        if other_key != "home":
            internal_terms.append(other_key)
            if (
                not isinstance(declared_terms, list)
                or not any(
                    isinstance(value, str) and value.strip()
                    for value in declared_terms
                )
            ):
                raise SystemExit(
                    f"Background {other_key!r} must declare internalPromptTerms "
                    "so its opaque project names can never leak into provider "
                    "prompts."
                )
        if isinstance(declared_terms, list):
            internal_terms.extend(
                value.strip()
                for value in declared_terms
                if isinstance(value, str) and value.strip()
            )

    violations: list[str] = []
    for term in dict.fromkeys(internal_terms):
        if _prompt_contains_term(prompt, term):
            violations.append(f"opaque internal term {term!r}")
    for phrase in contract.get("forbiddenPhrases", []):
        if (
            isinstance(phrase, str)
            and phrase.strip()
            and phrase.casefold() in prompt.casefold()
        ):
            violations.append(f"contextless phrase {phrase!r}")

    referenced_images = {
        int(match)
        for match in re.findall(r"\bimage\s+(\d+)\b", prompt, flags=re.IGNORECASE)
    }
    invalid_images = sorted(
        image_number
        for image_number in referenced_images
        if image_number < 1 or image_number > reference_count
    )
    if invalid_images:
        violations.append(
            "reference to unsupplied "
            + ", ".join(f"image {image_number}" for image_number in invalid_images)
        )
    if re.search(
        r"\b(second|additional|other)\s+(image|visual reference|style reference)\b",
        prompt,
        flags=re.IGNORECASE,
    ):
        violations.append("reference to an unsupplied additional image")

    if violations:
        raise SystemExit(
            f"Provider prompt contract failed for {key!r}: "
            + "; ".join(violations)
            + ". Describe the visual result in ordinary, self-contained language "
            "and mention only the supplied reference image."
        )


def prompt_for(spec: dict[str, Any], key: str) -> str:
    background = background_for(spec, key)
    prompt_template = spec.get("providerPromptTemplate")
    if not isinstance(prompt_template, dict):
        raise SystemExit("Manifest is missing providerPromptTemplate.")
    section_values = {
        **prompt_template,
        "environmentDesign": background.get("environmentDesign"),
    }
    resolved_sections = [
        f"{label}:\n{section_values[field].strip()}"
        for label, field in PROMPT_SECTION_LABELS
        if isinstance(section_values.get(field), str)
        and section_values[field].strip()
    ]
    prompt = "\n\n".join(resolved_sections)
    validate_provider_prompt(spec, key, background, prompt)
    return prompt

    simple_prompt = background.get("simplePrompt")
    if isinstance(simple_prompt, str) and simple_prompt.strip():
        return simple_prompt.strip()

    platform = background["platform"]
    camera = spec["canvas"]["cameraLock"]
    is_katchimera_variant = key != "home"
    has_identity_reference = isinstance(background.get("identityReference"), str)
    identity_reference_kind = background.get("identityReferenceKind", "habitat")
    identity_role = (
        (
            "Image 2 is the authoritative Katchimera creature-identity and secondary project-art reference. "
            "Extract only its species palette, material character, signature motifs, lighting polish, and broad "
            "habitat mood. The written SCENE section—not image 2—defines the environment architecture and props. "
            "Never render, copy, silhouette, or imply the creature from image 2 in the background."
            if identity_reference_kind == "creature"
            else
            "Image 2 is the authoritative Katchimera-specific habitat identity and project-art reference for "
            "architecture, signature motifs, palette, rounded materials, lighting, and prop vocabulary. Use it "
            "to invent a new full environment, not to copy its portrait framing or exact object layout."
        )
        if has_identity_reference
        else
        (
            "No image 2 is supplied. Image 1 is the only visual reference. The written SCENE, composition, "
            "palette, foreground, platform-treatment, and side-exploration sections are the complete authority "
            "for the new Katchimera environment identity."
            if background.get("referenceMode") == "template-only"
            else
            "Image 2 is only the checked-in Katchimeras style anchor for premium material finish, rounded forms, "
            "lighting response, color blocking, and mobile-game polish. Do not copy image 2's creature, tile, wreath, "
            "globe, black background, or object layout."
        )
    )
    phone = spec["canvas"]["phoneViewport"]
    phone_safe_fraction = phone["width"] / phone["height"]
    reference_role = (
        "Edit image 1, but use it ONLY for three things: (1) its exact virtual camera and framing, including "
        "camera height, downward pitch, focal length, perspective, horizon, ground-plane vanishing behavior, "
        "and foreground/sky proportions; (2) the exact screen-space geometry of its single central circular "
        "platform; and (3) the Katchimeras rendering language—rounded designer-toy geometry, material finish, "
        "lighting, color cleanliness, and polish. Image 1 is NOT an architecture, landscape, path, prop, "
        "landmark, vegetation-placement, or scene-layout reference. Everything except the camera/framing and "
        "platform must be newly designed. A recognizable content reskin of image 1 is a failed result. "
        f"{identity_role}"
        if is_katchimera_variant
        else
        "Edit image 1. Image 1 is the authoritative composition, camera, spatial structure, shape language, "
        "platform geometry, platform scale, platform position, landscape balance, and rendering-style "
        f"reference. Preserve its recognizable spatial structure. {identity_role}"
    )
    composition_contract = (
        "CAMERA + PLATFORM LOCK; ENVIRONMENT REDESIGN FREEDOM\n"
        f"Lock the virtual camera to image 1: {camera['description']}. Preserve the same lens feel, perspective "
        f"convergence, ground-plane angle, and depth staging: {camera['depthStaging']}. The camera must not move "
        "higher, pitch farther downward, zoom out, or become more overhead just because the new environment is "
        "architecturally richer. A transparent overlay comparison with image 1 should show matching horizon, "
        "ground-plane perspective, platform center, platform ellipse, and visible rim depth even though the "
        "surrounding scene content is entirely different.\n\n"
        "Completely redesign the environment around those two invariants. Do not preserve image 1's cottage "
        "footprint, path, landmark balance, vegetation positions, or meadow structure. Do not merely reskin, "
        "recolor, decorate, or swap materials on image 1. The output must have a clearly different silhouette, "
        "architectural organization, circulation, landmarks, and left/right storytelling while retaining the "
        "same camera framing and broad foreground/midground/background depth bands.\n\n"
        f"New composition direction: {background.get('compositionDirective', background['theme'])}.\n\n"
        f"Explicitly discard from image 1: {background.get('discardFromTemplate', 'all recognizable scene content outside the platform')}.\n\n"
        "The lower foreground is redesignable scene content, not part of the camera lock. "
        f"Foreground direction: {background.get('foregroundTreatment', 'invent a new themed foreground with no copied approach path')}.\n\n"
        "There is exactly ONE empty round platform. Copy its screen-space framing exactly: keep it fully visible, "
        f"crisp, and unobstructed, centered at normalized x {platform['centerX']:.3f}, y {platform['centerY']:.3f}, "
        f"with horizontal diameter about {platform['diameter']:.3f} and camera-projected visible height about "
        f"{platform.get('projectedHeight', platform['diameter']):.3f} of the square. On the 2048 square, its "
        f"center is ({round(2048 * float(platform['centerX']))}, {round(2048 * float(platform['centerY']))}), "
        f"its visible horizontal diameter is about {round(2048 * float(platform['diameter']))} pixels, and its "
        f"projected visible height is about "
        f"{round(2048 * float(platform.get('projectedHeight', platform['diameter'])))} pixels. Its center is "
        "visibly below the image midpoint, never at y 0.50–0.55. The diameter means the complete outermost "
        "platform silhouette including its rim—not merely the inner top. No larger circular paving, halo, ring, "
        "plaza, border, or concentric shape may surround it. It may not move, resize materially, gain an occupant "
        "or prop, become a huge plaza, or be duplicated. The newly invented environment must be composed around "
        "this fixed live-creature anchor."
        if is_katchimera_variant
        else
        "COMPOSITION AND PLATFORM LOCK\n"
        "Preserve image 1's front-facing, gently elevated establishing camera and its landmark-left / "
        "open-landscape-right balance. Preserve the bottom-center stepping-stone approach. There is exactly "
        "ONE empty round platform. Keep it geometrically round, fully visible, crisp, "
        f"and unobstructed, centered at normalized x {platform['centerX']:.3f}, y {platform['centerY']:.3f}, "
        f"with horizontal diameter about {platform['diameter']:.3f} and camera-projected visible height "
        f"about {platform.get('projectedHeight', platform['diameter']):.3f} of the square."
    )
    phone_contract = (
        f"The centered default phone crop shows about {phone_safe_fraction:.3f} of the square's width when "
        "the square is fitted by height. Keep only the platform and its clear creature space essential within "
        "that central crop. The newly designed environment should still read there, while both outer areas "
        "must contain substantial, distinct themed discoveries for horizontal panning. Do not add another "
        "platform or a competing centered focal object."
        if is_katchimera_variant
        else
        f"The centered default phone crop shows about {phone_safe_fraction:.3f} of the square's width when "
        "the square is fitted by height. Keep the platform, its clear creature space, the stepping-stone "
        "approach, and the left landmark entrance readable inside that central crop. Use the outer left and "
        "right areas for additional themed scenery that rewards horizontal panning."
    )
    sections = [
            (
                "REFERENCE ROLES\n"
                f"{reference_role}"
            ),
            (
                "OUTPUT\n"
                "One edge-to-edge square 1:1 Katchimeras environment plate generated at 2K. It will be scaled by "
                "height to fill a portrait phone and panned horizontally. No border, frame, transparency, UI, "
                "text, labels, logo, watermark, creature, character, person, animal, egg, nest, or black studio "
                "background."
            ),
            (
                "KATCHIMERAS ART STYLE — LOCKED\n"
                "Premium cozy stylized 3D Katchimeras mobile-game environment art in a modern collectible "
                "designer-toy aesthetic. Use chunky rounded clay-like geometry, broad smooth bevels, a few large "
                "clean shapes, bold readable color blocking, clean simplified tactile matte and satin materials, "
                "soft upper-left daylight, soft global illumination, gentle ambient occlusion, restrained warm "
                "lantern glow, and polished hero-quality rendering. Match image 1's bright friendly toy-diorama "
                "look and smooth rounded foliage. Keep detail low-frequency and every major feature readable at "
                "256px. Surfaces may have subtle tactile variation but never visible brushwork or realistic texture."
            ),
            (
                f"SCENE\n{background['displayName']}: {background['theme']}. "
                f"Palette: {background['palette']}."
                + (
                    f" Signature landmark: {background['signature']}."
                    if background.get("signature")
                    else ""
                )
            ),
            (
                composition_contract
            ),
            (
                "PHONE-SAFE AND HORIZONTAL EXPLORATION\n"
                f"{phone_contract}"
            ),
            (
                "ABSOLUTE EXCLUSIONS\n"
                "No hex tile, hexagonal geometry, grid, isometric map view, floating island, oversized concentric "
                "plaza, painterly brushwork, storybook painting, photorealism, realistic foliage, individual leaf "
                "noise, noisy microtexture, rough or gritty surfaces, cinematic matte-painting haze, moody dark "
                "realism, cheap glossy toy-commercial plastic, excessive bloom, clutter, duplicate objects, warped "
                "architecture, or melted edges. For Katchimera variants: no copied Home hut, no round-doored mound, "
                "no inherited stepping-stone path, no recognizable Home-meadow layout, and "
                f"{camera['exclusions']}."
                + (
                    f" Scene-specific exclusions: {background['absoluteExclusions']}."
                    if background.get("absoluteExclusions")
                    else ""
                )
            ),
            (
                "FINAL QUALITY\n"
                "The result must look as though it was authored in the same production family as image 1 and the "
                "approved Katchimeras style anchor: bright, clean, rounded, tactile, coherent, low-frequency, and "
                "immediately readable as polished mobile-game environment art."
            ),
        ]
    if background.get("platformTreatment"):
        sections.insert(
            5,
            f"PLATFORM MATERIAL TREATMENT\n{background['platformTreatment']}.",
        )
    if background.get("sideExploration"):
        sections.insert(
            7,
            f"KATCHIMERA-SPECIFIC SIDE EXPLORATION\n{background['sideExploration']}.",
        )
    return "\n\n".join(sections)


def generate_url(
    *,
    output_name: str,
    prompt: str,
    template: Path,
    style_guide: Path | None,
) -> str:
    template_b64, template_mime = image_b64(template, max_side=1024, jpeg=True)
    payload = {
        "action": "generate",
        "model": "nano",
        "mode": "single",
        "outputName": output_name,
        "prompt": prompt,
        "referenceBase64": template_b64,
        "referenceMime": template_mime,
        "aspectRatio": "1:1",
        "resolution": "2K",
    }
    if style_guide is not None:
        guide_b64, guide_mime = image_b64(style_guide, max_side=512, jpeg=False)
        payload["guideBase64"] = guide_b64
        payload["guideMime"] = guide_mime
    data = call_function("generate-asset", payload, timeout=240)
    if data.get("status") == "completed":
        url = data.get("imageUrl") or data.get("gridUrl")
        if isinstance(url, str):
            return url
    request_id = data.get("requestId")
    if not isinstance(request_id, str):
        raise RuntimeError(f"{output_name}: generation did not complete or queue: {data}")
    for attempt in range(1, 121):
        time.sleep(8)
        poll = call_function(
            "generate-asset",
            {
                "action": "poll",
                "model": "nano",
                "mode": "single",
                "outputName": output_name,
                "requestId": request_id,
                "rawResult": True,
            },
        )
        print(f"  poll {attempt}/120: {poll.get('status')}", flush=True)
        if poll.get("status") == "completed" and isinstance(poll.get("imageUrl"), str):
            return str(poll["imageUrl"])
    raise TimeoutError(f"{output_name}: generation did not complete")


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def normalized_square(source: Path, size: int) -> Image.Image:
    with Image.open(source) as opened:
        image = opened.convert("RGB")
    ratio = image.width / image.height
    if not 0.98 <= ratio <= 1.02:
        raise RuntimeError(f"FAL output must be square; received {image.width}x{image.height}")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def package_candidate(
    raw: Path,
    work: Path,
    index: int,
    spec: dict[str, Any],
    key: str,
) -> dict[str, Any]:
    canvas = spec["canvas"]
    background = background_for(spec, key)
    master_size = int(canvas["masterSize"])
    review_size = int(canvas["reviewSize"])
    master = normalized_square(raw, master_size)
    master_path = work / f"candidate-{index}-master-2k.png"
    master.save(master_path, "PNG", optimize=True)
    review = master.resize((review_size, review_size), Image.Resampling.LANCZOS)
    review_path = work / f"candidate-{index}-preview-1k.png"
    review.save(review_path, "PNG", optimize=True)

    phone = canvas["phoneViewport"]
    crop_width = round(review_size * int(phone["width"]) / int(phone["height"]))
    positions = {
        "left": 0,
        "center": (review_size - crop_width) // 2,
        "right": review_size - crop_width,
    }
    qa_paths: dict[str, str] = {}
    for label, x in positions.items():
        crop = review.crop((x, 0, x + crop_width, review_size))
        path = work / f"candidate-{index}-phone-{label}.png"
        crop.save(path, "PNG", optimize=True)
        qa_paths[label] = str(path.relative_to(ROOT)).replace("\\", "/")

    platform = background["platform"]
    center_x = round(review_size * float(platform["centerX"]))
    center_y = round(review_size * float(platform["centerY"]))
    radius_x = round(review_size * float(platform["diameter"]) / 2)
    radius_y = round(
        review_size
        * float(platform.get("projectedHeight", platform["diameter"]))
        / 2
    )
    overlay = review.convert("RGBA")
    drawing = ImageDraw.Draw(overlay, "RGBA")
    guide_color = (30, 245, 230, 235)
    crop_color = (255, 222, 74, 220)
    horizon_color = (255, 72, 176, 220)
    drawing.ellipse(
        (
            center_x - radius_x,
            center_y - radius_y,
            center_x + radius_x,
            center_y + radius_y,
        ),
        outline=guide_color,
        width=max(3, review_size // 256),
    )
    cross_size = max(10, review_size // 64)
    drawing.line(
        (center_x - cross_size, center_y, center_x + cross_size, center_y),
        fill=guide_color,
        width=max(2, review_size // 384),
    )
    drawing.line(
        (center_x, center_y - cross_size, center_x, center_y + cross_size),
        fill=guide_color,
        width=max(2, review_size // 384),
    )
    center_crop_x = positions["center"]
    for x in (center_crop_x, center_crop_x + crop_width):
        drawing.line(
            (x, 0, x, review_size),
            fill=crop_color,
            width=max(2, review_size // 384),
        )
    horizon_y = round(review_size * float(canvas["cameraLock"]["horizonY"]))
    dash_width = max(12, review_size // 42)
    dash_gap = max(8, review_size // 64)
    for x in range(0, review_size, dash_width + dash_gap):
        drawing.line(
            (x, horizon_y, min(x + dash_width, review_size), horizon_y),
            fill=horizon_color,
            width=max(2, review_size // 384),
        )
    guide_path = work / f"candidate-{index}-platform-guide.png"
    overlay.convert("RGB").save(guide_path, "PNG", optimize=True)

    return {
        "masterPath": str(master_path.relative_to(ROOT)).replace("\\", "/"),
        "reviewPath": str(review_path.relative_to(ROOT)).replace("\\", "/"),
        "platformGuidePath": str(guide_path.relative_to(ROOT)).replace("\\", "/"),
        "phoneCropWidth": crop_width,
        "phoneCrops": qa_paths,
        "masterSha256": hashlib.sha256(master_path.read_bytes()).hexdigest(),
    }


def write_plan(
    spec: dict[str, Any],
    key: str,
) -> tuple[Path, Path | None, Path, str]:
    background = background_for(spec, key)
    template = project_path(background["template"], label="background template")
    style_guide: Path | None
    if background.get("referenceMode") == "template-only":
        style_guide = None
    else:
        guide_value = background.get("identityReference", spec["styleGuide"])
        style_guide = project_path(
            guide_value,
            label=(
                "Katchimera identity reference"
                if background.get("identityReference")
                else "style guide"
            ),
        )
    work = WORK_ROOT / key
    work.mkdir(parents=True, exist_ok=True)
    prompt = prompt_for(spec, key)
    prompt_path = work / "prompt.txt"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    plan = {
        "key": key,
        "pipelineVersion": spec["pipelineVersion"],
        "provider": spec["provider"],
        "model": spec["model"],
        "template": str(template.relative_to(ROOT)).replace("\\", "/"),
        "templateSha256": hashlib.sha256(template.read_bytes()).hexdigest(),
        "styleGuide": (
            str(style_guide.relative_to(ROOT)).replace("\\", "/")
            if style_guide is not None
            else None
        ),
        "guideRole": (
            f"katchimera-{background.get('identityReferenceKind', 'habitat')}-identity"
            if background.get("identityReference")
            else (
                "prompt-only"
                if background.get("referenceMode") == "template-only"
                else "project-style"
            )
        ),
        "styleGuideSha256": (
            hashlib.sha256(style_guide.read_bytes()).hexdigest()
            if style_guide is not None
            else None
        ),
        "prompt": str(prompt_path.relative_to(ROOT)).replace("\\", "/"),
        "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "canvas": spec["canvas"],
    }
    (work / "plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    return template, style_guide, work, prompt


def write_runtime_registry() -> None:
    candidates_dir = ROOT / "design" / "exploration-backgrounds" / "candidates"
    latest_by_key: dict[str, dict[str, Any]] = {}
    if candidates_dir.exists():
        for metadata_path in candidates_dir.glob("*.json"):
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            key = metadata.get("key")
            runtime_value = metadata.get("outputs", {}).get("runtime")
            if (
                metadata.get("status") != "generated-candidate"
                or not isinstance(key, str)
                or not isinstance(runtime_value, str)
            ):
                continue
            runtime_path = project_path(
                runtime_value,
                label=f"{key} runtime background",
            )
            previous = latest_by_key.get(key)
            if previous and str(previous.get("exportedAt", "")) >= str(
                metadata.get("exportedAt", "")
            ):
                continue
            latest_by_key[key] = {**metadata, "runtimePath": runtime_path}

    katchimera_keys = sorted(latest_by_key)
    key_literals = ",\n".join(f"  {key!r}" for key in katchimera_keys)
    RUNTIME_KEYS_PATH.write_text(
        "\n".join(
            [
                "// Generated by scripts/generate-exploration-background.py. Do not hand edit.",
                "",
                "export const TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS = [",
                key_literals,
                "] as const;",
                "",
                "export type TodayKatchimeraExplorationBackgroundKey =",
                "  (typeof TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS)[number];",
                "",
                "export type TodayExplorationBackgroundKey =",
                "  | 'home'",
                "  | TodayKatchimeraExplorationBackgroundKey;",
                "",
            ]
        ),
        encoding="utf-8",
    )

    entries = [
        ("home", HOME_RUNTIME_SOURCE, "today-home-exploration-v1"),
        *[
            (
                key,
                str(latest_by_key[key]["runtimePath"].relative_to(ROOT)).replace(
                    "\\", "/"
                ),
                f"today-{Path(str(latest_by_key[key]['outputs']['runtime'])).stem}",
            )
            for key in katchimera_keys
        ],
    ]
    entry_lines: list[str] = []
    for key, runtime_value, recycling_key in entries:
        entry_lines.extend(
            [
                f"  {key!r}: {{",
                f"    recyclingKey: {recycling_key!r},",
                f"    source: require('../{runtime_value}'),",
                "  },",
            ]
        )
    RUNTIME_SOURCES_PATH.write_text(
        "\n".join(
            [
                "// Generated by scripts/generate-exploration-background.py. Do not hand edit.",
                "import type { ImageSourcePropType } from 'react-native';",
                "",
                "import type { TodayExplorationBackgroundKey } from '@/constants/today-exploration-background-keys.gen';",
                "",
                "export const TODAY_EXPLORATION_BACKGROUND_SOURCES = {",
                *entry_lines,
                "} as const satisfies Record<",
                "  TodayExplorationBackgroundKey,",
                "  { recyclingKey: string; source: ImageSourcePropType }",
                ">;",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(
        "refreshed "
        f"{RUNTIME_KEYS_PATH.relative_to(ROOT)} and "
        f"{RUNTIME_SOURCES_PATH.relative_to(ROOT)}"
    )


def cmd_plan(args: argparse.Namespace) -> None:
    spec = load_spec()
    _template, _style_guide, work, _prompt = write_plan(spec, args.key)
    print((work / "plan.json").read_text(encoding="utf-8"))


def cmd_generate(args: argparse.Namespace) -> None:
    spec = load_spec()
    template, style_guide, work, prompt = write_plan(spec, args.key)
    records: list[dict[str, Any]] = []
    for index in range(1, args.count + 1):
        output_name = f"exploration-background-{args.key}-{index}"
        print(f"generating {output_name} via fal-ai/nano-banana-2/edit at 2K...", flush=True)
        url = generate_url(
            output_name=output_name,
            prompt=prompt,
            template=template,
            style_guide=style_guide,
        )
        raw = work / f"candidate-{index}-raw.png"
        download(url, raw)
        package = package_candidate(raw, work, index, spec, args.key)
        records.append(
            {
                "index": index,
                "key": args.key,
                "provider": spec["provider"],
                "model": spec["model"],
                "resolution": spec["canvas"]["generationResolution"],
                "url": url,
                "rawPath": str(raw.relative_to(ROOT)).replace("\\", "/"),
                "templateSha256": hashlib.sha256(template.read_bytes()).hexdigest(),
                "styleGuideSha256": (
                    hashlib.sha256(style_guide.read_bytes()).hexdigest()
                    if style_guide is not None
                    else None
                ),
                "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
                "createdAt": datetime.now(timezone.utc).isoformat(),
                **package,
            }
        )
        print(f"  saved {package['masterPath']} and {package['reviewPath']}", flush=True)
    (work / "candidates.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def cmd_package(args: argparse.Namespace) -> None:
    spec = load_spec()
    background_for(spec, args.key)
    raw = project_path(args.input, label="candidate input")
    work = WORK_ROOT / args.key
    work.mkdir(parents=True, exist_ok=True)
    package = package_candidate(raw, work, args.index, spec, args.key)
    records_path = work / "candidates.json"
    records: list[dict[str, Any]] = []
    if records_path.exists():
        records = json.loads(records_path.read_text(encoding="utf-8"))
    record = next(
        (item for item in records if item.get("index") == args.index),
        None,
    )
    if record is None:
        with Image.open(raw) as opened:
            source_resolution = f"{opened.width}x{opened.height}"
        record = {
            "index": args.index,
            "key": args.key,
            "provider": args.provider,
            "model": args.model,
            "resolution": source_resolution,
            "rawPath": str(raw.relative_to(ROOT)).replace("\\", "/"),
            "rawSha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        records.append(record)
    record.update(package)
    records_path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(package, indent=2))


def cmd_export(args: argparse.Namespace) -> None:
    spec = load_spec()
    background = background_for(spec, args.key)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", args.asset_name):
        raise SystemExit("asset_name may contain only lowercase letters, digits, and hyphens")
    work = WORK_ROOT / args.key
    records_path = work / "candidates.json"
    if not records_path.exists():
        raise SystemExit(f"Missing candidate records: {records_path.relative_to(ROOT)}")
    records = json.loads(records_path.read_text(encoding="utf-8"))
    record = next((item for item in records if item.get("index") == args.index), None)
    if not isinstance(record, dict):
        raise SystemExit(f"Candidate {args.index} does not exist for {args.key}")

    sources = {
        "master": project_path(record["masterPath"], label="candidate master"),
        "runtime": project_path(record["reviewPath"], label="candidate review"),
        "guide": project_path(record["platformGuidePath"], label="platform guide"),
    }
    design_dir = ROOT / "design" / "exploration-backgrounds" / "candidates"
    runtime_dir = (
        ROOT
        / "assets"
        / "images"
        / "katchimeras"
        / "world"
        / "backgrounds"
    )
    design_dir.mkdir(parents=True, exist_ok=True)
    runtime_dir.mkdir(parents=True, exist_ok=True)
    destinations = {
        "master": design_dir / f"{args.asset_name}-master-2k.png",
        "runtime": runtime_dir / f"{args.asset_name}.png",
        "guide": design_dir / f"{args.asset_name}-platform-guide.png",
    }
    existing = [path for path in destinations.values() if path.exists()]
    metadata_path = design_dir / f"{args.asset_name}.json"
    if metadata_path.exists():
        existing.append(metadata_path)
    if existing:
        names = ", ".join(str(path.relative_to(ROOT)) for path in existing)
        raise SystemExit(f"Refusing to overwrite exported assets: {names}")
    for role, source in sources.items():
        shutil.copy2(source, destinations[role])

    metadata = {
        "assetName": args.asset_name,
        "status": "generated-candidate",
        "key": args.key,
        "displayName": background["displayName"],
        "pipelineVersion": spec["pipelineVersion"],
        "candidate": record,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "outputs": {
            role: str(path.relative_to(ROOT)).replace("\\", "/")
            for role, path in destinations.items()
        },
        "sha256": {
            role: hashlib.sha256(path.read_bytes()).hexdigest()
            for role, path in destinations.items()
        },
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    write_runtime_registry()
    print(json.dumps(metadata, indent=2))


def cmd_registry(_args: argparse.Namespace) -> None:
    write_runtime_registry()


def cmd_validate(_args: argparse.Namespace) -> None:
    spec = load_spec()
    validated: list[dict[str, Any]] = []
    for key in sorted(spec.get("backgrounds", {})):
        background = background_for(spec, key)
        template = project_path(background["template"], label=f"{key} template")
        prompt = prompt_for(spec, key)
        validated.append(
            {
                "key": key,
                "referenceCount": 1,
                "template": str(template.relative_to(ROOT)).replace("\\", "/"),
                "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            }
        )
    print(
        json.dumps(
            {
                "status": "valid",
                "pipelineVersion": spec["pipelineVersion"],
                "providerPromptContract": spec["providerPromptContract"],
                "backgrounds": validated,
            },
            indent=2,
        )
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser(
        "validate",
        help="validate every provider prompt and its single-reference contract",
    )
    validate.set_defaults(func=cmd_validate)
    plan = commands.add_parser("plan", help="write the resolved prompt and provenance without generating")
    plan.add_argument("key")
    plan.set_defaults(func=cmd_plan)
    generate = commands.add_parser("generate", help="generate 2K FAL candidates and 1K review assets")
    generate.add_argument("key")
    generate.add_argument("positional_count", nargs="?", type=int)
    generate.add_argument("--count", type=int, default=1)
    generate.set_defaults(func=cmd_generate)
    package = commands.add_parser(
        "package",
        help="normalize an existing square candidate and create review/QA outputs",
    )
    package.add_argument("key")
    package.add_argument("input")
    package.add_argument("--index", type=int, default=1)
    package.add_argument("--provider", default="imported")
    package.add_argument("--model", default="external")
    package.set_defaults(func=cmd_package)
    export = commands.add_parser(
        "export",
        help="save one reviewed candidate as versioned 2K design and 1K runtime assets",
    )
    export.add_argument("key")
    export.add_argument("index", type=int)
    export.add_argument("asset_name")
    export.set_defaults(func=cmd_export)
    registry = commands.add_parser(
        "registry",
        help="rebuild the Metro-safe runtime source registry from exported candidates",
    )
    registry.set_defaults(func=cmd_registry)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "positional_count", None) is not None:
        args.count = args.positional_count
    if getattr(args, "count", 1) < 1:
        parser.error("--count must be at least 1")
    args.func(args)


if __name__ == "__main__":
    main()
