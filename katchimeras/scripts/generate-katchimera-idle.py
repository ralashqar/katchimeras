#!/usr/bin/env python3
"""Generate and package one Katchimera idle animation through the Supabase fal proxy."""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VISUAL_KEY = "mossprout"
DEFAULT_MANIFEST = ROOT / "data/katchimeras/idle-animations.json"
DEFAULT_REGISTRY = ROOT / "constants/creature-idle-animation-sources.ts"
GENERATION_MODEL = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video"
MATTE_MODEL = "bria/video/background-removal"
VISUAL_KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,128}$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
DEFAULT_MOTION_DIRECTION = (
    "subtle breathing, one soft natural blink, and very small secondary movement in flexible details"
)


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def resolve_project_path(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def project_relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError as error:
        raise RuntimeError(f"Promoted assets must be inside the repository: {path}") from error


def display_path(path: Path) -> str:
    try:
        return project_relative(path)
    except RuntimeError:
        return str(path)


def parse_hex_color(value: str) -> tuple[int, int, int]:
    if not HEX_COLOR_PATTERN.fullmatch(value):
        raise argparse.ArgumentTypeError("Expected a colour in #RRGGBB format.")
    return tuple(int(value[index:index + 2], 16) for index in (1, 3, 5))


def build_prompt(character_name: str, motion_direction: str, key_color: str) -> str:
    return (
        f"Locked-off camera and fixed square composition. {character_name} remains in exactly the same position "
        f"and scale. Keep every foot, paw, or base contact point planted and prevent positional drift. Create only "
        f"a slow living idle: {motion_direction}. Preserve the exact character design, silhouette, face, colours, "
        f"proportions, anatomy, accessories, markings, lighting, materials, and polished 3D illustration style. "
        f"The flat {key_color} chroma-key background remains perfectly uniform and motionless. No camera motion, "
        f"zoom, crop, walking, waving, speech, lip movement, new objects, background shadows, particles, scene "
        f"changes, morphing, or character redesign. Return smoothly to the exact starting pose."
    )


def resolve_prompt(args: argparse.Namespace, character_name: str) -> str:
    if args.prompt_file:
        prompt = resolve_project_path(args.prompt_file).read_text(encoding="utf-8").strip()
    elif args.prompt:
        prompt = args.prompt.strip()
    else:
        prompt = build_prompt(character_name, args.motion_direction.strip(), args.key_color.upper())
    if not prompt:
        raise RuntimeError("The generation prompt cannot be empty.")
    return prompt


def post_json(function_url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        function_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "x-katchimera-idle-token": token},
    )
    try:
        with urlopen(request, timeout=150) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Idle generation endpoint returned HTTP {error.code}: {detail}") from error
    if not isinstance(result, dict):
        raise RuntimeError("Idle generation endpoint returned an invalid response.")
    if result.get("error"):
        raise RuntimeError(str(result["error"]))
    return result


def request_id_from_submit(response: dict[str, Any]) -> str:
    queue = response.get("queue")
    if not isinstance(queue, dict) or not isinstance(queue.get("request_id"), str):
        raise RuntimeError(f"fal submission did not return a request_id: {response}")
    return queue["request_id"]


def wait_for_result(function_url: str, token: str, stage: str, request_id: str) -> dict[str, Any]:
    started = time.monotonic()
    last_status = ""
    while True:
        status = post_json(function_url, token, {"action": "status", "stage": stage, "requestId": request_id})
        state = str(status.get("status", "UNKNOWN"))
        if state != last_status:
            queue_position = status.get("queue_position")
            suffix = f" (queue position {queue_position})" if queue_position is not None else ""
            print(f"{stage}: {state}{suffix}", flush=True)
            last_status = state
        if state == "COMPLETED":
            return post_json(function_url, token, {"action": "result", "stage": stage, "requestId": request_id})
        if state in {"FAILED", "ERROR", "CANCELLED"}:
            raise RuntimeError(f"fal {stage} failed: {status}")
        if time.monotonic() - started > 20 * 60:
            raise TimeoutError(f"Timed out waiting for fal {stage} request {request_id}.")
        time.sleep(6)


