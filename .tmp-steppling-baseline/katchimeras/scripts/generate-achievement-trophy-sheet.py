#!/usr/bin/env python3
"""Generate a trophy sprite sheet through fal-hosted GPT Image 2.

The local CLI calls the deployed ``generate-asset`` Supabase Edge Function, so
``FAL_KEY`` remains a server-side secret. Multiple local art references are
composed into one neutral style board and sent to fal's
``openai/gpt-image-2/edit`` endpoint. The finished image and a provenance JSON
sidecar are saved locally; chroma removal and cell processing remain separate
pipeline stages.

Example:
  python scripts/generate-achievement-trophy-sheet.py \
    --id tasklet-v1-sheet-a \
    --prompt-file design/achievement-trophies/tasklet-v1-sheet-a-prompt.txt \
    --reference assets/images/katchimeras/cutouts/tasklet.png \
    --reference assets/images/katchimeras/manual-journal/work.webp \
    --out tmp/imagegen/daily-rhythm-batch-v1/tasklet-v1-sheet-a-source.png
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
import mimetypes
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
EDGE_FUNCTION = "generate-asset"
FAL_MODEL = "openai/gpt-image-2/edit"
PIPELINE_VERSION = "achievement-trophy-fal-v1"


def load_env() -> tuple[str, str]:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        raise SystemExit(f"Missing {env_path}")
    env: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value
    url = env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing EXPO_PUBLIC_SUPABASE_URL / public key in .env.local")
    return url.rstrip("/"), key


def call_edge(payload: dict[str, object], timeout: int = 120) -> dict[str, object]:
    supabase_url, public_key = load_env()
    request = urllib.request.Request(
        f"{supabase_url}/functions/v1/{EDGE_FUNCTION}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {public_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{EDGE_FUNCTION} HTTP {error.code}: {body[:800]}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"{EDGE_FUNCTION} request failed: {error.reason}") from None
    if not isinstance(result, dict):
        raise RuntimeError(f"{EDGE_FUNCTION} returned a non-object response")
    if result.get("error"):
        raise RuntimeError(str(result["error"]))
    return result


def resolve_path(value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    path = path.resolve()
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def load_flattened(path: Path) -> Image.Image:
    with Image.open(path) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGBA")
    background = Image.new("RGBA", image.size, (244, 236, 220, 255))
    background.alpha_composite(image)
    return background.convert("RGB")


def build_style_board(reference_paths: list[Path], output_path: Path, size: int = 1536) -> bytes:
    if not reference_paths:
        raise ValueError("Provide at least one --reference")
    columns = 2 if len(reference_paths) > 1 else 1
    rows = math.ceil(len(reference_paths) / columns)
    board = Image.new("RGB", (size, size), (234, 221, 197))
    gutter = max(24, size // 64)
    cell_width = (size - gutter * (columns + 1)) // columns
    cell_height = (size - gutter * (rows + 1)) // rows
    for index, path in enumerate(reference_paths):
        row, column = divmod(index, columns)
        image = load_flattened(path)
        image.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
        x = gutter + column * (cell_width + gutter) + (cell_width - image.width) // 2
        y = gutter + row * (cell_height + gutter) + (cell_height - image.height) // 2
        board.paste(image, (x, y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    board.save(output_path, "PNG", optimize=True)
    buffer = io.BytesIO()
    board.save(buffer, "PNG", optimize=True)
    return buffer.getvalue()


def download(url: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "katchimeras-trophy-pipeline/1"})
    with urllib.request.urlopen(request, timeout=180) as response:
        output_path.write_bytes(response.read())


def generate(args: argparse.Namespace) -> None:
    prompt_path = resolve_path(args.prompt_file)
    prompt = prompt_path.read_text(encoding="utf-8").strip()
    if not prompt:
        raise ValueError(f"Prompt file is empty: {prompt_path}")
    references = [resolve_path(value) for value in args.reference]
    output_path = resolve_output(args.out)
    style_board_path = (
        resolve_output(args.style_board_out)
        if args.style_board_out
        else ROOT / "tmp" / "imagegen" / "fal-style-boards" / f"{args.id}.png"
    )
    board_bytes = build_style_board(references, style_board_path, args.style_board_size)
    prompt_with_reference_contract = (
        "The supplied image is a STYLE REFERENCE BOARD only. Use its palette, materials, "
        "rounded 3D rendering, lighting and object finish. Do not reproduce its collage "
        "layout, characters, scenery or existing objects. Create the new sprite sheet "
        "described below.\n\n" + prompt
    )
    payload: dict[str, object] = {
        "action": "generate",
        "prompt": prompt_with_reference_contract,
        "referenceBase64": base64.b64encode(board_bytes).decode("ascii"),
        "referenceMime": "image/png",
        "mode": "single",
        "model": "gpt",
        "gptImageSize": args.size,
        "gptQuality": args.quality,
        "outputName": args.id,
        "assetKey": f"achievement:{args.id}",
        "assetType": "other",
        "pipelineVersion": PIPELINE_VERSION,
    }
    print(f"submitting {args.id} via fal {FAL_MODEL} ({args.size}px, {args.quality})...", flush=True)
    started = time.monotonic()
    result = call_edge(payload)
    request_id = result.get("requestId")
    image_url = result.get("imageUrl") or result.get("gridUrl")
    last_status = ""
    while not image_url:
        if not isinstance(request_id, str) or not request_id:
            raise RuntimeError(f"fal submission did not return requestId or image URL: {result}")
        if time.monotonic() - started > args.timeout:
            raise TimeoutError(f"fal request {request_id} exceeded {args.timeout}s")
        time.sleep(args.poll_interval)
        result = call_edge({
            "action": "poll",
            "requestId": request_id,
            "rawResult": True,
            "model": "gpt",
            "mode": "single",
            "outputName": args.id,
        })
        status = str(result.get("queueStatus") or result.get("status") or "pending")
        if status != last_status:
            print(f"  fal queue: {status}", flush=True)
            last_status = status
        image_url = result.get("imageUrl") or result.get("gridUrl")
    if not isinstance(image_url, str):
        raise RuntimeError("fal result did not include an image URL")
    download(image_url, output_path)
    elapsed = round(time.monotonic() - started, 1)
    metadata = {
        "provider": "fal",
        "model": FAL_MODEL,
        "requestId": request_id,
        "sourceUrl": image_url,
        "promptFile": str(prompt_path.relative_to(ROOT)),
        "promptSha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "references": [str(path.relative_to(ROOT)) for path in references],
        "styleBoard": str(style_board_path.relative_to(ROOT)),
        "output": str(output_path.relative_to(ROOT)),
        "size": args.size,
        "quality": args.quality,
        "elapsedSeconds": elapsed,
        "pipelineVersion": PIPELINE_VERSION,
    }
    metadata_path = output_path.with_suffix(output_path.suffix + ".generation.json")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"saved {output_path.relative_to(ROOT)}", flush=True)
    print(f"saved {metadata_path.relative_to(ROOT)}", flush=True)


def resolve_output(value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    return path.resolve()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Katchimera trophy sheet through fal GPT Image 2")
    parser.add_argument("--id", required=True, help="lowercase dash-separated generation id")
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--reference", action="append", required=True, help="repeat for each local style reference")
    parser.add_argument("--out", required=True)
    parser.add_argument("--style-board-out")
    parser.add_argument("--style-board-size", type=int, default=1024)
    parser.add_argument("--size", type=int, default=1536)
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--timeout", type=int, default=1200)
    args = parser.parse_args()
    if not args.id or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in args.id):
        parser.error("--id must contain only lowercase letters, numbers and dashes")
    if args.size < 1024 or args.size > 3840 or args.size % 16:
        parser.error("--size must be a multiple of 16 between 1024 and 3840")
    try:
        generate(args)
    except (FileNotFoundError, RuntimeError, TimeoutError, ValueError, urllib.error.URLError) as error:
        raise SystemExit(str(error)) from None


if __name__ == "__main__":
    main()
