#!/usr/bin/env python3
"""Generate a Katchimera's ordered 3x3 hatchling-to-final evolution grid.

The generator receives two identity references on every run:
  1. the fixed base hatchling (stage 1 / composition anchor)
  2. the existing Katchimera cutout (stage 9 / final-form anchor)

The cloud render is matted with the project's deployed BiRefNet General Use
(Heavy) function. The script then slices the sheet, replaces stage 1 with the
exact source hatchling, and exports transparent cells plus a deterministic
review grid and JSON manifest.

Examples:
  python scripts/generate-evolution-grid.py --creature pagelet
  python scripts/generate-evolution-grid.py \
    --creature location_bookstore_pagelet --model seedream --force
  python scripts/generate-evolution-grid.py --name custom-creature \
    --final path/to/final.png --description "a moonlit cloud creature"
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HATCHLING = ROOT / "assets/images/katchimeras/hatchlings/base-hatchling.png"
DEFAULT_OUTPUT_ROOT = ROOT / "assets/images/katchimeras/evolution-grids"
CATALOG_PATH = ROOT / "data/katchimeras/encounter-katchimeras.json"
GRID_SIDE = 3
STAGE_COUNT = GRID_SIDE * GRID_SIDE

STAGES = [
    "Fixed hatchling: the exact neutral newborn in its cracked egg shell",
    "First signs: fully inside the shell, with only the earliest target colour and one tiny motif cue",
    "Awakening: half-emerged from the broken shell, with small buds of the final silhouette features",
    "Infant: out of the shell, about 45% of mature body development, very short limbs and tiny motifs",
    "Young form: about 58% mature, round child proportions and a clearly readable but small signature motif",
    "Juvenile: about 70% mature, longer limbs, growing silhouette features, and a stronger target palette",
    "Growing form: about 82% mature, most final traits present but visibly softer and smaller than the adult",
    "Near-final form: about 93% mature, almost adult proportions with one last restrained layer of detail",
    "Final form: faithful to the supplied existing Katchimera reference",
]


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "katchimera"


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        sys.exit(f"Missing {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            env[key] = value
    url = env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing EXPO_PUBLIC_SUPABASE_URL / Supabase publishable key in .env.local")
    return url.rstrip("/"), key


def call_function(name: str, payload: dict[str, Any], timeout: int = 235) -> dict[str, Any]:
    url, key = load_env()
    request = urllib.request.Request(
        f"{url}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"{name} HTTP {error.code}: {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"{name} request failed: {error}") from error
    if isinstance(data, dict) and isinstance(data.get("error"), str):
        raise RuntimeError(f"{name}: {data['error']}")
    return data


def image_payload(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    mime = "image/webp" if suffix == ".webp" else "image/jpeg" if suffix in {".jpg", ".jpeg"} else "image/png"
    return base64.b64encode(path.read_bytes()).decode("ascii"), mime


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, destination)


def load_catalog_profile(query: str | None) -> dict[str, Any] | None:
    if not query:
        return None
    profiles = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    needle = slugify(query)
    exact: list[dict[str, Any]] = []
    suffix: list[dict[str, Any]] = []
    for profile in profiles:
        candidates = {
            slugify(str(profile.get("id", ""))),
            slugify(str(profile.get("name", ""))),
            slugify(str(profile.get("seedId", ""))),
        }
        if needle in candidates:
            exact.append(profile)
        elif any(candidate.endswith(f"-{needle}") for candidate in candidates):
            suffix.append(profile)
    matches = exact or suffix
    if not matches:
        sys.exit(f"No Katchimera catalog profile matched {query!r}")
    if len(matches) > 1:
        ids = ", ".join(str(item.get("id")) for item in matches[:8])
        sys.exit(f"Ambiguous Katchimera {query!r}; matches: {ids}")
    return matches[0]


def infer_final_path(name: str) -> Path | None:
    cutouts = ROOT / "assets/images/katchimeras/cutouts"
    for extension in (".png", ".webp", ".jpg", ".jpeg"):
        candidate = cutouts / f"{slugify(name)}{extension}"
        if candidate.exists():
            return candidate
    return None


def build_prompt(display_name: str, description: str) -> str:
    stage_lines = " ".join(f"Cell {index + 1}: {stage}." for index, stage in enumerate(STAGES))
    return (
        "Create one clean 3x3 character evolution contact sheet: exactly three rows and three columns, "
        "nine equal square cells in left-to-right, top-to-bottom chronological order, separated by thin "
        "even gutters. Show the SAME single Katchimera evolving gradually from the hatchling in reference "
        f"image 1 into {display_name}, the final character in reference image 2. Target identity: {description}. "
        "Reference image 1 is authoritative for the fixed hatchling pose, face, eyes, egg-shell format, "
        "materials, lighting and project art style. Reference image 2 is authoritative for the final species "
        "identity, palette, signature motif, materials and mature silhouette. Every intermediate must look like "
        "a plausible direct growth stage between those two exact identities, never a different creature. "
        f"{stage_lines} "
        "Keep one consistent straight-on or gentle three-quarter hero camera, centered framing, scale logic, "
        "warm studio lighting and premium rounded 3D Katchimeras toy-diorama rendering in every cell. Growth "
        "must be smooth: preserve the large expressive eyes and recognizable face while the body grows, the "
        "egg disappears, and the final motif becomes progressively clearer. Every adjacent stage must be visibly "
        "different in at least three ways: shell coverage, body proportions, silhouette-feature size, motif size, "
        "material richness, or pose confidence. Do not repeat the same mature body from cells 4 through 9 and do "
        "not reach the complete adult silhouette before cell 9. Use a single simple matte dark-plum "
        "studio background in every cell so the characters can be cleanly matted. No scenery, platforms, props "
        "unrelated to the final identity, extra creatures, duplicated body parts, text, letters, numbers, labels, "
        "arrows, captions, logos, badges, UI, humans, photorealism or aggressive monster features."
    )


def submit_generation(
    *,
    name: str,
    prompt: str,
    hatchling: Path,
    final: Path,
    model: str,
    size: int,
    quality: str,
) -> tuple[str, dict[str, Any]]:
    hatchling_base64, hatchling_mime = image_payload(hatchling)
    final_base64, final_mime = image_payload(final)
    output_name = f"{slugify(name)}-evolution-grid"
    body: dict[str, Any] = {
        "prompt": prompt,
        "referenceBase64": hatchling_base64,
        "referenceMime": hatchling_mime,
        "guideBase64": final_base64,
        "guideMime": final_mime,
        "mode": "single",
        "model": model,
        "outputName": output_name,
    }
    if model == "gpt":
        body.update({"gptImageSize": size, "gptQuality": quality})
    elif model == "nano":
        body["resolution"] = "2K"

    data = call_function("generate-asset", body)
    if data.get("status") == "queued":
        request_id = data.get("requestId")
        if not isinstance(request_id, str):
            raise RuntimeError("generate-asset queued without a requestId")
        print(f"queued {request_id}; polling", flush=True)
        for attempt in range(75):
            time.sleep(8)
            data = call_function(
                "generate-asset",
                {
                    "action": "poll",
                    "requestId": request_id,
                    "model": model,
                    "mode": "single",
                    "outputName": output_name,
                    "rawResult": True,
                },
            )
            status = data.get("status")
            print(f"poll {attempt + 1}: {status}", flush=True)
            if status == "completed":
                break
        else:
            raise RuntimeError("Evolution grid generation timed out while polling")

    image_url = data.get("imageUrl") or data.get("gridUrl")
    if not isinstance(image_url, str):
        raise RuntimeError(f"Generation returned no image URL: {data}")
    return image_url, data


def matte_grid(raw_path: Path, name: str, destination: Path) -> str:
    data = call_function(
        "remove-image-background",
        {
            "imageBase64": base64.b64encode(raw_path.read_bytes()).decode("ascii"),
            "outputName": f"{slugify(name)}-evolution-grid",
        },
    )
    image_url = data.get("imageUrl")
    if not isinstance(image_url, str):
        raise RuntimeError(f"Matting returned no image URL: {data}")
    download(image_url, destination)
    return image_url


def contain_rgba(source: Image.Image, size: tuple[int, int], padding_ratio: float = 0.07) -> Image.Image:
    source = source.convert("RGBA")
    alpha_bbox = source.getchannel("A").getbbox()
    if alpha_bbox is None:
        raise ValueError("Reference hatchling has no visible pixels")
    cropped = source.crop(alpha_bbox)
    max_w = max(1, round(size[0] * (1 - padding_ratio * 2)))
    max_h = max(1, round(size[1] * (1 - padding_ratio * 2)))
    scale = min(max_w / cropped.width, max_h / cropped.height)
    resized = cropped.resize((max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - resized.width) // 2
    y = size[1] - resized.height - round(size[1] * padding_ratio)
    canvas.alpha_composite(resized, (x, y))
    return canvas


def process_grid(matted_path: Path, hatchling_path: Path, output_dir: Path, name: str) -> tuple[Path, list[Path]]:
    grid = Image.open(matted_path).convert("RGBA")
    side = min(grid.size)
    side -= side % GRID_SIDE
    left = (grid.width - side) // 2
    top = (grid.height - side) // 2
    grid = grid.crop((left, top, left + side, top + side))
    cell_size = side // GRID_SIDE

    cells_dir = output_dir / "cells"
    cells_dir.mkdir(parents=True, exist_ok=True)
    cells: list[Path] = []
    for index in range(STAGE_COUNT):
        row, column = divmod(index, GRID_SIDE)
        cell = grid.crop(
            (
                column * cell_size,
                row * cell_size,
                (column + 1) * cell_size,
                (row + 1) * cell_size,
            )
        )
        if index == 0:
            cell = contain_rgba(Image.open(hatchling_path), (cell_size, cell_size))
        destination = cells_dir / f"stage-{index + 1:02d}.png"
        cell.save(destination, optimize=True)
        cells.append(destination)

    gutter = max(8, cell_size // 32)
    preview_cell = cell_size
    preview_side = preview_cell * GRID_SIDE + gutter * (GRID_SIDE + 1)
    background = Image.new("RGBA", (preview_side, preview_side), (24, 18, 39, 255))
    draw = ImageDraw.Draw(background)
    for index, cell_path in enumerate(cells):
        row, column = divmod(index, GRID_SIDE)
        x = gutter + column * (preview_cell + gutter)
        y = gutter + row * (preview_cell + gutter)
        radius = max(12, cell_size // 28)
        draw.rounded_rectangle(
            (x, y, x + preview_cell - 1, y + preview_cell - 1),
            radius=radius,
            fill=(44, 35, 61, 255),
            outline=(91, 70, 112, 255),
            width=max(2, cell_size // 180),
        )
        background.alpha_composite(Image.open(cell_path).convert("RGBA"), (x, y))

    preview_path = output_dir / f"{slugify(name)}-evolution-grid.png"
    background.convert("RGB").save(preview_path, quality=95)
    return preview_path, cells


def relative_to_root(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a 3x3 Katchimera evolution grid")
    parser.add_argument("--creature", help="catalog profile id, name, or suffix (for example pagelet)")
    parser.add_argument("--name", help="output/display name; inferred from --creature when omitted")
    parser.add_argument("--description", help="target final-form description; inferred from catalog when omitted")
    parser.add_argument("--hatchling", default=str(DEFAULT_HATCHLING), help="fixed hatchling reference image")
    parser.add_argument("--final", help="existing final-form image; inferred from the creature name when omitted")
    parser.add_argument("--model", choices=("gpt", "seedream", "nano"), default="gpt")
    parser.add_argument("--size", type=int, default=1536, help="GPT square render size (divisible by 3 recommended)")
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    parser.add_argument("--out-dir", help="output directory; defaults under assets/images/katchimeras/evolution-grids")
    parser.add_argument("--dry-run", action="store_true", help="write prompt/manifest without network generation")
    parser.add_argument("--force", action="store_true", help="replace an existing output directory")
    args = parser.parse_args()

    if not args.creature and not args.name:
        parser.error("provide --creature or --name")

    profile = load_catalog_profile(args.creature)
    display_name = args.name or str(profile.get("name") if profile else args.creature)
    output_name = slugify(display_name)
    description = args.description or (
        str(profile.get("visualDescription") or profile.get("imagePrompt")) if profile else ""
    )
    if not description:
        parser.error("provide --description when the creature is not in the catalog")

    hatchling_path = Path(args.hatchling)
    if not hatchling_path.is_absolute():
        hatchling_path = ROOT / hatchling_path
    final_path = Path(args.final) if args.final else infer_final_path(output_name)
    if final_path and not final_path.is_absolute():
        final_path = ROOT / final_path
    if not hatchling_path.exists():
        sys.exit(f"Missing hatchling reference: {hatchling_path}")
    if final_path is None or not final_path.exists():
        sys.exit("Could not infer the final-form image; provide --final <path>")

    output_dir = Path(args.out_dir) if args.out_dir else DEFAULT_OUTPUT_ROOT / output_name
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    if output_dir.exists() and any(output_dir.iterdir()) and not args.force:
        sys.exit(f"Output directory already contains files: {output_dir} (use --force)")
    output_dir.mkdir(parents=True, exist_ok=True)

    prompt = build_prompt(display_name, description)
    prompt_path = output_dir / "prompt.txt"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "type": "katchimera-evolution-grid",
        "name": display_name,
        "profileId": profile.get("id") if profile else None,
        "model": args.model,
        "quality": args.quality if args.model == "gpt" else None,
        "hatchlingReference": relative_to_root(hatchling_path),
        "finalReference": relative_to_root(final_path),
        "prompt": prompt,
        "stages": [{"index": index + 1, "description": stage} for index, stage in enumerate(STAGES)],
    }
    manifest_path = output_dir / "manifest.json"

    if args.dry_run:
        manifest["status"] = "dry-run"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"wrote dry-run prompt and manifest to {output_dir}")
        return

    raw_path = output_dir / "raw-grid.png"
    matted_path = output_dir / "matted-grid.png"
    image_url, generation = submit_generation(
        name=display_name,
        prompt=prompt,
        hatchling=hatchling_path,
        final=final_path,
        model=args.model,
        size=args.size,
        quality=args.quality,
    )
    download(image_url, raw_path)
    print(f"saved raw grid: {raw_path}", flush=True)
    matte_url = matte_grid(raw_path, display_name, matted_path)
    print(f"saved Heavy-matted grid: {matted_path}", flush=True)
    preview_path, cells = process_grid(matted_path, hatchling_path, output_dir, display_name)

    manifest.update(
        {
            "status": "completed",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generationUrl": image_url,
            "matteUrl": matte_url,
            "generationResponse": generation,
            "rawGrid": relative_to_root(raw_path),
            "mattedGrid": relative_to_root(matted_path),
            "reviewGrid": relative_to_root(preview_path),
            "cells": [relative_to_root(path) for path in cells],
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"saved review grid: {preview_path}")
    print(f"saved manifest: {manifest_path}")


if __name__ == "__main__":
    main()
