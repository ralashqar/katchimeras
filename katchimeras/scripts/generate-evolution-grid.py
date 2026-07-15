#!/usr/bin/env python3
"""Generate a Katchimera's ordered 3x3 hatchling-to-final evolution grid.

The default guided-sheet strategy sends only the fixed base hatchling as the
generation image reference. A precise adult description and explicit monotonic
cell specifications guide the evolution without letting an adult image dominate
early cells. After Heavy matting, the script deterministically inserts the exact
hatchling and canonical adult cutouts at the progression's configured anchor
cells (1 and 9 for standard, 1 and 8 for epic).

An experimental staged strategy can render intermediate cells independently;
the legacy sheet strategy supplies both endpoint images to one grid generation.

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
import concurrent.futures
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
DEFAULT_HATCHLING = ROOT / "assets/images/katchimeras/hatchlings/base-hatchling-v2.png"
DEFAULT_OUTPUT_ROOT = ROOT / "assets/images/katchimeras/evolution-grids"
CATALOG_PATH = ROOT / "data/katchimeras/encounter-katchimeras.json"
GRID_SIDE = 3
STAGE_COUNT = GRID_SIDE * GRID_SIDE

STAGE_SPECS = [
    {
        "title": "Fixed hatchling",
        "shell": "the exact reference hatchling: open lower half-shell plus the shallow broken cap already on its head",
        "anatomy": "neutral newborn anatomy; no target-specific anatomy yet",
        "development": "0% of the adult identity",
    },
    {
        "title": "First traits",
        "shell": "the same open lower half-shell and cap, but both are cracked slightly farther apart; never a closed or enclosing egg",
        "anatomy": "the first subtle target colour and one tiny target-specific surface cue; otherwise the same hatchling silhouette",
        "development": "12% of the adult identity",
    },
    {
        "title": "Emerging",
        "shell": "top cap lifted away and disappearing; lower shell reduced to a shallow waist-high cup",
        "anatomy": "tiny buds of the adult's signature silhouette features and a faint version of its material treatment",
        "development": "25% of the adult identity",
    },
    {
        "title": "Shell-free infant",
        "shell": "no enclosing shell and no cap; at most two small broken shell fragments beside the feet",
        "anatomy": "a complete tiny body with very short limbs, oversized hatchling head and eyes, and miniature adult features",
        "development": "40% of the adult identity",
    },
    {
        "title": "Young form",
        "shell": "no egg or shell anywhere",
        "anatomy": "round child proportions; signature silhouette features at half adult size; small readable motif",
        "development": "55% of the adult identity",
    },
    {
        "title": "Juvenile",
        "shell": "no egg or shell anywhere",
        "anatomy": "slightly longer limbs, stronger adult palette and materials, signature features at two-thirds size",
        "development": "68% of the adult identity",
    },
    {
        "title": "Growing form",
        "shell": "no egg or shell anywhere",
        "anatomy": "most adult traits present, but a smaller head-dominant body and visibly simpler motif/detail",
        "development": "80% of the adult identity",
    },
    {
        "title": "Near-final form",
        "shell": "no egg or shell anywhere",
        "anatomy": "almost adult proportions and silhouette, with slightly softer shapes and one fewer layer of material detail",
        "development": "92% of the adult identity",
    },
    {
        "title": "Final form",
        "shell": "no egg or shell unless it is intrinsically part of the supplied adult character",
        "anatomy": "the exact supplied existing adult Katchimera",
        "development": "100% of the adult identity",
    },
]
STAGES = [
    f"{spec['title']}: {spec['development']}; {spec['shell']}; {spec['anatomy']}"
    for spec in STAGE_SPECS
]

EPIC_STAGE_SPECS = [
    {
        "title": "Fixed egg-shell hatchling",
        "description": "the exact supplied Pagelet hatchling gripping its decorated lower shell with the cracked cap on its head",
    },
    {
        "title": "Newborn baby",
        "description": "fully out of the egg with no shell anywhere; tiny complete body, very short limbs, short soft trunk, tiny page ears, tiny bookmark tail and faint crest",
    },
    {
        "title": "Toddler",
        "description": "small unsteady child body, oversized head and eyes, page ears beginning to layer, short trunk, small tail and softly glowing book crest",
    },
    {
        "title": "Young child",
        "description": "round playful child proportions, clearer linen texture, larger layered page ears, longer bookmark tail and brighter belly crest",
    },
    {
        "title": "Older child",
        "description": "slightly taller body and more confident stance, recognizable adult palette, half-grown page ears, tail and book crest",
    },
    {
        "title": "Adolescent",
        "description": "longer limbs and stronger silhouette, two-thirds adult page-ear layering, richer burgundy-and-gold markings and controlled inner glow",
    },
    {
        "title": "Young adult",
        "description": "nearly mature Pagelet with softer proportions than the adult, almost full ears and tail, refined linen surface and strong belly crest",
    },
    {
        "title": "Canonical full-grown Pagelet",
        "description": "the exact supplied existing adult Pagelet form; this cell is replaced deterministically after generation",
    },
    {
        "title": "Overpowered epic Pagelet",
        "description": "a majestic ultimate Pagelet evolution with enormous gold-edged layered page ears, luminous linen body, radiant open-book core, sweeping burgundy bookmark tail and controlled orbiting page-light energy",
    },
]
EPIC_STAGES = [f"{spec['title']}: {spec['description']}" for spec in EPIC_STAGE_SPECS]


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


def call_function(
    name: str,
    payload: dict[str, Any],
    timeout: int = 235,
    transient_retries: int = 0,
) -> dict[str, Any]:
    url, key = load_env()
    request = urllib.request.Request(
        f"{url}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    data: dict[str, Any] | None = None
    for attempt in range(transient_retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")[:800]
            if error.code in {429, 502, 503, 504} and attempt < transient_retries:
                delay = min(12, 2 ** (attempt + 1))
                print(f"{name} transient HTTP {error.code}; retrying in {delay}s", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} HTTP {error.code}: {details}") from error
        except urllib.error.URLError as error:
            if attempt < transient_retries:
                delay = min(12, 2 ** (attempt + 1))
                print(f"{name} transient network error; retrying in {delay}s", flush=True)
                time.sleep(delay)
                continue
            raise RuntimeError(f"{name} request failed: {error}") from error
    if data is None:
        raise RuntimeError(f"{name} returned no data")
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


def build_prompt(display_name: str, description: str, adult_image_reference: bool = False) -> str:
    stage_lines = " ".join(f"Cell {index + 1}: {stage}." for index, stage in enumerate(STAGES))
    destination_reference = (
        "Reference image 2 is authoritative for the final species identity, palette, signature motif, materials "
        "and mature silhouette. "
        if adult_image_reference
        else "There is no adult image reference in this generation. The adult destination is defined only by "
        "the target identity text, and the complete supplied adult will be inserted into cell 9 afterward. "
    )


def build_epic_prompt(display_name: str, description: str) -> str:
    stage_lines = " ".join(
        f"Cell {index + 1}: {spec['title']} — {spec['description']}."
        for index, spec in enumerate(EPIC_STAGE_SPECS)
    )
    return (
        "Create one clean 3x3 character progression contact sheet: exactly three rows and three columns, nine "
        "equal square cells read left-to-right and top-to-bottom, with thin even gutters. Show the SAME single "
        f"{display_name} growing through nine chronological ages. Adult identity: {description}. "
        "REFERENCE IMAGE 1 is the authoritative Pagelet hatchling and is mandatory for the face, huge amber "
        "eyes, short soft trunk, linen material, layered page ears, burgundy bookmark tail, glowing book motifs, "
        "rounded Katchimeras art style, camera and lighting. Preserve this exact species identity in every cell. "
        "There is no adult image reference in the generation; the canonical adult will be inserted into cell 8 "
        "afterward. Cell 9 must be a newly generated epic evolution of that same identity. "
        f"{stage_lines} "
        "EGG RULE IS ABSOLUTE: the egg-shell hatchling appears in CELL 1 ONLY. Starting with cell 2, show a full "
        "free-standing body with absolutely no egg, shell, shell cap, shell bowl, shell fragments or egg motifs. "
        "Never reintroduce the egg in any later cell. From cell 2 onward, the top of the head is uncovered linen: "
        "no cap, helmet, crown, dome, segmented head covering, shell plates or eggshell-shaped headpiece. Only "
        "intrinsic page tufts, ears and the creature's natural markings may rise from the head. Growth must be "
        "strictly forward: each cell is visibly older, "
        "taller, more developed and more powerful than the previous one. Do not duplicate adjacent ages and do "
        "not change species. Preserve the short trunk, page ears, bookmark tail, linen body and open-book core as "
        "anatomical identity markers while their size, layering and glow increase gradually. "
        "Cell 9 is overpowered and epic but still unmistakably Pagelet: premium heroic silhouette, stronger gold "
        "page edging, layered luminous ears, brighter inner glow, radiant open-book core and graceful magical "
        "page-light orbit. No weapon, armor, aggression or unrelated elemental theme. "
        "Use the same centred straight-on or gentle three-quarter hero camera, consistent framing, warm studio "
        "lighting and premium rounded 3D Katchimeras toy-diorama finish in every cell. Use one uniform matte "
        "dark-plum studio background for clean matting. Interpret book identity as anatomy, surfaces and magical "
        "body markings—not literal carried objects. No clothing, scarves, bags, handheld books, tools, platforms, "
        "scenery, extra creatures, text, letters, numbers, labels, arrows, logos, UI, humans or photorealism."
    )
    return (
        "Create one clean 3x3 character evolution contact sheet: exactly three rows and three columns, "
        "nine equal square cells in left-to-right, top-to-bottom chronological order, separated by thin "
        "even gutters. Show the SAME single Katchimera evolving gradually from the hatchling in reference "
        f"image 1 into the adult form of {display_name}. Target identity: {description}. "
        "Reference image 1 is authoritative for the fixed hatchling pose, face, eyes, egg-shell format, "
        f"materials, lighting and project art style. {destination_reference}Every intermediate must look like "
        "a plausible direct growth stage between those two exact identities, never a different creature. "
        f"{stage_lines} "
        "Keep one consistent straight-on or gentle three-quarter hero camera, centered framing, scale logic, "
        "warm studio lighting and premium rounded 3D Katchimeras toy-diorama rendering in every cell. Growth "
        "must be smooth: preserve the large expressive eyes and recognizable face while the body grows, the "
        "egg disappears, and the final motif becomes progressively clearer. Every adjacent stage must be visibly "
        "different in at least three ways: shell coverage, body proportions, silhouette-feature size, motif size, "
        "material richness, or pose confidence. Do not repeat the same mature body from cells 4 through 9 and do "
        "not reach the complete adult silhouette before cell 9. SHELL ORDER IS ABSOLUTE: cell 2 must show the "
        "same amount of open shell as cell 1 or less, never more; cell 3 must have less shell than cell 2; cell 4 "
        "must have no enclosing shell; cells 5 through 9 must contain no egg or shell at all. Never return to an "
        "earlier egg state. Keep the exact same face and species identity across all nine cells. Use a single simple matte dark-plum "
        "studio background in every cell so the characters can be cleanly matted. No scenery, platforms, props "
        "unrelated to the final identity, extra creatures, duplicated body parts, text, letters, numbers, labels, "
        "arrows, captions, logos, badges, UI, humans, photorealism or aggressive monster features. Interpret the "
        "target theme as anatomy, surface material and body markings—not as costumes or carried objects. Do not "
        "add clothing, scarves, bags, tools, books, handheld props or accessories unless the adult description "
        "explicitly says that exact item is worn or carried."
    )


def build_stage_prompt(
    display_name: str,
    description: str,
    stage_index: int,
    adult_image_reference: bool = False,
) -> str:
    """Build one unambiguous single-stage prompt (stage_index is zero-based)."""
    if stage_index <= 0 or stage_index >= STAGE_COUNT - 1:
        raise ValueError("Only generated intermediate stages 2 through 8 need prompts")
    current = STAGE_SPECS[stage_index]
    previous = STAGE_SPECS[stage_index - 1]
    following = STAGE_SPECS[stage_index + 1]
    adult_reference_instruction = (
        "REFERENCE IMAGE 2 — ADULT DESTINATION: authoritative only for the target species identity, palette, "
        "signature anatomy, motif and final materials. Do not render the complete adult early. "
        if adult_image_reference
        else "There is NO adult image reference for this intermediate. The adult destination is defined only by "
        "the text description below, so do not jump to or reproduce a fully mature design. "
    )
    return (
        "Create one single isolated Katchimera character render, not a grid and not a contact sheet. "
        f"This is chronological evolution stage {stage_index + 1} of 9 for {display_name}. "
        f"Adult destination: {description}. "
        "REFERENCE IMAGE 1 — BASE HATCHLING: authoritative for project art style, face, large glossy eye "
        "design, head-dominant newborn silhouette, rounded toy-like materials, camera, lighting and initial "
        "egg construction. Keep this recognizable as the same individual. "
        f"{adult_reference_instruction}"
        f"RENDER ONLY STAGE {stage_index + 1}: {current['title']}. Development: {current['development']}. "
        f"Shell state: {current['shell']}. Anatomy: {current['anatomy']}. "
        f"It must be visibly more hatched and more adult-like than stage {stage_index}: {previous['shell']}; "
        f"but visibly less developed than stage {stage_index + 2}: {following['anatomy']}. "
        "STRICT ONE-WAY RULE: shell coverage may only decrease as the stage number rises. Never close the egg, "
        "never put the creature back inside a fuller shell, and never add a new enclosing shell. The upper cap "
        "from the base hatchling may only crack farther, lift away, or disappear. The lower half-shell may only "
        "become shallower, fragment, or disappear. "
        "STRICT DEVELOPMENT LIMIT: show only the amount of target identity assigned to this stage. A colour, "
        "texture or tiny motif cue is not permission to add the complete adult ears, wings, horns, tail, emblem, "
        "clothing or mature body. Early stages must retain the base hatchling's neutral anatomy. "
        "Composition: one complete character, centered, consistent gentle three-quarter hero camera, generous "
        "padding, no crop. Premium rounded 3D Katchimeras toy-diorama rendering, soft tactile materials, warm "
        "studio key light, simple perfectly uniform matte dark-plum background. "
        "No extra creature, alternate form, multiple poses, grid, text, letters, numbers, label, arrow, logo, UI, "
        "scenery, platform, human, photorealism, aggressive monster features or unrelated props."
    )


def submit_generation(
    *,
    name: str,
    prompt: str,
    hatchling: Path,
    final: Path | None,
    model: str,
    size: int,
    quality: str,
) -> tuple[str, dict[str, Any]]:
    hatchling_base64, hatchling_mime = image_payload(hatchling)
    output_name = f"{slugify(name)}-evolution-grid"
    body: dict[str, Any] = {
        "prompt": prompt,
        "referenceBase64": hatchling_base64,
        "referenceMime": hatchling_mime,
        "mode": "single",
        "model": model,
        "outputName": output_name,
    }
    if final is not None:
        final_base64, final_mime = image_payload(final)
        body.update({"guideBase64": final_base64, "guideMime": final_mime})
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
                transient_retries=4,
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


def generate_intermediate_stage(
    *,
    stage_index: int,
    display_name: str,
    description: str,
    hatchling: Path,
    final: Path,
    model: str,
    size: int,
    quality: str,
    output_dir: Path,
    adult_image_reference: bool,
) -> dict[str, Any]:
    """Generate and Heavy-matte one intermediate stage in isolation."""
    stage_number = stage_index + 1
    prompt = build_stage_prompt(display_name, description, stage_index, adult_image_reference)
    raw_path = output_dir / "raw-stages" / f"stage-{stage_number:02d}.png"
    matted_path = output_dir / "matted-stages" / f"stage-{stage_number:02d}.png"
    image_url, generation = submit_generation(
        name=f"{display_name}-stage-{stage_number:02d}",
        prompt=prompt,
        hatchling=hatchling,
        final=final if adult_image_reference else None,
        model=model,
        size=size,
        quality=quality,
    )
    download(image_url, raw_path)
    matte_url = matte_grid(raw_path, f"{display_name}-stage-{stage_number:02d}", matted_path)
    print(f"stage {stage_number}: generated and Heavy-matted", flush=True)
    return {
        "index": stage_number,
        "prompt": prompt,
        "generationUrl": image_url,
        "matteUrl": matte_url,
        "generationResponse": generation,
        "rawPath": raw_path,
        "mattedPath": matted_path,
    }


def generate_staged_assets(
    *,
    display_name: str,
    description: str,
    hatchling: Path,
    final: Path,
    model: str,
    size: int,
    quality: str,
    output_dir: Path,
    parallel: int,
    adult_image_reference: bool,
) -> list[dict[str, Any]]:
    """Generate stages 2–8 separately while anchoring every call to both endpoints."""
    stage_indices = list(range(1, STAGE_COUNT - 1))
    results: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(parallel, len(stage_indices)))) as executor:
        futures = {
            executor.submit(
                generate_intermediate_stage,
                stage_index=stage_index,
                display_name=display_name,
                description=description,
                hatchling=hatchling,
                final=final,
                model=model,
                size=size,
                quality=quality,
                output_dir=output_dir,
                adult_image_reference=adult_image_reference,
            ): stage_index
            for stage_index in stage_indices
        }
        for future in concurrent.futures.as_completed(futures):
            stage_index = futures[future]
            try:
                results.append(future.result())
            except Exception as error:
                raise RuntimeError(f"Stage {stage_index + 1} failed: {error}") from error
    return sorted(results, key=lambda item: int(item["index"]))


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


def process_grid(
    matted_path: Path,
    hatchling_path: Path,
    final_path: Path,
    output_dir: Path,
    name: str,
    progression: str = "standard",
    raw_path: Path | None = None,
) -> tuple[Path, list[Path]]:
    grid = Image.open(matted_path).convert("RGBA")
    side = min(grid.size)
    side -= side % GRID_SIDE
    left = (grid.width - side) // 2
    top = (grid.height - side) // 2
    grid = grid.crop((left, top, left + side, top + side))
    raw_grid = None
    if raw_path is not None:
        raw_grid = Image.open(raw_path).convert("RGBA")
        raw_side = min(raw_grid.size)
        raw_side -= raw_side % GRID_SIDE
        raw_left = (raw_grid.width - raw_side) // 2
        raw_top = (raw_grid.height - raw_side) // 2
        raw_grid = raw_grid.crop((raw_left, raw_top, raw_left + raw_side, raw_top + raw_side))
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
        elif progression == "epic" and index == STAGE_COUNT - 2:
            cell = contain_rgba(Image.open(final_path), (cell_size, cell_size))
        elif progression == "standard" and index == STAGE_COUNT - 1:
            cell = contain_rgba(Image.open(final_path), (cell_size, cell_size))
        elif cell.getchannel("A").getbbox() is None:
            if raw_grid is None:
                raise ValueError(f"Heavy matting removed all visible pixels from stage {index + 1}")
            raw_cell_size = raw_grid.width // GRID_SIDE
            raw_cell = raw_grid.crop(
                (
                    column * raw_cell_size,
                    row * raw_cell_size,
                    (column + 1) * raw_cell_size,
                    (row + 1) * raw_cell_size,
                )
            )
            raw_stages_dir = output_dir / "raw-stages"
            matted_stages_dir = output_dir / "matted-stages"
            raw_stages_dir.mkdir(parents=True, exist_ok=True)
            matted_stages_dir.mkdir(parents=True, exist_ok=True)
            raw_stage_path = raw_stages_dir / f"stage-{index + 1:02d}.png"
            matted_stage_path = matted_stages_dir / f"stage-{index + 1:02d}.png"
            raw_cell.save(raw_stage_path, optimize=True)
            matte_grid(raw_stage_path, f"{name}-stage-{index + 1:02d}", matted_stage_path)
            recovered = Image.open(matted_stage_path).convert("RGBA")
            if recovered.getchannel("A").getbbox() is None:
                raise ValueError(f"Per-cell Heavy matting removed all visible pixels from stage {index + 1}")
            cell = contain_rgba(recovered, (cell_size, cell_size), padding_ratio=0.0)
            print(f"recovered stage {index + 1} with per-cell Heavy matting", flush=True)
        destination = cells_dir / f"stage-{index + 1:02d}.png"
        cell.save(destination, optimize=True)
        cells.append(destination)

    preview_path = write_review_grid(cells, output_dir, name, cell_size)
    return preview_path, cells


def write_review_grid(cells: list[Path], output_dir: Path, name: str, preview_cell: int = 512) -> Path:
    gutter = max(8, preview_cell // 32)
    preview_side = preview_cell * GRID_SIDE + gutter * (GRID_SIDE + 1)
    background = Image.new("RGBA", (preview_side, preview_side), (24, 18, 39, 255))
    draw = ImageDraw.Draw(background)
    for index, cell_path in enumerate(cells):
        row, column = divmod(index, GRID_SIDE)
        x = gutter + column * (preview_cell + gutter)
        y = gutter + row * (preview_cell + gutter)
        radius = max(12, preview_cell // 28)
        draw.rounded_rectangle(
            (x, y, x + preview_cell - 1, y + preview_cell - 1),
            radius=radius,
            fill=(44, 35, 61, 255),
            outline=(91, 70, 112, 255),
            width=max(2, preview_cell // 180),
        )
        cell = Image.open(cell_path).convert("RGBA")
        if cell.size != (preview_cell, preview_cell):
            cell = contain_rgba(cell, (preview_cell, preview_cell))
        background.alpha_composite(cell, (x, y))

    preview_path = output_dir / f"{slugify(name)}-evolution-grid.png"
    background.convert("RGB").save(preview_path, quality=95)
    return preview_path


def process_staged_assets(
    stages: list[dict[str, Any]],
    hatchling_path: Path,
    final_path: Path,
    output_dir: Path,
    name: str,
) -> tuple[Path, list[Path]]:
    """Assemble exact endpoints and independently generated intermediate stages."""
    generated = {int(stage["index"]): Path(stage["mattedPath"]) for stage in stages}
    sources = [hatchling_path]
    sources.extend(generated[index] for index in range(2, STAGE_COUNT))
    sources.append(final_path)
    if len(sources) != STAGE_COUNT:
        raise RuntimeError(f"Expected {STAGE_COUNT} staged sources, got {len(sources)}")

    cells_dir = output_dir / "cells"
    cells_dir.mkdir(parents=True, exist_ok=True)
    cells: list[Path] = []
    for index, source_path in enumerate(sources, 1):
        cell = contain_rgba(Image.open(source_path), (512, 512))
        destination = cells_dir / f"stage-{index:02d}.png"
        cell.save(destination, optimize=True)
        cells.append(destination)
    return write_review_grid(cells, output_dir, name), cells


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
    parser.add_argument("--strategy", choices=("guided-sheet", "staged", "sheet"), default="guided-sheet")
    parser.add_argument(
        "--progression",
        choices=("standard", "epic"),
        default="standard",
        help="standard ends at canonical adult; epic uses adult in cell 8 and an ultimate form in cell 9",
    )
    parser.add_argument(
        "--adult-reference-mode",
        choices=("description", "image"),
        default="description",
        help="intermediate-stage adult guidance; description avoids premature jumps",
    )
    parser.add_argument("--size", type=int, default=1024, help="GPT square render size")
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    parser.add_argument("--parallel", type=int, default=3, help="maximum simultaneous intermediate-stage jobs")
    parser.add_argument("--out-dir", help="output directory; defaults under assets/images/katchimeras/evolution-grids")
    parser.add_argument("--dry-run", action="store_true", help="write prompt/manifest without network generation")
    parser.add_argument("--force", action="store_true", help="replace an existing output directory")
    args = parser.parse_args()

    if args.progression == "epic" and args.strategy != "guided-sheet":
        parser.error("--progression epic currently requires --strategy guided-sheet")

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

    effective_adult_reference_mode = (
        "image" if args.strategy == "sheet" else "description" if args.strategy == "guided-sheet" else args.adult_reference_mode
    )
    stage_prompts = {
        index + 1: build_stage_prompt(
            display_name,
            description,
            index,
            adult_image_reference=effective_adult_reference_mode == "image",
        )
        for index in range(1, STAGE_COUNT - 1)
    }
    if args.progression == "epic":
        prompt = build_epic_prompt(display_name, description)
    elif args.strategy == "sheet":
        prompt = build_prompt(display_name, description, adult_image_reference=True)
    elif args.strategy == "guided-sheet":
        prompt = build_prompt(display_name, description, adult_image_reference=False)
    else:
        prompt = "\n\n".join(f"=== STAGE {index} ===\n{value}" for index, value in stage_prompts.items())
    prompt_path = output_dir / "prompt.txt"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    manifest: dict[str, Any] = {
        "schemaVersion": 2,
        "type": "katchimera-evolution-grid",
        "name": display_name,
        "profileId": profile.get("id") if profile else None,
        "strategy": args.strategy,
        "progression": args.progression,
        "adultReferenceMode": effective_adult_reference_mode,
        "model": args.model,
        "quality": args.quality if args.model == "gpt" else None,
        "hatchlingReference": relative_to_root(hatchling_path),
        "finalReference": relative_to_root(final_path),
        "prompt": prompt,
        "stages": [
            {
                "index": index + 1,
                "description": stage,
                "prompt": None if args.progression == "epic" else stage_prompts.get(index + 1),
            }
            for index, stage in enumerate(EPIC_STAGES if args.progression == "epic" else STAGES)
        ],
    }
    manifest_path = output_dir / "manifest.json"

    if args.dry_run:
        manifest["status"] = "dry-run"
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"wrote dry-run prompt and manifest to {output_dir}")
        return

    if args.strategy == "staged":
        generated_stages = generate_staged_assets(
            display_name=display_name,
            description=description,
            hatchling=hatchling_path,
            final=final_path,
            model=args.model,
            size=args.size,
            quality=args.quality,
            output_dir=output_dir,
            parallel=args.parallel,
            adult_image_reference=effective_adult_reference_mode == "image",
        )
        preview_path, cells = process_staged_assets(
            generated_stages,
            hatchling_path,
            final_path,
            output_dir,
            display_name,
        )
        manifest["generatedStages"] = [
            {
                **{key: value for key, value in stage.items() if key not in {"rawPath", "mattedPath"}},
                "rawPath": relative_to_root(Path(stage["rawPath"])),
                "mattedPath": relative_to_root(Path(stage["mattedPath"])),
            }
            for stage in generated_stages
        ]
    else:
        raw_path = output_dir / "raw-grid.png"
        matted_path = output_dir / "matted-grid.png"
        image_url, generation = submit_generation(
            name=display_name,
            prompt=prompt,
            hatchling=hatchling_path,
            final=final_path if args.strategy == "sheet" else None,
            model=args.model,
            size=args.size,
            quality=args.quality,
        )
        download(image_url, raw_path)
        print(f"saved raw grid: {raw_path}", flush=True)
        matte_url = matte_grid(raw_path, display_name, matted_path)
        print(f"saved Heavy-matted grid: {matted_path}", flush=True)
        preview_path, cells = process_grid(
            matted_path,
            hatchling_path,
            final_path,
            output_dir,
            display_name,
            progression=args.progression,
            raw_path=raw_path,
        )
        manifest.update(
            {
                "generationUrl": image_url,
                "matteUrl": matte_url,
                "generationResponse": generation,
                "rawGrid": relative_to_root(raw_path),
                "mattedGrid": relative_to_root(matted_path),
            }
        )

    manifest.update(
        {
            "status": "completed",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "reviewGrid": relative_to_root(preview_path),
            "cells": [relative_to_root(path) for path in cells],
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"saved review grid: {preview_path}")
    print(f"saved manifest: {manifest_path}")


if __name__ == "__main__":
    main()
