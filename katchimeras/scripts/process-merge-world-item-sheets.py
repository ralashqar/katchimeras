#!/usr/bin/env python3
"""Split, normalize, optimize, and audit Merge World 4x4 item sheets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "scripts" / "merge-world-item-art-manifest.json"
DEFAULT_OUT = ROOT / "assets" / "images" / "katchimeras" / "merge-world" / "items"
ALPHA_THRESHOLD = 18


def grid_bounds(index: int, count: int, extent: int) -> tuple[int, int]:
    return round(index * extent / count), round((index + 1) * extent / count)


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()


def normalize_cell(cell: Image.Image, size: int, extent: int, label: str) -> Image.Image:
    bounds = visible_bounds(cell)
    if not bounds:
        raise ValueError(f"{label}: no visible pixels")
    left, top, right, bottom = bounds
    edge_guard = max(3, round(min(cell.size) * 0.01))
    if left <= edge_guard or top <= edge_guard or right >= cell.width - edge_guard or bottom >= cell.height - edge_guard:
        raise ValueError(f"{label}: subject touches a cell boundary: {bounds} in {cell.size}")

    # Include the antialiased fringe around the thresholded silhouette, then
    # place the geometric visible bounds at the exact center of a shared canvas.
    pad = 3
    crop_box = (max(0, left - pad), max(0, top - pad), min(cell.width, right + pad), min(cell.height, bottom + pad))
    subject = cell.crop(crop_box)
    subject_bounds = visible_bounds(subject)
    if not subject_bounds:
        raise ValueError(f"{label}: subject disappeared after cropping")
    visible_width = subject_bounds[2] - subject_bounds[0]
    visible_height = subject_bounds[3] - subject_bounds[1]
    scale = extent / max(visible_width, visible_height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    subject_bounds = visible_bounds(subject)
    assert subject_bounds is not None
    visible_center_x = (subject_bounds[0] + subject_bounds[2]) / 2
    visible_center_y = (subject_bounds[1] + subject_bounds[3]) / 2
    destination_x = round(size / 2 - visible_center_x)
    destination_y = round(size / 2 - visible_center_y)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(subject, (destination_x, destination_y))
    return output


def save_webp(image: Image.Image, output: Path, quality: int, hard_limit: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    for candidate_quality in (quality, quality - 4, quality - 8, quality - 12):
        image.save(output, "WEBP", quality=max(60, candidate_quality), method=6, exact=True)
        if output.stat().st_size <= hard_limit:
            return
    raise ValueError(f"{output}: exceeds the {hard_limit}-byte runtime budget")


def audit_file(path: Path, size: int, extent: int, hard_limit: int) -> dict[str, Any]:
    with Image.open(path) as opened:
        image = opened.convert("RGBA")
    if image.size != (size, size):
        raise ValueError(f"{path}: expected {size}x{size}, got {image.size}")
    if path.stat().st_size > hard_limit:
        raise ValueError(f"{path}: exceeds {hard_limit} bytes")
    corners = [image.getpixel(point)[3] for point in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1))]
    if max(corners) > 0:
        raise ValueError(f"{path}: non-transparent corner alpha {corners}")
    bounds = visible_bounds(image)
    if not bounds:
        raise ValueError(f"{path}: empty sprite")
    center_x = (bounds[0] + bounds[2]) / 2
    center_y = (bounds[1] + bounds[3]) / 2
    if abs(center_x - size / 2) > 1 or abs(center_y - size / 2) > 1:
        raise ValueError(f"{path}: visible bounds are off-center: {bounds}")
    longest = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    if abs(longest - extent) > 2:
        raise ValueError(f"{path}: visible extent {longest} does not match target {extent}")
    return {"file": path.name, "bytes": path.stat().st_size, "bounds": list(bounds)}


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def expected_cells(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [cell for sheet in manifest["sheets"] for cell in sheet["cells"]]


def process(manifest: dict[str, Any], sources: dict[str, Path], out_dir: Path) -> None:
    settings = manifest["output"]
    for sheet in manifest["sheets"]:
        sheet_id = sheet["id"]
        source_path = sources.get(sheet_id)
        if not source_path:
            raise ValueError(f"Missing source for {sheet_id}")
        with Image.open(source_path) as opened:
            source = opened.convert("RGBA")
        if source.width != source.height:
            raise ValueError(f"{source_path}: expected square 4x4 sheet, got {source.size}")
        if source.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"{source_path}: sheet has no transparent pixels; remove chroma first")
        for item in sheet["cells"]:
            left, right = grid_bounds(item["column"], 4, source.width)
            top, bottom = grid_bounds(item["row"], 4, source.height)
            cell = source.crop((left, top, right, bottom))
            normalized = normalize_cell(cell, settings["size"], settings["subjectExtent"], item["definitionId"])
            save_webp(normalized, out_dir / item["file"], settings["quality"], settings["hardFileLimitBytes"])


def audit(manifest: dict[str, Any], out_dir: Path) -> list[dict[str, Any]]:
    settings = manifest["output"]
    cells = expected_cells(manifest)
    if len(cells) != 30 or len({cell["definitionId"] for cell in cells}) != 30 or len({cell["file"] for cell in cells}) != 30:
        raise ValueError("Manifest must describe exactly 30 unique items and files")
    results = [audit_file(out_dir / cell["file"], settings["size"], settings["subjectExtent"], settings["hardFileLimitBytes"]) for cell in cells]
    print(f"Audited {len(results)} sprites: {sum(item['bytes'] for item in results) / 1024:.1f} KiB total")
    return results


def contact_sheet(manifest: dict[str, Any], out_dir: Path, destination: Path) -> None:
    cells = expected_cells(manifest)
    tile = 128
    columns = 6
    rows = (len(cells) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * tile, rows * tile), (237, 225, 193))
    draw = ImageDraw.Draw(canvas)
    for index, cell in enumerate(cells):
        sprite = Image.open(out_dir / cell["file"]).convert("RGBA")
        sprite.thumbnail((104, 104), Image.Resampling.LANCZOS)
        x = index % columns * tile + (tile - sprite.width) // 2
        y = index // columns * tile + 4
        canvas.paste(sprite, (x, y), sprite)
        draw.text((index % columns * tile + 4, index // columns * tile + 110), cell["definitionId"][:20], fill=(58, 43, 32))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--sheet-a", type=Path)
    parser.add_argument("--sheet-b", type=Path)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--audit-only", action="store_true")
    parser.add_argument("--contact-sheet", type=Path)
    args = parser.parse_args()
    manifest = load_manifest(args.manifest.resolve())
    out_dir = args.out_dir.resolve()
    if not args.audit_only:
        if not args.sheet_a or not args.sheet_b:
            parser.error("--sheet-a and --sheet-b are required unless --audit-only is used")
        process(manifest, {"sheet-a": args.sheet_a.resolve(), "sheet-b": args.sheet_b.resolve()}, out_dir)
    audit(manifest, out_dir)
    if args.contact_sheet:
        contact_sheet(manifest, out_dir, args.contact_sheet.resolve())


if __name__ == "__main__":
    main()
