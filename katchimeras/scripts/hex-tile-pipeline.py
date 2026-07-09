"""Hex tile pipeline: source render -> bundled transparent WebP.

This mirrors the isometric tile pipeline's production stages, but intentionally
does not apply the old diamond homography. Hex tile geometry is supplied to the
FAL edit prompt via a guide image, then the result is matted, repaired, framed,
and optimized.

Example:
  python scripts/hex-tile-pipeline.py ^
    --source "C:/path/to/reference.jpg" ^
    --guide design/hex-tile-clean-flat-regular-projected-widthfit-1024.png ^
    --key egg_hex_tile ^
    --desc "a lush grass hex tile with a circular golden stone nest plaza"
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "hex"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Reference tile render.")
    parser.add_argument("--guide", help="Optional clean hex geometry guide image.")
    parser.add_argument("--key", required=True, help="Output key, e.g. egg_hex_tile.")
    parser.add_argument("--desc", required=True, help="Short material/content description.")
    parser.add_argument("--skip-rerender", action="store_true", help="Matte/frame the source directly.")
    parser.add_argument("--size", type=int, default=1024, help="Final square asset size.")
    parser.add_argument("--pad", type=int, default=14, help="Final transparent border padding.")
    parser.add_argument("--quality", type=int, default=86, help="Final WebP quality.")
    parser.add_argument("--workdir")
    return parser.parse_args()


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    url = env.get("EXPO_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        sys.exit("Missing Supabase URL/key in .env.local.")
    return url.rstrip("/"), key


SUPABASE_URL, SUPABASE_KEY = load_env()


def call_retry(fn: str, payload: dict, *, tries: int = 6, timeout: int = 240) -> dict:
    body = json.dumps(payload).encode()
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                f"{SUPABASE_URL}/functions/v1/{fn}",
                data=body,
                headers={
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "apikey": SUPABASE_KEY,
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as cause:
            detail = cause.read().decode()[:500] if isinstance(cause, urllib.error.HTTPError) else str(cause)
            print(f"  retry {fn} {attempt + 1}: {detail[:120]}")
            time.sleep(8)
    raise RuntimeError(f"{fn} failed after {tries} tries")


def file_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def download(url: str, path: Path) -> None:
    with urllib.request.urlopen(url, timeout=300) as resp:
        path.write_bytes(resp.read())


def rerender(args: argparse.Namespace, work: Path) -> Path:
    source = Path(args.source)
    if args.skip_rerender:
        return source

    out_path = work / "source-2k.png"
    if out_path.exists():
        return out_path

    guide = Path(args.guide) if args.guide else None
    prompt = (
        "Recreate the reference as a production game hex ground tile at high resolution. "
        "Keep the same subject and visible contents from the reference image. "
        "Use the guide image for the exact flat-top hex tile footprint, camera tilt, square framing, "
        "and shallow depth proportions. Do not use a point-up hex. Do not stretch or warp the tile. "
        f"Materials/content: {args.desc}. "
        "Premium cozy 3D toy render, crisp grass and earth detail, soft studio lighting. "
        "Solid pure black background only so BiRefNet can matte the tile cleanly. "
        "No text, no UI, no labels, no watermark."
    )
    payload = {
        "action": "generate",
        "model": "gpt",
        "mode": "single",
        "gptImageSize": 2048,
        "gptQuality": "high",
        "outputName": args.key.replace("_", "-"),
        "prompt": prompt,
        "referenceBase64": file_b64(source),
        "referenceMime": "image/jpeg" if source.suffix.lower() in {".jpg", ".jpeg"} else "image/png",
    }
    if guide and guide.exists():
        payload["guideBase64"] = file_b64(guide)
        payload["guideMime"] = "image/png"

    queued = call_retry("generate-asset", payload, timeout=120)
    request_id = queued.get("requestId")
    if not request_id:
        raise RuntimeError(f"generate-asset did not queue: {queued}")
    print("submitted re-render", request_id)

    while True:
        time.sleep(15)
        poll = call_retry(
            "generate-asset",
            {
                "action": "poll",
                "model": "gpt",
                "mode": "single",
                "outputName": args.key.replace("_", "-"),
                "requestId": request_id,
                "rawResult": True,
            },
            tries=2,
            timeout=120,
        )
        print("re-render", poll.get("status"), poll.get("queueStatus", ""))
        if poll.get("status") == "completed":
            download(str(poll["imageUrl"]), out_path)
            return out_path


def matte(source: Path, args: argparse.Namespace, work: Path) -> Path:
    out_path = work / "matted.png"
    if out_path.exists():
        return out_path
    data = call_retry(
        "remove-image-background",
        {
            "imageBase64": file_b64(source),
            "outputName": args.key.replace("_", "-") + "-hex-matte",
            "model": "General Use (Heavy)",
            "operatingResolution": "2048x2048",
            "refineForeground": True,
        },
        timeout=300,
    )
    if data.get("status") != "completed" or not data.get("imageUrl"):
        raise RuntimeError(f"matte failed: {data}")
    download(str(data["imageUrl"]), out_path)
    return out_path


def fill_internal_alpha_holes(rgba: Image.Image, source: Image.Image) -> Image.Image:
    rgba = rgba.convert("RGBA")
    source_rgb = source.convert("RGB").resize(rgba.size, Image.Resampling.LANCZOS)
    alpha = np.asarray(rgba.getchannel("A")).copy()
    not_opaque = alpha < 250
    outside = np.zeros_like(not_opaque)
    outside[0, :] = not_opaque[0, :]
    outside[-1, :] = not_opaque[-1, :]
    outside[:, 0] = not_opaque[:, 0]
    outside[:, -1] = not_opaque[:, -1]
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= not_opaque
        if grown.sum() == outside.sum():
            break
        outside = grown
    holes = not_opaque & ~outside
    if holes.sum() == 0:
        return rgba
    print("hole fill: restoring", int(holes.sum()), "px from source")
    fixed = np.asarray(rgba).copy()
    src = np.asarray(source_rgb)
    fixed[..., :3] = np.where(holes[..., None], src, fixed[..., :3])
    fixed[..., 3] = np.where(holes, 255, fixed[..., 3])
    return Image.fromarray(fixed)


def frame_and_save(matted: Path, source: Path, args: argparse.Namespace, work: Path) -> Path:
    rgba = Image.open(matted).convert("RGBA")
    source_img = Image.open(source)
    rgba = fill_internal_alpha_holes(rgba, source_img)

    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("Matted image has no opaque pixels.")
    trimmed = rgba.crop(bbox)
    final_size = args.size
    max_side = final_size - args.pad * 2
    scale = min(max_side / trimmed.width, max_side / trimmed.height)
    fitted = trimmed.resize((round(trimmed.width * scale), round(trimmed.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (final_size, final_size), (0, 0, 0, 0))
    canvas.alpha_composite(fitted, ((final_size - fitted.width) // 2, (final_size - fitted.height) // 2))

    png_path = work / "final.png"
    canvas.save(png_path)

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    out_path = OUT_ROOT / f"{args.key}.webp"
    canvas.save(out_path, format="WEBP", quality=args.quality, method=6)

    qa = Image.new("RGB", (final_size, final_size), (18, 22, 40))
    qa.paste(canvas, (0, 0), canvas)
    qa.save(work / "qa-solo.png")
    print("final png", png_path)
    print("bundled", out_path, out_path.stat().st_size // 1024, "KB")
    return out_path


def main() -> None:
    args = parse_args()
    work = Path(args.workdir) if args.workdir else Path(tempfile.gettempdir()) / "hex-tile-pipeline" / args.key
    work.mkdir(parents=True, exist_ok=True)
    source = rerender(args, work)
    print("source", source, Image.open(source).size)
    matted = matte(source, args, work)
    print("matted", matted, Image.open(matted).size)
    final = frame_and_save(matted, source, args, work)
    print("DONE", final)


if __name__ == "__main__":
    main()