def extract_video_url(payload: dict[str, Any]) -> str:
    candidates: list[Any] = [payload]
    if isinstance(payload.get("payload"), dict):
        candidates.append(payload["payload"])
    if isinstance(payload.get("data"), dict):
        candidates.append(payload["data"])
    for candidate in candidates:
        video = candidate.get("video") if isinstance(candidate, dict) else None
        if isinstance(video, dict) and isinstance(video.get("url"), str):
            return video["url"]
    raise RuntimeError(f"fal result did not contain a video URL: {payload}")


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=180) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def prepare_generation_input(source: Path, destination: Path, key_color: str, input_size: int) -> None:
    if not source.exists():
        raise RuntimeError(f"Source cutout does not exist: {source}")
    with Image.open(source) as original:
        creature = ImageOps.contain(original.convert("RGBA"), (input_size, input_size), Image.Resampling.LANCZOS)
    matte = Image.new("RGBA", (input_size, input_size), (*parse_hex_color(key_color), 255))
    offset = ((input_size - creature.width) // 2, (input_size - creature.height) // 2)
    matte.alpha_composite(creature, offset)
    destination.parent.mkdir(parents=True, exist_ok=True)
    matte.convert("RGB").save(destination, "PNG", optimize=True)


def find_ffmpeg() -> str:
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    try:
        import imageio_ffmpeg  # type: ignore[import-not-found]

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise RuntimeError(
            "ffmpeg is required. Install imageio-ffmpeg (`python -m pip install imageio-ffmpeg`) "
            "or put ffmpeg on PATH."
        ) from error


def extract_frames(video: Path, frames_dir: Path, fps: int, size: int) -> list[Path]:
    if not video.exists():
        raise RuntimeError(f"Transparent source video does not exist: {video}")
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)
    command = [
        find_ffmpeg(), "-y", "-c:v", "libvpx-vp9", "-i", str(video), "-an",
        "-vf", f"fps={fps},scale={size}:{size}:flags=lanczos,format=rgba",
        str(frames_dir / "%04d.png"),
    ]
    subprocess.run(command, check=True)
    frames = sorted(frames_dir.glob("*.png"))
    if len(frames) < fps * 2:
        raise RuntimeError(f"Expected at least {fps * 2} frames, found {len(frames)}.")
    return frames


