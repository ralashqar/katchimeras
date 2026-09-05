#!/usr/bin/env python3
"""Promote approved Asset Lab drafts into bundled, optimized assets.

The dev app's World Asset Lab uploads approved drafts to the storage bucket
under  asset-lab-approved/<assetKey>__<stamp>.png  (via the approve-asset edge
function). This script pulls that folder and runs the SAME optimization gate
every bundled sprite goes through:

    alpha-trim -> resize (max side, default 768) -> WebP (default q90)

Outputs land in  assets/images/katchimeras/world/objects/promoted/<assetKey>/
as  <assetKey>_NN.webp  (NN increments per existing files), and the script
prints the require() lines to paste into utils/world-visuals.ts (plus the
catalog entry reminder). Processed bucket files are MOVED to
asset-lab-approved/done/ so re-runs only handle new approvals.

Env (or .env in repo root):
    SUPABASE_URL                e.g. https://xyz.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   service role key (storage list/download/move)

Usage:
    python scripts/promote-dev-assets.py            # promote everything new
    python scripts/promote-dev-assets.py --dry-run  # list, no writes
    python scripts/promote-dev-assets.py --max-side 768 --quality 90
"""

from __future__ import annotations

import argparse
import io
import os
import re
import subprocess
import sys
from pathlib import Path

import requests
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = REPO_ROOT / "assets" / "images" / "katchimeras" / "world" / "objects" / "promoted"
BUCKET = "katchimera-art-dev"
PREFIX = "asset-lab-approved"
DONE_PREFIX = f"{PREFIX}/done"


def load_env() -> tuple[str, str]:
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env).")
    return url, key


def storage_headers(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}", "apikey": key}


def list_approved(url: str, key: str) -> list[str]:
    """File names directly under PREFIX (skips the done/ folder)."""
    response = requests.post(
        f"{url}/storage/v1/object/list/{BUCKET}",
        headers={**storage_headers(key), "Content-Type": "application/json"},
        json={"prefix": PREFIX, "limit": 1000, "offset": 0},
        timeout=30,
    )
    response.raise_for_status()
    names: list[str] = []
    for item in response.json():
        name = item.get("name", "")
        # Folders come back as entries too; approved files are name-only PNGs.
        if name.endswith(".png") and "__" in name:
            names.append(name)
    return names


def download(url: str, key: str, path: str) -> bytes:
    response = requests.get(
        f"{url}/storage/v1/object/{BUCKET}/{path}", headers=storage_headers(key), timeout=60
    )
    response.raise_for_status()
    return response.content


def move_to_done(url: str, key: str, path: str) -> None:
    response = requests.post(
        f"{url}/storage/v1/object/move",
        headers={**storage_headers(key), "Content-Type": "application/json"},
        json={"bucketId": BUCKET, "sourceKey": path, "destinationKey": path.replace(PREFIX, DONE_PREFIX, 1)},
        timeout=30,
    )
    response.raise_for_status()


def alpha_trim(image: Image.Image, padding: int = 4) -> Image.Image:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def optimize(png_bytes: bytes, max_side: int, quality: int) -> bytes:
    image = Image.open(io.BytesIO(png_bytes))
    image = alpha_trim(image)
    scale = max_side / max(image.width, image.height)
    if scale < 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def next_index(folder: Path, asset_key: str) -> int:
    if not folder.exists():
        return 1
    taken = [
        int(match.group(1))
        for candidate in folder.glob(f"{asset_key}_*.webp")
        if (match := re.search(rf"{re.escape(asset_key)}_(\d+)\.webp$", candidate.name))
    ]
    return max(taken, default=0) + 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List what would be promoted; no writes.")
    parser.add_argument("--max-side", type=int, default=768, help="Max sprite side in px (default 768).")
    parser.add_argument("--quality", type=int, default=90, help="WebP quality (default 90).")
    parser.add_argument("--keep-remote", action="store_true", help="Do not move bucket files to done/.")
    args = parser.parse_args()

    url, key = load_env()
    approved = list_approved(url, key)
    if not approved:
        print("Nothing approved — the drop-box is empty.")
        return

    print(f"{len(approved)} approved draft(s):")
    require_lines: list[str] = []
    for name in sorted(approved):
        asset_key = name.split("__", 1)[0]
        remote_path = f"{PREFIX}/{name}"
        if args.dry_run:
            print(f"  [dry] {remote_path} -> promoted/{asset_key}/")
            continue

        png = download(url, key, remote_path)
        webp = optimize(png, args.max_side, args.quality)
        folder = OUT_ROOT / asset_key
        folder.mkdir(parents=True, exist_ok=True)
        index = next_index(folder, asset_key)
        out_path = folder / f"{asset_key}_{index:02d}.webp"
        out_path.write_bytes(webp)
        rel = out_path.relative_to(REPO_ROOT).as_posix()
        print(f"  {remote_path} -> {rel} ({len(webp) / 1024:.0f} KB)")
        # Paths are relative to utils/world-visuals.ts (one level above assets/).
        require_lines.append(f"  {asset_key}_v{index}: require('../{rel}'),")
        if not args.keep_remote:
            move_to_done(url, key, remote_path)

    if require_lines:
        # Regenerate the manifest — promoted variants resolve as `<assetKey>_vN`
        # via constants/world-asset-sources.gen.ts, no hand-edited requires.
        subprocess.run([sys.executable, str(Path(__file__).parent / "sync-promoted-sources.py")], check=True)
        print("\nPromoted keys now resolve as:")
        for line in require_lines:
            key = line.strip().split(":", 1)[0]
            print(f"  {key}")
        print("\nTo USE a variant: add its key to the definition's art.variants in constants/world-objects.ts")
        print("(random families) or reference it directly; new standalone objects also want a catalog entry.")


if __name__ == "__main__":
    main()
