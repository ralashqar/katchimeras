#!/usr/bin/env python3
"""Pack Mossprout Merge art into lazy-loadable, guttered runtime atlases."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "mossprout-merge-atlas-manifest.json"
SOURCE = ROOT / "assets" / "images" / "katchimeras" / "merge-world"
OUTPUT = SOURCE / "generated"
RUNTIME_MANIFEST = OUTPUT / "mossprout-merge-atlas.json"


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    size = manifest["atlasSize"]
    content = manifest["contentSize"]
    pitch = manifest["slotPitch"]
    columns = size // pitch
    runtime = {"version": manifest["version"], "atlasSize": size, "contentSize": content, "pages": {}, "entries": {}}
    seen: set[str] = set()
    for page in manifest["pages"]:
        if len(page["entries"]) > columns * columns:
            raise ValueError(f"{page['id']}: too many entries")
        atlas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        runtime["pages"][page["id"]] = page["file"]
        for index, (key, relative) in enumerate(page["entries"]):
            if key in seen:
                raise ValueError(f"duplicate atlas key: {key}")
            seen.add(key)
            path = SOURCE / relative
            with Image.open(path) as opened:
                sprite = opened.convert("RGBA").resize((content, content), Image.Resampling.LANCZOS)
            x = (index % columns) * pitch + (pitch - content) // 2
            y = (index // columns) * pitch + (pitch - content) // 2
            atlas.alpha_composite(sprite, (x, y))
            runtime["entries"][key] = {"page": page["id"], "x": x, "y": y, "width": content, "height": content}
        destination = OUTPUT / page["file"]
        atlas.save(destination, "WEBP", quality=88, method=6, exact=True)
        print(f"Wrote {destination.relative_to(ROOT)} ({destination.stat().st_size} bytes)")
    RUNTIME_MANIFEST.write_text(json.dumps(runtime, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {RUNTIME_MANIFEST.relative_to(ROOT)} ({len(seen)} entries)")


if __name__ == "__main__":
    main()