def decontaminate_transparent_edges(frame_paths: list[Path]) -> None:
    """Extend clean foreground RGB into the alpha fringe without changing alpha."""
    try:
        import numpy as np
    except ImportError as error:
        raise RuntimeError(
            "--decontaminate-edges requires numpy (`python -m pip install numpy`)."
        ) from error

    neighbours = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))
    for frame_path in frame_paths:
        with Image.open(frame_path) as frame:
            pixels = np.array(frame.convert("RGBA"))
        rgb = pixels[..., :3].astype(np.float32)
        alpha = pixels[..., 3]
        height, width = alpha.shape
        magenta_spill = np.maximum(
            0,
            np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1] * 1.04,
        )
        foreground = alpha > 0
        known = foreground & (alpha >= 240) & (magenta_spill <= 8)

        for _ in range(32):
            sums = np.zeros_like(rgb)
            counts = np.zeros((height, width), dtype=np.float32)
            for delta_y, delta_x in neighbours:
                target_y = slice(max(0, delta_y), min(height, height + delta_y))
                target_x = slice(max(0, delta_x), min(width, width + delta_x))
                source_y = slice(max(0, -delta_y), min(height, height - delta_y))
                source_x = slice(max(0, -delta_x), min(width, width - delta_x))
                source_known = known[source_y, source_x]
                sums[target_y, target_x] += rgb[source_y, source_x] * source_known[..., None]
                counts[target_y, target_x] += source_known
            fill = foreground & ~known & (counts > 0)
            if not fill.any():
                break
            rgb[fill] = sums[fill] / counts[fill, None]
            known[fill] = True

        pixels[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
        Image.fromarray(pixels, "RGBA").save(frame_path)


def write_animated_webp(
    frame_paths: list[Path],
    destination: Path,
    fps: int,
    quality: int,
    alpha_quality: int,
) -> None:
    frames: list[Image.Image] = []
    try:
        for path in frame_paths:
            with Image.open(path) as frame:
                frames.append(frame.convert("RGBA").copy())
        frame_durations = [
            round((index + 1) * 1000 / fps) - round(index * 1000 / fps)
            for index in range(len(frames))
        ]
        destination.parent.mkdir(parents=True, exist_ok=True)
        frames[0].save(
            destination,
            "WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=frame_durations,
            loop=0,
            lossless=False,
            quality=quality,
            alpha_quality=alpha_quality,
            method=6,
            minimize_size=True,
            exact=True,
        )
    finally:
        for frame in frames:
            frame.close()


def verify_webp(path: Path, expected_size: int) -> tuple[int, tuple[int, int], int]:
    with Image.open(path) as animation:
        frame_count = getattr(animation, "n_frames", 1)
        dimensions = animation.size
        animation.seek(min(1, frame_count - 1))
        alpha_minimum = animation.convert("RGBA").getchannel("A").getextrema()[0]
    if frame_count < 24 or dimensions != (expected_size, expected_size) or alpha_minimum != 0:
        raise RuntimeError(
            f"WebP validation failed: frames={frame_count}, size={dimensions}, alpha minimum={alpha_minimum}."
        )
    return frame_count, dimensions, path.stat().st_size


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "animations": {}}
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("animations"), dict):
        raise RuntimeError(f"Invalid idle animation manifest: {path}")
    return manifest


def write_manifest(
    path: Path,
    visual_key: str,
    source: Path,
    output: Path,
    frame_count: int,
    fps: int,
    size: int,
    byte_size: int,
    max_byte_size: int,
    generation_id: str | None,
    matte_id: str | None,
    generation_prompt: str,
    duration: int,
    video_resolution: str,
    seed: int | None,
    edge_decontamination: bool,
) -> None:
    manifest = load_manifest(path)
    animations = manifest["animations"]
    previous = animations.get(visual_key, {})
    if not isinstance(previous, dict):
        previous = {}
    animation = {
        **previous,
        "asset": project_relative(output),
        "fallback": project_relative(source),
        "width": size,
        "height": size,
        "fps": fps,
        "frameCount": frame_count,
        "loopMode": "cycle",
        "byteSize": byte_size,
        "maxByteSize": max_byte_size,
        "generationModel": GENERATION_MODEL,
        "matteModel": MATTE_MODEL,
    }
    if generation_id:
        animation.update({
            "generationRequestId": generation_id,
            "matteRequestId": matte_id,
            "generationPrompt": generation_prompt,
            "durationSeconds": duration,
            "generationResolution": video_resolution,
        })
        if seed is None:
            animation.pop("generationSeed", None)
        else:
            animation["generationSeed"] = seed
    if edge_decontamination:
        animation["edgeDecontamination"] = "alpha-preserving-colour-extension"
    elif generation_id:
        animation.pop("edgeDecontamination", None)
    animations[visual_key] = animation
    manifest["version"] = 1
    manifest["animations"] = dict(sorted(animations.items()))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def write_runtime_registry(manifest_path: Path, registry_path: Path) -> None:
    animations = load_manifest(manifest_path)["animations"]
    entries: list[tuple[str, str, str]] = []
    for visual_key, spec in sorted(animations.items()):
        if not VISUAL_KEY_PATTERN.fullmatch(visual_key) or not isinstance(spec, dict):
            raise RuntimeError(f"Invalid visual key in idle animation manifest: {visual_key}")
        asset = spec.get("asset")
        if not isinstance(asset, str) or not asset.startswith("assets/") or not asset.endswith(".webp"):
            raise RuntimeError(f"Invalid runtime asset for {visual_key}: {asset}")
        fallback = spec.get("fallback")
        if (
            not isinstance(fallback, str)
            or not fallback.startswith("assets/")
            or Path(fallback).suffix.lower() not in {".png", ".webp", ".jpg", ".jpeg"}
        ):
            raise RuntimeError(f"Invalid runtime fallback for {visual_key}: {fallback}")
        entries.append((visual_key, asset, fallback))

    lines = [
        "// Generated by scripts/generate-katchimera-idle.py. Do not edit by hand.",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "import type { HomeVisualKey } from '@/types/home';",
        "",
        "const CREATURE_IDLE_ANIMATION_SOURCES: Partial<Record<HomeVisualKey, ImageSourcePropType>> = {",
    ]
    lines.extend(f"  '{visual_key}': require('../{asset}')," for visual_key, asset, _ in entries)
    lines.extend([
        "};",
        "",
        "const CREATURE_IDLE_FALLBACK_SOURCES: Partial<Record<HomeVisualKey, ImageSourcePropType>> = {",
    ])
    lines.extend(f"  '{visual_key}': require('../{fallback}')," for visual_key, _, fallback in entries)
    lines.extend([
        "};",
        "",
        "export function resolveCreatureIdleAnimationSource(",
        "  visualKey: HomeVisualKey,",
        "): ImageSourcePropType | null {",
        "  return CREATURE_IDLE_ANIMATION_SOURCES[visualKey] ?? null;",
        "}",
        "",
        "export function resolveCreatureIdleFallbackSource(",
        "  visualKey: HomeVisualKey,",
        "): ImageSourcePropType | null {",
        "  return CREATURE_IDLE_FALLBACK_SOURCES[visualKey] ?? null;",
        "}",
        "",
    ])
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text("\n".join(lines), encoding="utf-8")


