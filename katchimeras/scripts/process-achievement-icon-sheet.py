#!/usr/bin/env python3
"""Split one or more manifest-described trophy sheets into runtime WebPs.

Inputs must already have alpha. Legacy manifests can describe a 4x4 sheet with
named rows. New manifests can describe any regular grid with an explicit list
of named cells, which lets a batch pack differently sized tier ladders tightly.
Individual cells may override their grid crop with measured pixel bounds when
the generator's transparent gutters shift between rows or columns.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def remove_stray_components(cell: Image.Image, drop_edge_fragments: bool = False) -> Image.Image:
    """Remove small disconnected fragments caused by a subject crossing a grid edge."""
    alpha = cell.getchannel("A")
    width, height = alpha.size
    source = alpha.load()
    seen = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int]]] = []
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if seen[offset] or source[x, y] <= 18:
                continue
            seen[offset] = 1
            stack = [(x, y)]
            area = 0
            min_x = max_x = x
            min_y = max_y = y
            while stack:
                px, py = stack.pop()
                area += 1
                min_x, max_x = min(min_x, px), max(max_x, px)
                min_y, max_y = min(min_y, py), max(max_y, py)
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    next_offset = ny * width + nx
                    if not seen[next_offset] and source[nx, ny] > 18:
                        seen[next_offset] = 1
                        stack.append((nx, ny))
            components.append((area, (min_x, min_y, max_x + 1, max_y + 1)))
    if not components:
        return cell
    largest = max(area for area, _bounds in components)
    edge_guard = max(2, round(min(width, height) * 0.015))
    keep = Image.new("L", cell.size, 0)
    draw = ImageDraw.Draw(keep)
    for area, (left, top, right, bottom) in components:
        touches_edge = (
            left <= edge_guard
            or top <= edge_guard
            or right >= width - edge_guard
            or bottom >= height - edge_guard
        )
        if drop_edge_fragments and area != largest and touches_edge:
            continue
        if area < max(64, largest * 0.05):
            continue
        draw.rectangle((max(0, left - 3), max(0, top - 3), min(width, right + 3), min(height, bottom + 3)), fill=255)
    cleaned = cell.copy()
    cleaned.putalpha(Image.composite(alpha, Image.new("L", cell.size, 0), keep))
    return cleaned


def fit_cell(
    cell: Image.Image,
    size: int,
    clean_components: bool = True,
    tight_fit: bool = False,
    subject_coverage: float = 0.78,
    drop_edge_fragments: bool = False,
) -> Image.Image:
    if clean_components:
        cell = remove_stray_components(cell, drop_edge_fragments)
    alpha = cell.getchannel("A")
    # Tight-fit packs ignore near-invisible chroma matte haze when finding the
    # subject. Legacy packs keep their original bounds and no-upscale behavior.
    bounds = alpha.point(lambda value: 255 if value > 18 else 0).getbbox() if tight_fit else alpha.getbbox()
    if not bounds:
        raise ValueError("cell contains no opaque pixels")
    subject = cell.crop(bounds)
    if tight_fit:
        if not 0.5 <= subject_coverage <= 0.9:
            raise ValueError(f"subjectCoverage must be between 0.5 and 0.9, got {subject_coverage}")
        available = round(size * subject_coverage)
        scale = min(available / subject.width, available / subject.height)
        subject = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
    else:
        padding = max(12, round(size * 0.08))
        available = size - padding * 2
        subject.thumbnail((available, available), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    return output


def grid_bounds(index: int, count: int, extent: int) -> tuple[int, int]:
    """Return proportional grid bounds without dropping remainder pixels."""
    return round(index * extent / count), round((index + 1) * extent / count)


def manifest_grid_bounds(
    index: int,
    count: int,
    extent: int,
    cuts: object,
    axis: str,
) -> tuple[int, int]:
    if cuts is None:
        return grid_bounds(index, count, extent)
    if not isinstance(cuts, list) or len(cuts) != count + 1:
        raise ValueError(f"{axis}Cuts must contain exactly {count + 1} values")
    values = [int(value) for value in cuts]
    if values[0] != 0 or values[-1] != extent or values != sorted(set(values)):
        raise ValueError(f"{axis}Cuts must start at 0, end at {extent}, and increase strictly")
    return values[index], values[index + 1]


def process_sheet(input_path: Path, out_dir: Path, sheet: dict[str, object], size: int, quality: int) -> list[Path]:
    image = Image.open(input_path).convert("RGBA")
    if image.getchannel("A").getextrema()[0] != 0:
        raise ValueError(f"{input_path}: input has no transparent pixels; remove the chroma key first")

    out_dir.mkdir(parents=True, exist_ok=True)
    produced: list[Path] = []
    clean_components = bool(sheet.get("cleanComponents", True))
    tight_fit = bool(sheet.get("tightFit", False))
    subject_coverage = float(sheet.get("subjectCoverage", 0.78))
    drop_edge_fragments = bool(sheet.get("dropEdgeFragments", False))
    strict_cell_bounds = bool(sheet.get("strictCellBounds", False))
    column_cuts: object = None
    row_cuts: object = None

    if "cells" in sheet:
        grid = sheet.get("grid")
        if not isinstance(grid, dict):
            raise ValueError(f"{input_path}: an explicit cell manifest requires a grid")
        columns = int(grid["columns"])
        rows_count = int(grid["rows"])
        column_cuts = grid.get("columnCuts")
        row_cuts = grid.get("rowCuts")
        cells = sheet["cells"]
        if not isinstance(cells, list):
            raise ValueError(f"{input_path}: cells must be a list")
        jobs = []
        for item in cells:
            if not isinstance(item, dict):
                raise ValueError(f"{input_path}: each cell must be an object")
            row = int(item["row"])
            column = int(item["column"])
            if not 0 <= row < rows_count or not 0 <= column < columns:
                raise ValueError(f"{input_path}: cell ({row}, {column}) is outside the grid")
            jobs.append((str(item["name"]), row, column, item.get("bounds")))
    else:
        rows = sheet.get("rows")
        if not isinstance(rows, list) or len(rows) != 4:
            raise ValueError(f"{input_path}: legacy sheets require exactly four manifest rows")
        if image.width != image.height:
            raise ValueError(f"{input_path}: legacy 4x4 sheets must be square, got {image.size}")
        columns = rows_count = 4
        jobs = []
        for row_index, row_item in enumerate(rows):
            if not isinstance(row_item, dict):
                raise ValueError(f"{input_path}: each row must be an object")
            section = str(row_item["section"])
            tiers = int(row_item.get("tiers", 4))
            if not 1 <= tiers <= 4:
                raise ValueError(f"{section}: tiers must be between one and four")
            jobs.extend((f"{section}-{column + 1}", row_index, column, None) for column in range(tiers))

    seen_names: set[str] = set()
    seen_cells: set[tuple[int, int]] = set()
    for name, row, column, explicit_bounds in jobs:
        if name in seen_names:
            raise ValueError(f"{input_path}: duplicate output name {name}")
        if (row, column) in seen_cells:
            raise ValueError(f"{input_path}: grid cell ({row}, {column}) is assigned twice")
        seen_names.add(name)
        seen_cells.add((row, column))
        if explicit_bounds is not None:
            if not isinstance(explicit_bounds, list) or len(explicit_bounds) != 4:
                raise ValueError(f"{input_path}: {name} bounds must be [left, top, right, bottom]")
            left, top, right, bottom = (int(value) for value in explicit_bounds)
            if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
                raise ValueError(
                    f"{input_path}: {name} bounds {explicit_bounds} fall outside image size {image.size}"
                )
        else:
            left, right = manifest_grid_bounds(column, columns, image.width, column_cuts, "column")
            top, bottom = manifest_grid_bounds(row, rows_count, image.height, row_cuts, "row")
        cell = image.crop((left, top, right, bottom))
        if clean_components:
            cell = remove_stray_components(cell, drop_edge_fragments)
        if strict_cell_bounds:
            source_bounds = cell.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()
            if source_bounds and (
                source_bounds[0] <= 1
                or source_bounds[1] <= 1
                or source_bounds[2] >= cell.width - 1
                or source_bounds[3] >= cell.height - 1
            ):
                raise ValueError(f"{input_path}: {name} touches a cell edge; adjust the grid cuts")
        prepared = fit_cell(
            cell,
            size,
            False,
            tight_fit,
            subject_coverage,
            False,
        )
        output = out_dir / f"{name}.webp"
        prepared.save(output, "WEBP", quality=quality, method=6, exact=True)
        if output.stat().st_size > 100 * 1024:
            raise ValueError(f"{output}: exceeds the 100 KiB runtime budget")
        produced.append(output)
    return produced


def normalize_directory(input_dir: Path, out_dir: Path, size: int, quality: int, coverage: float) -> list[Path]:
    input_paths = sorted(input_dir.glob("*.webp"))
    if not input_paths:
        raise ValueError(f"{input_dir}: no WebP files found")
    out_dir.mkdir(parents=True, exist_ok=True)
    produced: list[Path] = []
    for input_path in input_paths:
        with Image.open(input_path) as opened:
            source = opened.convert("RGBA")
        prepared = fit_cell(
            source,
            size,
            clean_components=False,
            tight_fit=True,
            subject_coverage=coverage,
        )
        output = out_dir / input_path.name
        temporary = output.with_suffix(".tmp.webp")
        prepared.save(temporary, "WEBP", quality=quality, method=6, exact=True)
        temporary.replace(output)
        if output.stat().st_size > 100 * 1024:
            raise ValueError(f"{output}: exceeds the 100 KiB runtime budget")
        produced.append(output)
    return produced


def main() -> None:
    parser = argparse.ArgumentParser()
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--manifest", type=Path)
    inputs.add_argument("--normalize-dir", type=Path)
    parser.add_argument("--out-dir", type=Path)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--coverage", type=float, default=0.78)
    args = parser.parse_args()
    if args.manifest:
        if args.out_dir:
            parser.error("--out-dir can only be used with --normalize-dir")
        manifest_path = args.manifest.resolve()
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        base = manifest_path.parent
        produced: list[Path] = []
        for sheet in manifest["sheets"]:
            input_path = (base / sheet["input"]).resolve()
            out_dir = (base / sheet["outDir"]).resolve()
            produced.extend(process_sheet(input_path, out_dir, sheet, args.size, args.quality))
    else:
        input_dir = args.normalize_dir.resolve()
        out_dir = args.out_dir.resolve() if args.out_dir else input_dir
        produced = normalize_directory(input_dir, out_dir, args.size, args.quality, args.coverage)

    total = sum(path.stat().st_size for path in produced)
    print(f"wrote {len(produced)} achievement icons ({total / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
