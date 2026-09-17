"""Fill a content pack's ``art`` map from a folder of packaged files.

For every art entry the pack already names, whose url's file name is in the
folder: write its ``bytes`` and ``md5``; for a tile's ``:full`` entry, its
``alphaBounds`` from a bounds JSON (``generate-hex-tile-bounds.py --json``);
and, with ``--base-url``, point the url at ``<base-url>/<file name>``. Keys
are never guessed from file names (ids carry dashes, so ``tile-a-b-full``
is ambiguous): author the keys, let this fill the rest.

    python scripts/assemble-content-pack-art.py --manifest data/content-packs/wanderling-trail.json \\
        --dir ../../.tmp-content-pack-art/wanderling-trail/1 --bounds bounds.json \\
        --base-url https://<project>.supabase.co/storage/v1/object/public/content-pack-art/wanderling-trail/1 --write
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit


def file_name_of(url: str) -> str:
    return Path(urlsplit(url).path).name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True, help="The pack document (JSON) whose art entries to fill.")
    parser.add_argument("--dir", required=True, help="The folder holding the packaged files, named as the entries' urls name them.")
    parser.add_argument("--bounds", help="Bounds JSON from generate-hex-tile-bounds.py --json --dir <dir>, keyed by file name.")
    parser.add_argument("--base-url", help="Rewrite each filled entry's url to <base-url>/<file name> (the bucket folder, or file:///… for a device copy).")
    parser.add_argument("--write", action="store_true", help="Write the manifest back; without it, print what would change.")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    pack = json.loads(manifest_path.read_text(encoding="utf-8"))
    art = pack.get("art")
    if not isinstance(art, dict) or not art:
        raise SystemExit("The manifest names no art entries; author the keys first.")
    folder = Path(args.dir)
    bounds = json.loads(Path(args.bounds).read_text(encoding="utf-8")) if args.bounds else {}
    base_url = args.base_url.rstrip("/") if args.base_url else None

    filled: list[str] = []
    missing: list[str] = []
    for key, entry in art.items():
        if not isinstance(entry, dict) or not isinstance(entry.get("url"), str):
            raise SystemExit(f"art {key}: needs a url naming its file")
        name = file_name_of(entry["url"])
        path = folder / name
        if not path.is_file():
            missing.append(f"{key} -> {name}")
            continue
        data = path.read_bytes()
        entry["bytes"] = len(data)
        entry["md5"] = hashlib.md5(data).hexdigest()
        if base_url:
            entry["url"] = f"{base_url}/{name}"
        if key.startswith("tile:") and key.endswith(":full"):
            measured = bounds.get(name)
            if measured:
                entry["alphaBounds"] = {side: int(measured[side]) for side in ("left", "top", "right", "bottom")}
            elif "alphaBounds" not in entry:
                missing.append(f"{key}: no bounds for {name} (pass --bounds)")
        filled.append(f"{key}: {name} {len(data)} bytes {entry['md5']}")

    for line in filled:
        print("filled", line)
    for line in missing:
        print("missing", line)
    if missing:
        raise SystemExit(f"{len(missing)} entr{'y' if len(missing) == 1 else 'ies'} could not be filled.")
    if args.write:
        manifest_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {manifest_path}.")
    else:
        print("Dry run; pass --write to update the manifest.")


if __name__ == "__main__":
    main()