def supabase_command() -> list[str]:
    executable = shutil.which("supabase") or shutil.which("supabase.exe")
    if executable:
        return [executable]
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if npx:
        return [npx, "--yes", "supabase"]
    raise RuntimeError("Supabase CLI is required to configure the remote admin token.")


def write_job(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--visual-key", default=DEFAULT_VISUAL_KEY)
    parser.add_argument("--character-name", help="Display name used in the generated default prompt.")
    parser.add_argument("--source", type=Path, help="Transparent source cutout. Defaults from --visual-key.")
    parser.add_argument("--output", type=Path, help="Promoted animated WebP. Defaults from --visual-key.")
    parser.add_argument("--work-dir", type=Path, help="Intermediate directory. Defaults from --visual-key.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--matted-video", type=Path, help="Package an existing transparent WebM without paid fal jobs.")
    parser.add_argument(
        "--generation-request-id",
        help="Resume matting and packaging from a completed fal generation request without generating again.",
    )
    parser.add_argument(
        "--matte-request-id",
        help="Resume packaging from an existing fal temporal-matting request without resubmitting it.",
    )
    parser.add_argument("--function-url")
    parser.add_argument("--token")
    parser.add_argument(
        "--configure-admin-token",
        action="store_true",
        help="Rotate the remote admin token through the linked Supabase CLI before generation.",
    )
    prompt_group = parser.add_mutually_exclusive_group()
    prompt_group.add_argument("--prompt", help="Complete prompt override.")
    prompt_group.add_argument("--prompt-file", type=Path, help="UTF-8 text file containing a complete prompt override.")
    parser.add_argument("--motion-direction", default=DEFAULT_MOTION_DIRECTION)
    parser.add_argument("--key-color", default="#D95BFF", type=str)
    parser.add_argument("--duration", type=int, choices=range(4, 13), default=4)
    parser.add_argument("--video-resolution", choices=("480p", "720p", "1080p"), default="720p")
    parser.add_argument("--seed", type=int, help="Optional deterministic fal seed; omit for a random seed.")
    parser.add_argument("--input-size", type=int, default=720)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--alpha-quality", type=int, default=95)
    parser.add_argument("--budget-mib", type=float, default=3.0)
    parser.add_argument(
        "--decontaminate-edges",
        action="store_true",
        help="Remove chroma RGB from transparent edge pixels without changing the alpha silhouette.",
    )
    parser.add_argument("--skip-registry", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Print resolved inputs and prompt without writing or submitting.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if not VISUAL_KEY_PATTERN.fullmatch(args.visual_key):
        parser.error("--visual-key must contain only lowercase letters, numbers, and hyphens.")
    if not HEX_COLOR_PATTERN.fullmatch(args.key_color):
        parser.error("--key-color must use #RRGGBB format.")
    if args.generation_request_id and not REQUEST_ID_PATTERN.fullmatch(args.generation_request_id):
        parser.error("--generation-request-id is invalid.")
    if args.matte_request_id and not REQUEST_ID_PATTERN.fullmatch(args.matte_request_id):
        parser.error("--matte-request-id is invalid.")
    resume_inputs = sum(bool(value) for value in (args.matted_video, args.generation_request_id, args.matte_request_id))
    if resume_inputs > 1:
        parser.error("--matted-video, --generation-request-id, and --matte-request-id are mutually exclusive.")
    for name in ("input_size", "fps", "size"):
        if getattr(args, name) <= 0:
            parser.error(f"--{name.replace('_', '-')} must be greater than zero.")
    for name in ("quality", "alpha_quality"):
        if not 0 <= getattr(args, name) <= 100:
            parser.error(f"--{name.replace('_', '-')} must be between 0 and 100.")
    if args.budget_mib <= 0:
        parser.error("--budget-mib must be greater than zero.")
    visual_key = args.visual_key
    character_name = args.character_name or visual_key.replace("-", " ").title()
    source = resolve_project_path(args.source or Path(f"assets/images/katchimeras/cutouts/{visual_key}.png"))
    output = resolve_project_path(args.output or Path(f"assets/images/katchimeras/animations/{visual_key}-idle.webp"))
    work_dir = resolve_project_path(args.work_dir or Path(f".tmp/katchimera-idle/{visual_key}"))
    manifest_path = resolve_project_path(args.manifest)
    registry_path = resolve_project_path(args.registry)
    prompt = resolve_prompt(args, character_name)
    max_byte_size = round(args.budget_mib * 1024 * 1024)

    resolved = {
        "visualKey": visual_key,
        "characterName": character_name,
        "source": display_path(source),
        "output": display_path(output),
        "workDir": display_path(work_dir),
        "prompt": prompt,
        "generation": {
            "model": GENERATION_MODEL,
            "duration": args.duration,
            "resolution": args.video_resolution,
            "seed": args.seed,
            "cameraFixed": True,
            "sameStartAndEndFrame": True,
            "generateAudio": False,
        },
        "packaging": {
            "fps": args.fps,
            "size": args.size,
            "quality": args.quality,
            "alphaQuality": args.alpha_quality,
            "budgetMiB": args.budget_mib,
            "edgeDecontamination": args.decontaminate_edges,
        },
    }
    if args.dry_run:
        if not source.exists():
            raise RuntimeError(f"Source cutout does not exist: {source}")
        print(json.dumps(resolved, indent=2))
        return 0

    work_dir.mkdir(parents=True, exist_ok=True)
    generation_id: str | None = None
    matte_id: str | None = None
    if args.matted_video:
        matted_video = resolve_project_path(args.matted_video)
    else:
        env = {**parse_env_file(ROOT / ".env.local"), **os.environ}
        function_url = args.function_url or env.get("EXPO_PUBLIC_SUPABASE_URL", "")
        if function_url and "/functions/v1/" not in function_url:
            function_url = function_url.rstrip("/") + "/functions/v1/generate-katchimera-idle"
        token = args.token or env.get("KATCHIMERA_IDLE_ADMIN_TOKEN", "")
        if args.configure_admin_token:
            token = secrets.token_hex(32)
            subprocess.run(
                [*supabase_command(), "secrets", "set", f"KATCHIMERA_IDLE_ADMIN_TOKEN={token}"],
                cwd=ROOT,
                check=True,
            )
        if not function_url or not token:
            parser.error("Provide --function-url/EXPO_PUBLIC_SUPABASE_URL and --token/KATCHIMERA_IDLE_ADMIN_TOKEN.")

        if args.matte_request_id:
            matte_id = args.matte_request_id
            existing_job = json.loads((work_dir / "job.json").read_text(encoding="utf-8"))
            existing_generation_id = existing_job.get("generationRequestId")
            if isinstance(existing_generation_id, str) and REQUEST_ID_PATTERN.fullmatch(existing_generation_id):
                generation_id = existing_generation_id
            job = {**resolved, "generationRequestId": generation_id, "matteRequestId": matte_id}
            print(f"Resuming {character_name} temporal matte {matte_id}...", flush=True)
        else:
            if args.generation_request_id:
                generation_id = args.generation_request_id
                print(f"Resuming completed {character_name} generation {generation_id}...", flush=True)
                job = {**resolved, "generationRequestId": generation_id}
            else:
                generation_input = work_dir / f"{visual_key}-generation-input.png"
                prepare_generation_input(source, generation_input, args.key_color, args.input_size)
                encoded = base64.b64encode(generation_input.read_bytes()).decode("ascii")
                generation_payload: dict[str, Any] = {
                    "action": "submit-generation",
                    "visualKey": visual_key,
                    "sourceImageDataUri": f"data:image/png;base64,{encoded}",
                    "prompt": prompt,
                    "duration": args.duration,
                    "resolution": args.video_resolution,
                }
                if args.seed is not None:
                    generation_payload["seed"] = args.seed

                print(f"Submitting one {character_name} Seedance idle candidate...", flush=True)
                generation_submit = post_json(function_url, token, generation_payload)
                generation_id = request_id_from_submit(generation_submit)
                job = {**resolved, "generationRequestId": generation_id}
                write_job(work_dir / "job.json", job)
            generation_result = wait_for_result(function_url, token, "generation", generation_id)
            raw_video_url = extract_video_url(generation_result)
            download(raw_video_url, work_dir / f"{visual_key}-generated.mp4")

            print("Submitting temporal background removal...", flush=True)
            matte_submit = post_json(function_url, token, {"action": "submit-matte", "videoUrl": raw_video_url})
            matte_id = request_id_from_submit(matte_submit)
            job["matteRequestId"] = matte_id
            write_job(work_dir / "job.json", job)
        matte_result = wait_for_result(function_url, token, "matte", matte_id)
        matted_video_url = extract_video_url(matte_result)
        matted_video = work_dir / f"{visual_key}-transparent.webm"
        download(matted_video_url, matted_video)

    frames = extract_frames(matted_video, work_dir / "frames", args.fps, args.size)
    if args.decontaminate_edges:
        decontaminate_transparent_edges(frames)
    write_animated_webp(frames, output, args.fps, args.quality, args.alpha_quality)
    frame_count, dimensions, byte_size = verify_webp(output, args.size)
    write_manifest(
        manifest_path,
        visual_key,
        source,
        output,
        frame_count,
        args.fps,
        args.size,
        byte_size,
        max_byte_size,
        generation_id,
        matte_id,
        prompt,
        args.duration,
        args.video_resolution,
        args.seed,
        args.decontaminate_edges,
    )
    if not args.skip_registry:
        write_runtime_registry(manifest_path, registry_path)
    print(
        f"Created {display_path(output)}: {frame_count} frames, "
        f"{dimensions[0]}x{dimensions[1]}, {byte_size / 1024:.0f} KiB.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, TimeoutError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
