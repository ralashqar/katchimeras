#!/usr/bin/env python3
"""Generate, package, promote, and validate Today full-spread environments.

The environment's selected Kingdom hex art is reference image 1 (identity).
Feastle's approved full spread is reference image 2 (composition/style only).
Candidates are never shipped automatically; ``promote`` is the explicit gate.

Examples:
  python scripts/generate-today-full-spread.py plan --visual-key mossprout
  python scripts/generate-today-full-spread.py generate --visual-key mossprout --count 3
  python scripts/generate-today-full-spread.py package --visual-key feastle --input path/to/source.png
  python scripts/generate-today-full-spread.py promote --visual-key mossprout --input .tmp/today-full-spread/mossprout/candidate-1.png
  python scripts/generate-today-full-spread.py validate
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path, asset_specifier, resolve_asset_specifier


import argparse
import base64
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - actionable CLI dependency error
    raise SystemExit("Pillow is required: python -m pip install pillow") from exc


ROOT = game_root()
SPEC_PATH = content_path(ROOT, "design") / "today-full-spread" / "environments.json"
WORK_ROOT = content_path(ROOT, ".tmp") / "today-full-spread"
ASSET_ROOT = content_path(ROOT, "assets") / "images" / "katchimeras" / "world" / "today"
REGISTRY_PATH = content_path(ROOT, "constants") / "today-full-spread-scene-sources.gen.ts"


def load_spec() -> dict[str, Any]:
    try:
        return json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Could not read {logical_path(ROOT, SPEC_PATH)}: {exc}") from None


def environment_for(spec: dict[str, Any], visual_key: str) -> dict[str, Any]:
    environment = spec.get("environments", {}).get(visual_key)
    if not isinstance(environment, dict):
        known = ", ".join(sorted(spec.get("environments", {})))
        raise SystemExit(f"Unknown visual key {visual_key!r}. Known keys: {known}")
    return environment


def project_path(value: str, *, label: str) -> Path:
    path = (content_path(ROOT, value)).resolve()
    try:
        logical_path(ROOT, path)
    except ValueError:
        raise SystemExit(f"{label} must stay inside the project: {value}") from None
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")
    return path


def mime_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".webp":
        return "image/webp"
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    return "image/png"


def file_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    for name in (".env.local", ".env"):
        path = content_path(ROOT, name)
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env[key] = value.strip().strip('"').strip("'")
    url = env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase URL/key in .env.local.")
    return url.rstrip("/"), key


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
                print(
                    f"  {name} HTTP {exc.code}; retrying in {delay}s "
                    f"({attempt}/{retries})...",
                    flush=True,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} HTTP {exc.code}: {body[:1200]}") from None
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < retries:
                delay = min(8, 2 ** (attempt - 1))
                print(
                    f"  {name} transport error; retrying in {delay}s "
                    f"({attempt}/{retries})...",
                    flush=True,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} transport failure: {exc}") from None
    raise RuntimeError(f"{name} failed after {retries} attempts")


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def prompt_for(spec: dict[str, Any], visual_key: str) -> str:
    environment = environment_for(spec, visual_key)
    canvas = spec["canvas"]
    return "\n\n".join(
        [
            (
                "REFERENCE ROLES\n"
                "Edit and expand image 1 into a complete environment. Image 1 is the authoritative identity, "
                "architecture, materials, palette, and Katchimera-specific habitat reference. Image 2 is only the "
                "approved composition, camera, proportions, spatial density, lighting softness, and finish guide. "
                "Do not copy image 2's Feastle kitchen objects into another creature's habitat."
            ),
            (
                f"OUTPUT\nOne edge-to-edge portrait environment at exact {canvas['aspectRatio']} composition, "
                f"designed to package at {canvas['width']}x{canvas['height']}. The scene fills the entire canvas "
                "with no border, transparency, vignette, frame, card, UI, labels, lettering, numbers, logos, "
                "watermarks, creature, character, person, animal, egg, nest, pedestal, hex tile, floating island "
                "edge, black studio background, or empty void."
            ),
            (
                "ART STYLE\nPremium cozy stylized 3D mobile-game environment, matching Katchimeras: chunky "
                "designer-toy geometry, rounded clay-like forms, broad smooth bevels, tactile but clean materials, "
                "low-frequency detail, soft ambient occlusion, warm cinematic global illumination, polished edges, "
                "clear readable silhouettes, friendly magical cottagecore mood, and crisp hero-quality rendering. "
                "No photorealism, painterly brushwork, flat vector art, noisy microtexture, or harsh realism."
            ),
            (
                f"ENVIRONMENT IDENTITY\n{environment['displayName']}: {environment['theme']}. "
                f"Palette: {environment['palette']}. Preserve this signature landmark: {environment['signature']}."
            ),
            (
                "FIXED COMPOSITION GUIDE\nUse the same portrait spatial proportions for every Katchimera. "
                "Top 0-18%: open blue/atmospheric sky and a distant soft landscape, with no important focal object. "
                "Upper 15-38%: the main rear landmark and habitat architecture, broad and readable rather than tall. "
                "Middle 34-72%: ONE broad, open, uncluttered, single-level main character stage centered at 50% "
                "canvas width and about 50% canvas height. The stage is one continuous floor plane extending back "
                "to the themed architecture; floor detail may continue through it, but no large prop may block it. "
                "Lower 72-100%: a foreground approach that contains exactly ONE centered set of entrance stairs, "
                "leading directly and continuously onto the main stage. This is the only staircase or level change "
                "anywhere in the entire image. After these entrance stairs, the stage and all rear environment floor "
                "remain on one uninterrupted level. If image 1 contains stairs at the front of its hex tile, RELOCATE "
                "those stairs to this single lower foreground entrance; do not preserve or copy them at their original "
                "mid-image position. The source stairs and portrait stairs are the same one staircase, never two. "
                "Place small framing props toward the lower corners, "
                "never in the central 38% width. Keep the horizon, rear landmark, stage, entrance, and foreground at "
                "the same normalized heights as image 2. Use a symmetrical or softly balanced front-facing wide "
                "establishing camera; no fisheye, dutch angle, close crop, or extreme perspective."
            ),
            (
                "FINAL QUALITY\nSmooth gradients and shadows with no splotches, banding, muddy corners, warped "
                "geometry, duplicate props, broken stairs, incoherent scale, or melted object edges. Absolutely no "
                "second staircase, rear staircase, side staircase, duplicated staircase, stacked terrace, split-level "
                "stage, stepped platform, raised inner stage, or extra steps behind the main entrance stairs. Keep fine detail "
                "subordinate to the large composition so the scene reads cleanly behind a separately composited creature."
            ),
        ]
    )


def revision_prompt_for(spec: dict[str, Any], visual_key: str, instruction: str) -> str:
    environment = environment_for(spec, visual_key)
    return "\n\n".join(
        [
            (
                "EDIT TARGET\nImage 1 is the exact portrait environment to edit. Preserve its canvas, camera, "
                "cinematic lighting, palette, materials, vegetation, skyline, main architecture, props, and all "
                "parts not explicitly changed below. Image 2 is the original habitat identity reference only."
            ),
            (
                f"ENVIRONMENT IDENTITY\n{environment['displayName']}: {environment['theme']}. "
                f"Preserve this signature landmark: {environment['signature']}."
            ),
            f"PRECISE EDIT\n{instruction}",
            (
                "NON-NEGOTIABLE GEOMETRY\nThe final image has exactly ONE centered staircase total, located in the "
                "lower foreground. It leads directly onto ONE broad, continuous, single-level main stage. Remove "
                "every inner, middle, rear, side, secondary, duplicated, or stacked stair. Where a removed inner "
                "staircase existed, extend the main stage floor seamlessly through that area at the same elevation. "
                "Do not replace it with a ramp, curb, ledge, terrace, platform, or any other level change."
            ),
            (
                "CONSTRAINTS\nNo creature, character, person, animal, egg, nest, UI, text, letters, numbers, logo, "
                "watermark, card frame, transparency, black studio background, or new focal prop. Smooth coherent "
                "geometry and shadows; no warped edges, seams, duplicated objects, or splotchy retouching."
            ),
        ]
    )


def queued_generate(
    *,
    output_name: str,
    prompt: str,
    reference: Path,
    guide: Path,
    model: str,
    quality: str,
    resolution: str,
    width: int,
    height: int,
) -> str:
    payload: dict[str, Any] = {
        "action": "generate",
        "model": model,
        "mode": "single",
        "outputName": output_name,
        "prompt": prompt,
        "referenceBase64": file_b64(reference),
        "referenceMime": mime_for(reference),
        "guideBase64": file_b64(guide),
        "guideMime": mime_for(guide),
        "aspectRatio": "9:16",
        "resolution": resolution,
        "gptImageWidth": width,
        "gptImageHeight": height,
        "gptQuality": quality,
    }
    data = call_function("generate-asset", payload, timeout=150)
    if data.get("status") == "completed" and isinstance(data.get("imageUrl"), str):
        return str(data["imageUrl"])
    request_id = data.get("requestId")
    if not request_id:
        raise RuntimeError(f"{output_name}: generation did not queue: {data}")
    print(f"  queued {request_id}", flush=True)
    for attempt in range(1, 121):
        time.sleep(8)
        poll = call_function(
            "generate-asset",
            {
                "action": "poll",
                "model": model,
                "mode": "single",
                "outputName": output_name,
                "requestId": request_id,
                "rawResult": True,
            },
            timeout=180,
        )
        print(f"  poll {attempt}/120: {poll.get('status')} {poll.get('queueStatus', '')}", flush=True)
        if poll.get("status") == "completed" and isinstance(poll.get("imageUrl"), str):
            return str(poll["imageUrl"])
    raise TimeoutError(f"{output_name}: generation did not complete")


def package_image(source: Path, destination: Path, spec: dict[str, Any]) -> dict[str, Any]:
    canvas = spec["canvas"]
    target = (int(canvas["width"]), int(canvas["height"]))
    quality = int(canvas["webpQuality"])
    with Image.open(source) as opened:
        image = opened.convert("RGB")
        source_size = image.size
        source_ratio = image.width / image.height
        target_ratio = target[0] / target[1]
        if source_ratio > target_ratio:
            resized_height = target[1]
            resized_width = round(image.width * resized_height / image.height)
        else:
            resized_width = target[0]
            resized_height = round(image.height * resized_width / image.width)
        image = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)
        left = max(0, (resized_width - target[0]) // 2)
        top = max(0, (resized_height - target[1]) // 2)
        image = image.crop((left, top, left + target[0], top + target[1]))
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=quality, method=6, exact=True)
    return {
        "source": str(source),
        "sourceSize": list(source_size),
        "output": str(destination),
        "outputSize": list(target),
        "bytes": destination.stat().st_size,
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "webpQuality": quality,
    }


def sync_registry(spec: dict[str, Any]) -> None:
    rows: list[str] = []
    for visual_key, environment in sorted(spec["environments"].items()):
        approved = environment.get("approved")
        if not isinstance(approved, dict):
            continue
        asset = str(approved["asset"])
        rows.extend(
            [
                f"  {visual_key}: {{",
                f"    id: {json.dumps(str(approved['id']))},",
                f"    source: require('{asset_specifier(ROOT, asset)}'),",
                "  },",
            ]
        )
    body = "\n".join(
        [
            "/* This file is generated by scripts/generate-today-full-spread.py. */",
            "import type { ImageSourcePropType } from 'react-native';",
            "",
            "import type { HomeVisualKey } from '@/types/home';",
            "",
            "export type BundledTodayFullSpreadScene = {",
            "  id: string;",
            "  source: ImageSourcePropType;",
            "};",
            "",
            "export const TODAY_FULL_SPREAD_SCENE_SOURCES: Partial<",
            "  Record<HomeVisualKey, BundledTodayFullSpreadScene>",
            "> = {",
            *rows,
            "};",
            "",
        ]
    )
    REGISTRY_PATH.write_text(body, encoding="utf-8")


def cmd_plan(args: argparse.Namespace) -> None:
    spec = load_spec()
    environment = environment_for(spec, args.visual_key)
    reference = project_path(environment["reference"], label="environment reference")
    guide = project_path(spec["styleGuide"], label="style guide")
    work = WORK_ROOT / args.visual_key
    work.mkdir(parents=True, exist_ok=True)
    prompt = prompt_for(spec, args.visual_key)
    prompt_path = work / "prompt.txt"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    plan = {
        "visualKey": args.visual_key,
        "reference": str(logical_path(ROOT, reference)).replace("\\", "/"),
        "styleGuide": str(logical_path(ROOT, guide)).replace("\\", "/"),
        "prompt": str(logical_path(ROOT, prompt_path)).replace("\\", "/"),
        "canvas": spec["canvas"],
    }
    (work / "plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(plan, indent=2))


def cmd_generate(args: argparse.Namespace) -> None:
    spec = load_spec()
    environment = environment_for(spec, args.visual_key)
    reference = project_path(environment["reference"], label="environment reference")
    guide = project_path(spec["styleGuide"], label="style guide")
    prompt = prompt_for(spec, args.visual_key)
    work = WORK_ROOT / args.visual_key
    work.mkdir(parents=True, exist_ok=True)
    (work / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    records: list[dict[str, Any]] = []
    for index in range(1, args.count + 1):
        output_name = f"today-full-spread-{args.visual_key}-{index}"
        print(f"generating {output_name} via {args.model}...", flush=True)
        image_url = queued_generate(
            output_name=output_name,
            prompt=prompt,
            reference=reference,
            guide=guide,
            model=args.model,
            quality=args.quality,
            resolution=args.resolution,
            width=args.width,
            height=args.height,
        )
        raw_path = work / f"candidate-{index}.png"
        download(image_url, raw_path)
        preview_path = work / f"candidate-{index}.webp"
        packaged = package_image(raw_path, preview_path, spec)
        record = {
            "index": index,
            "visualKey": args.visual_key,
            "model": args.model,
            "quality": args.quality,
            "resolution": args.resolution,
            "requestedSize": [args.width, args.height],
            "reference": str(logical_path(ROOT, reference)).replace("\\", "/"),
            "styleGuide": str(logical_path(ROOT, guide)).replace("\\", "/"),
            "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "url": image_url,
            "rawPath": str(logical_path(ROOT, raw_path)).replace("\\", "/"),
            "previewPath": str(logical_path(ROOT, preview_path)).replace("\\", "/"),
            "packaged": packaged,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        records.append(record)
        print(f"  saved {logical_path(ROOT, raw_path)} and {logical_path(ROOT, preview_path)}")
    (work / "candidates.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def cmd_revise(args: argparse.Namespace) -> None:
    spec = load_spec()
    environment = environment_for(spec, args.visual_key)
    source = Path(args.input).resolve()
    if not source.exists():
        raise SystemExit(f"Missing revision input: {source}")
    identity_reference = project_path(environment["reference"], label="environment identity reference")
    prompt = revision_prompt_for(spec, args.visual_key, args.instruction)
    work = WORK_ROOT / args.visual_key / "revisions"
    work.mkdir(parents=True, exist_ok=True)
    (work / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    records: list[dict[str, Any]] = []
    for index in range(1, args.count + 1):
        output_name = f"today-full-spread-{args.visual_key}-revision-{index}"
        print(f"revising {output_name} via {args.model}...", flush=True)
        image_url = queued_generate(
            output_name=output_name,
            prompt=prompt,
            reference=source,
            guide=identity_reference,
            model=args.model,
            quality=args.quality,
            resolution=args.resolution,
            width=args.width,
            height=args.height,
        )
        raw_path = work / f"revision-{index}.png"
        download(image_url, raw_path)
        preview_path = work / f"revision-{index}.webp"
        packaged = package_image(raw_path, preview_path, spec)
        records.append(
            {
                "index": index,
                "visualKey": args.visual_key,
                "model": args.model,
                "quality": args.quality,
                "instruction": args.instruction,
                "source": str(source),
                "identityReference": str(logical_path(ROOT, identity_reference)).replace("\\", "/"),
                "url": image_url,
                "rawPath": str(logical_path(ROOT, raw_path)).replace("\\", "/"),
                "previewPath": str(logical_path(ROOT, preview_path)).replace("\\", "/"),
                "packaged": packaged,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        )
        print(f"  saved {logical_path(ROOT, raw_path)} and {logical_path(ROOT, preview_path)}")
    (work / "revisions.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def cmd_package(args: argparse.Namespace) -> None:
    spec = load_spec()
    environment_for(spec, args.visual_key)
    source = Path(args.input).resolve()
    if not source.exists():
        raise SystemExit(f"Missing input: {source}")
    destination = ASSET_ROOT / f"{args.visual_key}-full-spread.webp"
    result = package_image(source, destination, spec)
    print(json.dumps(result, indent=2))


def cmd_promote(args: argparse.Namespace) -> None:
    spec = load_spec()
    environment = environment_for(spec, args.visual_key)
    source = Path(args.input).resolve()
    if not source.exists():
        raise SystemExit(f"Missing input: {source}")
    destination = ASSET_ROOT / f"{args.visual_key}-full-spread.webp"
    result = package_image(source, destination, spec)
    environment["approved"] = {
        "id": args.id or f"{args.visual_key}-full-spread-v1",
        "asset": str(logical_path(ROOT, destination)).replace("\\", "/"),
    }
    SPEC_PATH.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    sync_registry(spec)
    print(json.dumps({"promoted": environment["approved"], "package": result}, indent=2))


def cmd_sync_registry(_args: argparse.Namespace) -> None:
    spec = load_spec()
    sync_registry(spec)
    print(f"synced {logical_path(ROOT, REGISTRY_PATH)}")


def cmd_validate(_args: argparse.Namespace) -> None:
    spec = load_spec()
    canvas = spec["canvas"]
    expected_size = (int(canvas["width"]), int(canvas["height"]))
    max_bytes = int(canvas["maxProductionBytes"])
    errors: list[str] = []
    approved_count = 0
    for visual_key, environment in sorted(spec["environments"].items()):
        reference_value = environment.get("reference")
        if not isinstance(reference_value, str) or not (content_path(ROOT, reference_value)).exists():
            errors.append(f"{visual_key}: missing environment reference {reference_value!r}")
        approved = environment.get("approved")
        if not isinstance(approved, dict):
            continue
        approved_count += 1
        asset_value = approved.get("asset")
        if not isinstance(asset_value, str):
            errors.append(f"{visual_key}: approved.asset is missing")
            continue
        asset = content_path(ROOT, asset_value)
        if not asset.exists():
            errors.append(f"{visual_key}: missing approved asset {asset_value}")
            continue
        if asset.suffix.lower() != ".webp":
            errors.append(f"{visual_key}: approved asset must be WebP")
        with Image.open(asset) as image:
            if image.size != expected_size:
                errors.append(f"{visual_key}: expected {expected_size}, found {image.size}")
            if image.mode not in {"RGB", "RGBA"}:
                errors.append(f"{visual_key}: unexpected mode {image.mode}")
        if asset.stat().st_size > max_bytes:
            errors.append(f"{visual_key}: {asset.stat().st_size} bytes exceeds {max_bytes}")
    expected_registry = REGISTRY_PATH.read_text(encoding="utf-8") if REGISTRY_PATH.exists() else ""
    sync_registry(spec)
    actual_registry = REGISTRY_PATH.read_text(encoding="utf-8")
    if expected_registry and expected_registry != actual_registry:
        errors.append("generated registry was stale (it has now been synchronized)")
    if errors:
        print("Today full-spread validation failed:")
        for error in errors:
            print(f"  - {error}")
        raise SystemExit(1)
    print(f"Today full-spread validation OK: {approved_count} approved, {len(spec['environments'])} planned")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan = subparsers.add_parser("plan", help="write the resolved references and canonical prompt without generating")
    plan.add_argument("--visual-key", required=True)
    plan.set_defaults(func=cmd_plan)

    generate = subparsers.add_parser("generate", help="generate candidate images through the queued FAL pipeline")
    generate.add_argument("--visual-key", required=True)
    generate.add_argument("--count", type=int, default=1)
    generate.add_argument("--model", choices=("gpt", "nano"), default="gpt")
    generate.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    generate.add_argument("--resolution", choices=("1K", "2K"), default="2K")
    generate.add_argument("--width", type=int, default=1152)
    generate.add_argument("--height", type=int, default=2048)
    generate.set_defaults(func=cmd_generate)

    revise = subparsers.add_parser("revise", help="make a precise portrait edit while preserving habitat identity")
    revise.add_argument("--visual-key", required=True)
    revise.add_argument("--input", required=True)
    revise.add_argument("--instruction", required=True)
    revise.add_argument("--count", type=int, default=1)
    revise.add_argument("--model", choices=("gpt", "nano"), default="gpt")
    revise.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    revise.add_argument("--resolution", choices=("1K", "2K"), default="2K")
    revise.add_argument("--width", type=int, default=1152)
    revise.add_argument("--height", type=int, default=2048)
    revise.set_defaults(func=cmd_revise)

    package = subparsers.add_parser("package", help="normalize an image into the production WebP without changing the registry")
    package.add_argument("--visual-key", required=True)
    package.add_argument("--input", required=True)
    package.set_defaults(func=cmd_package)

    promote = subparsers.add_parser("promote", help="package a chosen candidate and register it for Today")
    promote.add_argument("--visual-key", required=True)
    promote.add_argument("--input", required=True)
    promote.add_argument("--id")
    promote.set_defaults(func=cmd_promote)

    sync = subparsers.add_parser("sync-registry", help="regenerate the static React Native asset registry")
    sync.set_defaults(func=cmd_sync_registry)

    validate = subparsers.add_parser("validate", help="validate references, production assets, dimensions, and registry")
    validate.set_defaults(func=cmd_validate)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "count", 1) < 1:
        parser.error("--count must be at least 1")
    if getattr(args, "width", 256) < 256 or getattr(args, "height", 256) < 256:
        parser.error("generation width and height must be at least 256")
    args.func(args)


if __name__ == "__main__":
    main()
