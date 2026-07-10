#!/usr/bin/env python3
"""Generate custom resident hex tile candidates through generate-katchimera-art.

This uses the queued Supabase/FAL endpoint used by the Asset Lab for slow GPT
Image 2 edits, so high-quality runs can finish without the gateway timing out.

Example:
  python scripts/generate-katchimera-hex-tile.py --visual-key feastle
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / ".tmp" / "katchimera-hex-tiles"

CAST_THEMES = {
    "feastle": "a hearty food spirit who treats every good meal as a small celebration; cozy feast kitchen and outdoor cafe habitat",
    "flickerbun": "a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat",
    "mossprout": "gentle and grounded, delighted by green detours; lush park garden and mossy nature habitat",
    "steppling": "a cheerful walking and hiking spirit who turns long walks, trails, route markers, footprints, and movement milestones into a cozy outdoor habitat",
    "tasklet": "a determined, competent little doer who loves a checked-off list; focused workshop and productivity garden habitat",
    "vesperitt": "a wide-awake small-hours spirit, calm in the quiet after midnight; moonlit night owl study and stargazing habitat",
}

TILE_VARIANTS = {
    "feastle": [
        "warm feast cafe with a tiny open counter, herb planters, picnic table, baskets and lanterns",
        "cozy outdoor supper patio with low back walls, prep shelves, garden herbs, cobble path and serving props",
        "small celebratory food market nook with open-roof back stall, produce baskets, meal table and warm lights",
        "quiet breakfast garden cafe with rounded benches, berry shrubs, tiny oven alcove and clear central floor",
    ],
    "flickerbun": [
        "cozy open-air story cinema with a tiny projector booth, velvet seating, moonlit lanterns, film reels, and a clear front stage",
        "miniature outdoor theater nook with low back walls, blank projection screen, starry curtains, ticket-stub props, and soft purple lights",
        "storybook screening garden with open-roof back perimeter, plush benches, firefly lamps, film canisters, and a tiny snack stand with no text",
        "dreamy moonlit cinema patio with rounded velvet cushions, projector glow, decorative reels, low walls, and clear central standing space",
    ],
    "mossprout": [
        "simple toy-like pocket park with one rounded moss mound, two or three chunky bush clusters, smooth tiny blue oval pond, a few large rounded stepping stones, oversized flowers, low garden alcove around the back, and clear open grass in front",
        "quiet toy greenhouse garden nook with open-roof back perimeter, chunky moss benches, simplified seedling shelves, one rounded watering can, large fern clumps, and central standing space",
        "soft woodland toy park with a clean curved path, smooth mushroom log shapes, rounded leafy arch, one blank nature sign, large pond stones, and open front lawn",
        "minimal mossy meditation garden with low stone border, rounded fern planters, smooth tiny stream, two lanterns, chunky seed sprouts, and a clear resident clearing",
    ],
    "steppling": [
        "sunny trailhead rest stop with rounded stepping stones, tiny route signposts with no writing, a backpack bench, water station, grass tufts, and soft footprint motifs",
        "cozy hiking-lodge porch edge with low wood rail at the back, carved trail-map shapes with no text, milestone stones without numbers, pine shrubs, and a winding path",
        "park walking-loop habitat with a curved path, small rest bench, blank mile-marker stones, soft lanterns, shoe-print ground details, and a picnic pause spot",
        "mountain meadow waypoint with switchback path, tiny lookout platform, travel-scuffed stones, bright movement energy, pine saplings, and clear open standing space",
    ],
    "tasklet": [
        "focused outdoor workshop with low back wall, blank task board, tidy workbench, tool caddy, stacked notebooks with no text, blue lanterns, and open center",
        "productivity garden desk nook with open-roof back perimeter, organized shelves, checkmark-shaped decorative tokens without writing, small clock, and clear standing area",
        "cozy planning station with tiny drafting table, blank pinned cards, supply crates, pencil cup, path stones, neat hedges, and open front grass",
        "efficient maker patio with low walls, miniature project bench, sorted boxes, glowing focus lamp, blank clipboard props, and clean central workspace",
    ],
    "vesperitt": [
        "moonlit night study with low back walls, tiny telescope, stacked books, glowing desk lamp, star jars, dark blue cushions, and a clear front standing area",
        "quiet midnight observatory nook with open-roof back perimeter, brass telescope platform, crescent lanterns, sleepy shrubs, star charts with no text, and violet glow",
        "small after-midnight reading garden with plush chair, blank notebooks, firefly lights, moonflower planters, owl-like perch shapes, and open central grass",
        "dreamy stargazer patio with low stone walls, constellation lanterns, tiny tea table, soft indigo blankets, night-bloom plants, and clear resident space",
    ],
}


def load_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env[key] = value.strip().strip('"').strip("'")
    url = env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or env.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        sys.exit("Missing Supabase URL/key in .env.local.")
    return url.rstrip("/"), key


SUPABASE_URL, SUPABASE_KEY = load_env()


def mime_for(path: Path) -> str:
    suffix = path.suffix.lower()
    return "image/webp" if suffix == ".webp" else "image/jpeg" if suffix in {".jpg", ".jpeg"} else "image/png"


def file_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def call_function(name: str, payload: dict, *, timeout: int = 235) -> dict:
    request = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"{name} HTTP {exc.code}: {body[:1200]}") from None


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)


def generate_queued_tile(
    *,
    output_name: str,
    prompt: str,
    base_path: Path,
    creature_path: Path,
    quality: str,
    gpt_size: int,
) -> str:
    data = call_function(
        "generate-asset",
        {
            "action": "generate",
            "model": "gpt",
            "mode": "single",
            "gptImageSize": gpt_size,
            "gptQuality": quality,
            "outputName": output_name,
            "prompt": prompt,
            "referenceBase64": file_b64(base_path),
            "referenceMime": mime_for(base_path),
            "guideBase64": file_b64(creature_path),
            "guideMime": mime_for(creature_path),
        },
        timeout=120,
    )
    request_id = data.get("requestId")
    if not request_id:
        raise RuntimeError(f"{output_name}: generate-asset did not queue: {data}")
    print(f"  queued {request_id}")
    for attempt in range(1, 121):
        time.sleep(8)
        poll = call_function(
            "generate-asset",
            {
                "action": "poll",
                "model": "gpt",
                "mode": "single",
                "outputName": output_name,
                "requestId": request_id,
                "rawResult": True,
            },
            timeout=180,
        )
        print(f"  poll {attempt}/120: {poll.get('status')} {poll.get('queueStatus', '')}")
        if poll.get("status") == "completed" and isinstance(poll.get("imageUrl"), str):
            return str(poll["imageUrl"])
    raise TimeoutError(f"{output_name}: generation did not complete")


def prompt_for(visual_key: str, theme: str, variant_index: int) -> str:
    variants = TILE_VARIANTS.get(
        visual_key,
        [
            "themed cozy habitat with small props, soft landscaping, clear paths, and a readable open standing area",
            "miniature outdoor room with low back perimeter details, ground decorations, and space reserved for the resident sprite",
            "compact toy-like habitat with layered plants, path details, small stations, and a clean central floor",
            "premium app-game home tile with themed object clusters, soft depth, and a clear front standing zone",
        ],
    )
    flavor = variants[(variant_index - 1) % len(variants)]
    return " ".join(
        [
            f"Create a custom resident hex tile for {visual_key}.",
            f"Theme: {theme}. Direction: {flavor}.",
            "Use input image 1 as the exact base hex tile geometry, footprint, camera angle, depth, square framing, lighting, grass edge, soil side walls, and app art style reference.",
            "Use input image 2 only as the Katchimera identity and personality reference; do not draw the Katchimera itself.",
            "The tile must align exactly to the base tile footprint and remain a single square render on a perfectly flat black background.",
            "Design the environment as a themed little habitat with props, trees or shrubs, ground details, and one small open-roof structure if useful.",
            "If a building exists, place it around the back perimeter of the hex tile with visible low walls and no roof blocking the interior.",
            "Keep the center/front standing area readable and open so the live Katchimera sprite can stand there later.",
            "Premium stylized 3D toy diorama, mascot-world art, rounded clay-like forms, soft bevels, smooth simplified materials, low-frequency detail, clean readable silhouette, soft warm lighting, same perspective as the base.",
            "Avoid realism, dense foliage, tiny repeated leaves, tiny grass blades, moss noise, many small petals, pebble scatter, bark grain, water ripples, photoreal texture, sharp micro-detail, and clutter.",
            "No text, no numbers, no labels, no UI, no extra creature, no humans, no watermark, no crop outside the hex tile.",
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--visual-key", required=True)
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--base", default="assets/images/katchimeras/world/hex/grass_hex_tile_dense_v2.webp")
    parser.add_argument("--creature", help="Path to Katchimera cutout; defaults to assets/images/katchimeras/cutouts/{visual-key}.png")
    parser.add_argument("--theme", help="Theme prompt override.")
    parser.add_argument("--quality", default="high")
    parser.add_argument("--gpt-size", type=int, default=2048)
    args = parser.parse_args()

    visual_key = args.visual_key
    base_path = (ROOT / args.base).resolve()
    creature_path = (ROOT / (args.creature or f"assets/images/katchimeras/cutouts/{visual_key}.png")).resolve()
    if not base_path.exists():
        sys.exit(f"Missing base image: {base_path}")
    if not creature_path.exists():
        sys.exit(f"Missing creature image: {creature_path}")

    out_dir = OUT_ROOT / visual_key
    out_dir.mkdir(parents=True, exist_ok=True)
    theme = args.theme or CAST_THEMES.get(visual_key, f"a custom habitat themed to {visual_key}")

    records = []
    for index in range(1, args.count + 1):
        output_name = f"{visual_key}-resident-hex-{index}"
        prompt = prompt_for(visual_key, theme, index)
        print(f"generating {output_name}...")
        image_url = generate_queued_tile(
            output_name=output_name,
            prompt=prompt,
            base_path=base_path,
            creature_path=creature_path,
            quality=args.quality,
            gpt_size=args.gpt_size,
        )
        out_path = out_dir / f"candidate-{index}.png"
        download(str(image_url), out_path)
        records.append({"index": index, "url": image_url, "path": str(out_path), "quality": args.quality, "gptSize": args.gpt_size})
        print(f"  saved {out_path}")

    (out_dir / "candidates.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"DONE {out_dir}")


if __name__ == "__main__":
    main()
