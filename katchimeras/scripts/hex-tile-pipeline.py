"""Hex tile pipeline: source render -> bundled transparent WebP.

This mirrors the isometric tile pipeline's production stages, but intentionally
does not apply the old diamond homography. Hex tile geometry is supplied to the
FAL edit prompt via a guide image, then the result is matted, framed, and
optimized. BiRefNet remains authoritative at every exterior edge; a conservative
source-backed repair restores only torn-out pixels safely inside the silhouette.

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
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "assets" / "images" / "katchimeras" / "world" / "hex"
BIREFNET_HEAVY_MODEL = "BiRefNet_lite"


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
    parser.add_argument(
        "--lod-sizes",
        type=int,
        nargs="*",
        default=[512, 256],
        help="Additional square WebP LOD sizes to write beside the final asset.",
    )
    parser.add_argument("--workdir")
    parser.add_argument(
        "--skip-bounds",
        action="store_true",
        help="Defer the shared alpha-bounds manifest rebuild (useful for parallel batches).",
    )
    parser.add_argument(
        "--preserve-canvas",
        action="store_true",
        help="Keep the source square framing instead of trimming and recentering the matte.",
    )
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
    digest_path = work / "matted.source.sha256"
    source_digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if (
        out_path.exists()
        and digest_path.exists()
        and digest_path.read_text(encoding="utf-8").strip() == source_digest
    ):
        print("matted cache hit for unchanged source", source_digest[:12])
        return out_path
    data = call_retry(
        "remove-image-background",
        {
            "imageBase64": file_b64(source),
            "outputName": args.key.replace("_", "-") + "-hex-matte",
            "model": BIREFNET_HEAVY_MODEL,
            "operatingResolution": "1024x1024",
            "refineForeground": True,
        },
        timeout=300,
    )
    if data.get("status") != "completed" or not data.get("imageUrl"):
        raise RuntimeError(f"matte failed: {data}")
    download(str(data["imageUrl"]), out_path)
    digest_path.write_text(source_digest + "\n", encoding="utf-8")
    return out_path


def source_foreground_mask(source: Image.Image, target_size: tuple[int, int]) -> np.ndarray:
    """Return the source silhouette while leaving border-connected black outside."""

    rgb = source.convert("RGB").resize(target_size, Image.Resampling.LANCZOS)
    arr = np.asarray(rgb).astype(np.int16)
    max_channel = arr.max(axis=2)
    min_channel = arr.min(axis=2)
    blackish = (max_channel < 30) & ((max_channel - min_channel) < 18)

    outside = np.zeros_like(blackish)
    outside[0, :] = blackish[0, :]
    outside[-1, :] = blackish[-1, :]
    outside[:, 0] = blackish[:, 0]
    outside[:, -1] = blackish[:, -1]
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= blackish
        if grown.sum() == outside.sum():
            break
        outside = grown
    return ~outside


def restore_interior_source_pixels(rgba: Image.Image, source: Image.Image) -> Image.Image:
    """Restore BiRefNet dropouts without touching its antialiased exterior edge.

    The black-background source supplies the missing grass/interior RGB. A
    three-pixel erosion creates a protected exterior band where BiRefNet RGBA
    passes through byte-for-byte, avoiding the hard outline caused by the old
    unrestricted non-black restoration.
    """

    rgba = rgba.convert("RGBA")
    source_rgb = source.convert("RGB").resize(rgba.size, Image.Resampling.LANCZOS)
    src = np.asarray(source_rgb).astype(np.int16)
    max_channel = src.max(axis=2)
    min_channel = src.min(axis=2)
    nonblack = (max_channel >= 30) | ((max_channel - min_channel) >= 18)
    foreground = source_foreground_mask(source, rgba.size)
    safe_interior = np.asarray(
        Image.fromarray((foreground.astype(np.uint8) * 255), mode="L").filter(ImageFilter.MinFilter(7))
    ) == 255
    alpha = np.asarray(rgba.getchannel("A"))
    restore = nonblack & safe_interior & (alpha < 245)
    if restore.sum() == 0:
        return rgba
    print("interior source restore:", int(restore.sum()), "px; exterior BiRefNet edge unchanged")
    fixed = np.asarray(rgba).copy()
    fixed[..., :3] = np.where(restore[..., None], src, fixed[..., :3])
    fixed[..., 3] = np.where(restore, 255, fixed[..., 3])
    return Image.fromarray(fixed.astype(np.uint8))


def frame_and_save(matted: Path, source: Path, args: argparse.Namespace, work: Path) -> Path:
    rgba = Image.open(matted).convert("RGBA")
    rgba = restore_interior_source_pixels(rgba, Image.open(source))

    final_size = args.size
    if args.preserve_canvas:
        canvas = rgba
        if canvas.size != (final_size, final_size):
            canvas = canvas.resize((final_size, final_size), Image.Resampling.LANCZOS)
    else:
        bbox = rgba.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError("Matted image has no opaque pixels.")
        trimmed = rgba.crop(bbox)
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
    for lod_size in args.lod_sizes:
        if lod_size <= 0 or lod_size >= final_size:
            continue
        lod = canvas.resize((lod_size, lod_size), Image.Resampling.LANCZOS)
        lod_path = OUT_ROOT / f"{args.key}_{lod_size}.webp"
        lod_quality = 82 if lod_size >= 512 else 78
        lod.save(lod_path, format="WEBP", quality=min(args.quality, lod_quality), method=6)
        print("bundled lod", lod_path, lod_path.stat().st_size // 1024, "KB")

    if not args.skip_bounds:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "generate-hex-tile-bounds.py")],
            cwd=ROOT,
            check=True,
        )

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
