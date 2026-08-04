#!/usr/bin/env python3
"""Split one or more manifest-described 4x4 trophy sheets into runtime WebPs.

Inputs must already have alpha. Rows are named by the manifest and may ship
between one and four tiers, so a generated progression sheet can contain unused
concept cells without adding phantom achievements to the app.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def remove_stray_components(cell: Image.Image) -> Image.Image:
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
    keep = Image.new("L", cell.size, 0)
    draw = ImageDraw.Draw(keep)
    for area, (left, top, right, bottom) in components:
        if area < max(64, largest * 0.05):
            continue
        draw.rectangle((max(0, left - 3), max(0, top - 3), min(width, right + 3), min(height, bottom + 3)), fill=255)
    cleaned = cell.copy()
    cleaned.putalpha(Image.composite(alpha, Image.new("L", cell.size, 0), keep))
    return cleaned


def fit_cell(cell: Image.Image, size: int) -> Image.Image:
    cell = remove_stray_components(cell)
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("cell contains no opaque pixels")
    subject = cell.crop(bounds)
    padding = max(12, round(size * 0.08))
    available = size - padding * 2
    subject.thumbnail((available, available), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    return output


def process_sheet(input_path: Path, out_dir: Path, rows: list[dict[str, object]], size: int, quality: int) -> list[Path]:
    if len(rows) != 4:
        raise ValueError(f"{input_path}: expected exactly four manifest rows")
    image = Image.open(input_path).convert("RGBA")
    if image.width != image.height:
        raise ValueError(f"expected a square image, got {image.size}")
    if image.getchannel("A").getextrema()[0] != 0:
        raise ValueError(f"{input_path}: input has no transparent pixels; remove the chroma key first")

    usable = image.width - image.width % 4
    inset = (image.width - usable) // 2
    if usable != image.width:
        image = image.crop((inset, inset, inset + usable, inset + usable))
    cell_size = image.width // 4
    out_dir.mkdir(parents=True, exist_ok=True)
    produced: list[Path] = []
    for row_index, row in enumerate(rows):
        section = str(row["section"])
        tiers = int(row.get("tiers", 4))
        if not 1 <= tiers <= 4:
            raise ValueError(f"{section}: tiers must be between one and four")
        for column in range(tiers):
            cell = image.crop((column * cell_size, row_index * cell_size, (column + 1) * cell_size, (row_index + 1) * cell_size))
            prepared = fit_cell(cell, size)
            output = out_dir / f"{section}-{column + 1}.webp"
            prepared.save(output, "WEBP", quality=quality, method=6, exact=True)
            if output.stat().st_size > 100 * 1024:
                raise ValueError(f"{output}: exceeds the 100 KiB runtime budget")
            produced.append(output)
    return produced


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--quality", type=int, default=82)
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    base = manifest_path.parent
    produced: list[Path] = []
    for sheet in manifest["sheets"]:
        input_path = (base / sheet["input"]).resolve()
        out_dir = (base / sheet["outDir"]).resolve()
        produced.extend(process_sheet(input_path, out_dir, sheet["rows"], args.size, args.quality))

    total = sum(path.stat().st_size for path in produced)
    print(f"wrote {len(produced)} achievement icons ({total / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
