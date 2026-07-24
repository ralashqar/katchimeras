#!/usr/bin/env python3
"""Generate, review, promote, and validate Today atmosphere backgrounds."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageOps
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "design" / "today-atmosphere-backgrounds" / "manifest.json"
WORK_ROOT = ROOT / ".tmp" / "today-atmosphere-backgrounds"
ASSET_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "today-atmosphere"
REGISTRY_PATH = ROOT / "constants" / "today-atmosphere-background-sources.gen.ts"


def load_spec() -> dict[str, Any]:
    try:
        return json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Could not read {SPEC_PATH.relative_to(ROOT)}: {exc}") from None


def scene_for(spec: dict[str, Any], scene_id: str) -> dict[str, Any]:
    scene = spec.get("scenes", {}).get(scene_id)
    if not isinstance(scene, dict):
        known = ", ".join(sorted(spec.get("scenes", {})))
        raise SystemExit(f"Unknown scene {scene_id!r}. Known scenes: {known}")
    return scene


def project_path(value: str, *, label: str) -> Path:
    path = (ROOT / value).resolve()
    try:
        path.relative_to(ROOT)
    except ValueError:
        raise SystemExit(f"{label} must stay inside the project: {value}") from None
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")
    return path


def mime_for(path: Path) -> str:
    if path.suffix.lower() == ".webp":
        return "image/webp"
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        return "image/jpeg"
    return "image/png"


def file_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def load_env() -> tuple[str, str]:
    values: dict[str, str] = {}
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                values[key] = value.strip().strip('"').strip("'")
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase URL/key in .env.local.")
    return url.rstrip("/"), key


def call_function(name: str, payload: dict[str, Any], *, timeout: int = 180, retries: int = 4) -> dict[str, Any]:
    url, key = load_env()
    encoded = json.dumps(payload).encode("utf-8")
    for attempt in range(1, retries + 1):
        request = urllib.request.Request(
            f"{url}/functions/v1/{name}",
            data=encoded,
            headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            if exc.code in {429, 500, 502, 503, 504} and attempt < retries:
                time.sleep(min(8, 2 ** (attempt - 1)))
                continue
            raise RuntimeError(f"{name} HTTP {exc.code}: {body[:1200]}") from None
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < retries:
                time.sleep(min(8, 2 ** (attempt - 1)))
                continue
            raise RuntimeError(f"{name} transport failure: {exc}") from None
    raise RuntimeError(f"{name} failed after {retries} attempts")


def generation_reference(spec: dict[str, Any], scene_id: str) -> Path:
    if scene_id == "clear_day":
        return project_path(spec["bootstrapReference"], label="bootstrap reference")
    master = scene_for(spec, "clear_day").get("approved")
    if not isinstance(master, dict) or not isinstance(master.get("asset"), str):
        raise SystemExit("Approve clear_day before generating atmosphere variants.")
    return project_path(master["asset"], label="approved clear-day master")


def prompt_for(spec: dict[str, Any], scene_id: str) -> str:
    scene = scene_for(spec, scene_id)
    role = "CREATE THE MASTER COMPOSITION" if scene_id == "clear_day" else "EDIT THE APPROVED MASTER"
    reference_rule = (
        "Image 1 is style and material inspiration only. Preserve its rounded toy-like rendering language, but do "
        "not preserve its land layout. Rebuild it as an expansive high-altitude sky plate with no path, foreground "
        "stage, continuous terrain, or central object."
        if scene_id == "clear_day"
        else "Image 1 is the approved clear-day sky master. Preserve its exact camera, cloud scale, distant floating "
        "silhouette placement, atmospheric depth bands, quiet center, and edge framing; change only weather, "
        "season, palette, and light."
    )
    return "\n\n".join([
        f"{role}\n{reference_rule}",
        (
            "OUTPUT\nOne edge-to-edge portrait background at 9:16, designed to package at 945x1680. It is a scenic "
            "plate behind a separately rendered floating environment, egg, creature, particles, and UI."
        ),
        (
            "COMPOSITION LOCK\nThe entire frame is a high-altitude sky world; at least 80% of the pixels must be open "
            "sky, atmospheric haze, or soft clouds. There is no terrestrial horizon and no continuous ground plane "
            "touching the bottom or side edges. Small faraway floating cliff-islands may occupy only the outer side "
            "edges between 28-58% height and together cover no more than 12% of the frame. They must read as distant "
            "world context, never as the playable platform. Keep the central 48% width visually quiet from 22-82% "
            "height and keep the lower 38% primarily open sky so the separately rendered live floating hex tile has "
            "clean silhouette contrast. Keep cloud and distant-island positions identical across the authored set."
        ),
        (
            "ART STYLE\nPremium cozy stylized 3D Katchimeras mobile-game environment art: chunky designer-toy "
            "geometry, rounded clay-like forms, broad smooth bevels, low-frequency detail, tactile clean materials, "
            "soft ambient occlusion, cinematic global illumination, readable silhouettes, polished hero quality. "
            "No photorealism, painterly brushwork, flat vector art, noisy microtexture, harsh realism, or gradient banding."
        ),
        f"SCENE\n{scene['displayName']}: {scene['brief']}. Palette: {scene['palette']}.",
        (
            "ABSOLUTE EXCLUSIONS\nNo creature, character, person, animal, egg, nest, foreground island, large floating "
            "land mass, hex tile, playable platform, pedestal, stage, plaza, courtyard, floor, terrestrial horizon, "
            "foreground path, stairs, bridge, building focal point, "
            "UI, text, letters, numbers, logo, watermark, frame, transparency, black void, painted rain streaks, "
            "painted snowflakes, lightning bolt, or particle effects. No land may connect across the frame or touch "
            "the bottom edge. No large prop in the central quiet zone."
        ),
        (
            "FINAL QUALITY\nSmooth coherent depth, clean rounded forms, restrained contrast behind the subject area, "
            "no duplicate clouds, warped landscape, muddy corners, seams, splotches, or melted geometry."
        ),
    ])


def revision_prompt(spec: dict[str, Any], scene_id: str, instruction: str) -> str:
    scene = scene_for(spec, scene_id)
    return "\n\n".join([
        "Image 1 is the exact candidate to edit. Preserve its canvas, camera, open-sky ratio, distant floating silhouettes, quiet central zone, and all unaffected details.",
        f"Target scene remains {scene['displayName']}: {scene['brief']}. Palette: {scene['palette']}.",
        f"PRECISE EDIT\n{instruction}",
        "Keep all production exclusions: no creature, egg, foreground island, large land mass, tile, platform, terrestrial horizon, path, stairs, UI, text, particle marks, or central focal prop.",
    ])


def queued_generate(*, output_name: str, prompt: str, reference: Path, model: str, quality: str, resolution: str, width: int, height: int) -> str:
    payload = {
        "action": "generate",
        "model": model,
        "mode": "single",
        "outputName": output_name,
        "prompt": prompt,
        "referenceBase64": file_b64(reference),
        "referenceMime": mime_for(reference),
        "aspectRatio": "9:16",
        "resolution": resolution,
        "gptImageWidth": width,
        "gptImageHeight": height,
        "gptQuality": quality,
    }
    result = call_function("generate-asset", payload, timeout=150)
    if result.get("status") == "completed" and isinstance(result.get("imageUrl"), str):
        return str(result["imageUrl"])
    request_id = result.get("requestId")
    if not request_id:
        raise RuntimeError(f"{output_name}: generation did not queue: {result}")
    print(f"  queued {request_id}", flush=True)
    for attempt in range(1, 121):
        time.sleep(8)
        poll = call_function("generate-asset", {
            "action": "poll",
            "model": model,
            "mode": "single",
            "outputName": output_name,
            "requestId": request_id,
            "rawResult": True,
        })
        print(f"  poll {attempt}/120: {poll.get('status')} {poll.get('queueStatus', '')}", flush=True)
        if poll.get("status") == "completed" and isinstance(poll.get("imageUrl"), str):
            return str(poll["imageUrl"])
    raise TimeoutError(f"{output_name}: generation did not complete")


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def package_image(source: Path, destination: Path, spec: dict[str, Any]) -> dict[str, Any]:
    canvas = spec["canvas"]
    target = (int(canvas["width"]), int(canvas["height"]))
    with Image.open(source) as opened:
        source_size = opened.size
        image = ImageOps.fit(opened.convert("RGB"), target, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=int(canvas["webpQuality"]), method=6, exact=True)
    return {
        "source": str(source),
        "sourceSize": list(source_size),
        "output": str(destination),
        "outputSize": list(target),
        "bytes": destination.stat().st_size,
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "webpQuality": int(canvas["webpQuality"]),
    }


def sync_registry(spec: dict[str, Any]) -> None:
    rows: list[str] = []
    for scene_id, scene in spec["scenes"].items():
        approved = scene.get("approved")
        if not isinstance(approved, dict):
            continue
        rows.extend([
            f"  {scene_id}: {{",
            f"    id: {json.dumps(str(approved['id']))},",
            f"    source: require('../{approved['asset']}'),",
            "  },",
        ])
    body = "\n".join([
        "/* Generated by scripts/generate-today-atmosphere-backgrounds.py. */",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "import type { DayBackgroundSceneId } from '@/types/home';",
        "",
        "export type BundledTodayAtmosphereBackground = {",
        "  id: string;",
        "  source: ImageSourcePropType;",
        "};",
        "",
        "export const TODAY_ATMOSPHERE_BACKGROUND_SOURCES: Record<",
        "  DayBackgroundSceneId,",
        "  BundledTodayAtmosphereBackground",
        "> = {",
        *rows,
        "};",
        "",
    ])
    REGISTRY_PATH.write_text(body, encoding="utf-8")


def cmd_plan(args: argparse.Namespace) -> None:
    spec = load_spec()
    reference = generation_reference(spec, args.scene_id)
    prompt = prompt_for(spec, args.scene_id)
    work = WORK_ROOT / args.scene_id
    work.mkdir(parents=True, exist_ok=True)
    (work / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    print(json.dumps({
        "sceneId": args.scene_id,
        "reference": str(reference.relative_to(ROOT)).replace("\\", "/"),
        "prompt": str((work / "prompt.txt").relative_to(ROOT)).replace("\\", "/"),
        "canvas": spec["canvas"],
    }, indent=2))


def cmd_generate(args: argparse.Namespace) -> None:
    spec = load_spec()
    reference = generation_reference(spec, args.scene_id)
    prompt = prompt_for(spec, args.scene_id)
    work = WORK_ROOT / args.scene_id
    work.mkdir(parents=True, exist_ok=True)
    (work / "prompt.txt").write_text(prompt + "\n", encoding="utf-8")
    records: list[dict[str, Any]] = []
    for index in range(1, args.count + 1):
        output_name = f"today-atmosphere-{args.scene_id.replace('_', '-')}-{index}"
        print(f"generating {output_name} via {args.model}...", flush=True)
        url = queued_generate(
            output_name=output_name,
            prompt=prompt,
            reference=reference,
            model=args.model,
            quality=args.quality,
            resolution=args.resolution,
            width=args.width,
            height=args.height,
        )
        raw = work / f"candidate-{index}.png"
        download(url, raw)
        preview = work / f"candidate-{index}.webp"
        packaged = package_image(raw, preview, spec)
        records.append({
            "index": index,
            "sceneId": args.scene_id,
            "model": args.model,
            "quality": args.quality,
            "reference": str(reference.relative_to(ROOT)).replace("\\", "/"),
            "url": url,
            "rawPath": str(raw.relative_to(ROOT)).replace("\\", "/"),
            "previewPath": str(preview.relative_to(ROOT)).replace("\\", "/"),
            "packaged": packaged,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        print(f"  saved {raw.relative_to(ROOT)}", flush=True)
    (work / "candidates.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


def cmd_revise(args: argparse.Namespace) -> None:
    spec = load_spec()
    scene_for(spec, args.scene_id)
    source = Path(args.input).resolve()
    if not source.exists():
        raise SystemExit(f"Missing revision input: {source}")
    prompt = revision_prompt(spec, args.scene_id, args.instruction)
    work = WORK_ROOT / args.scene_id / "revisions"
    work.mkdir(parents=True, exist_ok=True)
    for index in range(1, args.count + 1):
        output_name = f"today-atmosphere-{args.scene_id.replace('_', '-')}-revision-{index}"
        url = queued_generate(
            output_name=output_name,
            prompt=prompt,
            reference=source,
            model=args.model,
            quality=args.quality,
            resolution=args.resolution,
            width=args.width,
            height=args.height,
        )
        raw = work / f"revision-{index}.png"
        download(url, raw)
        package_image(raw, work / f"revision-{index}.webp", spec)
        print(f"saved {raw.relative_to(ROOT)}")


def cmd_contact_sheet(args: argparse.Namespace) -> None:
    spec = load_spec()
    scene_ids = args.scene_id
    cards: list[tuple[str, Path]] = []
    for scene_id in scene_ids:
        scene_for(spec, scene_id)
        for candidate in sorted((WORK_ROOT / scene_id).glob("candidate-*.webp")):
            cards.append((f"{scene_id} / {candidate.stem}", candidate))
    if not cards:
        raise SystemExit("No packaged candidates found for the requested scenes.")
    card_width, card_height, label_height = 315, 560, 32
    columns = min(3, len(cards))
    rows = (len(cards) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * card_width, rows * (card_height + label_height)), "#141820")
    draw = ImageDraw.Draw(sheet)
    for index, (label, path) in enumerate(cards):
        with Image.open(path) as opened:
            preview = ImageOps.fit(opened.convert("RGB"), (card_width, card_height), method=Image.Resampling.LANCZOS)
        x = (index % columns) * card_width
        y = (index // columns) * (card_height + label_height)
        sheet.paste(preview, (x, y))
        draw.text((x + 8, y + card_height + 9), label, fill="#F5F0E8")
    slug = "-".join(scene_ids)
    output = WORK_ROOT / f"contact-sheet-{slug}.jpg"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "JPEG", quality=91, optimize=True)
    print(output.relative_to(ROOT))


def cmd_promote(args: argparse.Namespace) -> None:
    spec = load_spec()
    scene = scene_for(spec, args.scene_id)
    source = Path(args.input).resolve()
    if not source.exists():
        raise SystemExit(f"Missing promotion input: {source}")
    destination = ASSET_ROOT / f"{args.scene_id.replace('_', '-')}.webp"
    packaged = package_image(source, destination, spec)
    if packaged["bytes"] > int(spec["canvas"]["maxProductionBytes"]):
        destination.unlink(missing_ok=True)
        raise SystemExit(f"Packaged asset is {packaged['bytes']} bytes; maximum is {spec['canvas']['maxProductionBytes']}.")
    scene["approved"] = {
        "id": args.id or f"{args.scene_id.replace('_', '-')}-v1",
        "asset": str(destination.relative_to(ROOT)).replace("\\", "/"),
        "sha256": packaged["sha256"],
    }
    SPEC_PATH.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    sync_registry(spec)
    print(json.dumps({"promoted": scene["approved"], "package": packaged}, indent=2))


def cmd_sync_registry(_args: argparse.Namespace) -> None:
    spec = load_spec()
    sync_registry(spec)
    print(REGISTRY_PATH.relative_to(ROOT))


def cmd_validate(_args: argparse.Namespace) -> None:
    spec = load_spec()
    expected = (int(spec["canvas"]["width"]), int(spec["canvas"]["height"]))
    maximum = int(spec["canvas"]["maxProductionBytes"])
    errors: list[str] = []
    for scene_id, scene in spec["scenes"].items():
        approved = scene.get("approved")
        if not isinstance(approved, dict):
            errors.append(f"{scene_id}: no approved asset")
            continue
        path = ROOT / approved.get("asset", "")
        if not path.exists():
            errors.append(f"{scene_id}: missing {approved.get('asset')}")
            continue
        with Image.open(path) as image:
            if image.size != expected:
                errors.append(f"{scene_id}: expected {expected}, found {image.size}")
            if image.mode != "RGB":
                errors.append(f"{scene_id}: expected RGB, found {image.mode}")
        if path.suffix.lower() != ".webp":
            errors.append(f"{scene_id}: asset is not WebP")
        if path.stat().st_size > maximum:
            errors.append(f"{scene_id}: {path.stat().st_size} bytes exceeds {maximum}")
        if hashlib.sha256(path.read_bytes()).hexdigest() != approved.get("sha256"):
            errors.append(f"{scene_id}: sha256 does not match manifest")
    expected_registry = REGISTRY_PATH.read_text(encoding="utf-8") if REGISTRY_PATH.exists() else ""
    sync_registry(spec)
    if expected_registry and REGISTRY_PATH.read_text(encoding="utf-8") != expected_registry:
        errors.append("generated registry was stale (it has now been synchronized)")
    if errors:
        print("Today atmosphere background validation failed:")
        for error in errors:
            print(f"  - {error}")
        raise SystemExit(1)
    print(f"Today atmosphere backgrounds OK: {len(spec['scenes'])} approved")


def add_generation_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--count", type=int, default=3)
    parser.add_argument("--model", choices=("gpt", "nano", "seedream"), default="gpt")
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    parser.add_argument("--resolution", choices=("1K", "2K"), default="2K")
    parser.add_argument("--width", type=int, default=1152)
    parser.add_argument("--height", type=int, default=2048)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan")
    plan.add_argument("--scene-id", required=True)
    plan.set_defaults(func=cmd_plan)
    generate = commands.add_parser("generate")
    generate.add_argument("--scene-id", required=True)
    add_generation_args(generate)
    generate.set_defaults(func=cmd_generate)
    revise = commands.add_parser("revise")
    revise.add_argument("--scene-id", required=True)
    revise.add_argument("--input", required=True)
    revise.add_argument("--instruction", required=True)
    add_generation_args(revise)
    revise.set_defaults(func=cmd_revise)
    sheet = commands.add_parser("contact-sheet")
    sheet.add_argument("--scene-id", nargs="+", required=True)
    sheet.set_defaults(func=cmd_contact_sheet)
    promote = commands.add_parser("promote")
    promote.add_argument("--scene-id", required=True)
    promote.add_argument("--input", required=True)
    promote.add_argument("--id")
    promote.set_defaults(func=cmd_promote)
    sync = commands.add_parser("sync-registry")
    sync.set_defaults(func=cmd_sync_registry)
    validate = commands.add_parser("validate")
    validate.set_defaults(func=cmd_validate)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "count", 1) < 1:
        parser.error("--count must be at least 1")
    args.func(args)


if __name__ == "__main__":
    main()
