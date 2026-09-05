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
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / ".tmp" / "katchimera-hex-tiles"

CAST_THEMES = {
    "feastle": "a hearty food spirit who treats every good meal as a small celebration; cozy feast kitchen and outdoor cafe habitat",
    "flickerbun": "a velvet-dark story lover with projector-bright eyes; cozy miniature cinema and moonlit story theater habitat",
    "cheerlet": "a joyful party sprite who marks genuinely worth-it moments; bright celebration garden and candlelit confetti habitat",
    "gatherglow": "a warm hearth spirit who glows brighter in good company; shared-table gathering nook and lantern-lit convivial habitat",
    "mossprout": "gentle and grounded, delighted by green detours; lush park garden and mossy nature habitat",
    "pagelet": "cozy miniature bookshop and reading garden habitat with cream paper, warm walnut wood, burgundy ribbon accents, and amber lamplight",
    "relicoon": "a curious museum explorer and keeper of meaningful finds; warm pocket museum, archive cabinets, artifact displays, and expedition keepsakes",
    "skylo": "a city-cool wanderer who carries skyline confidence and warm window-light glow; bright urban plaza and cozy street-corner habitat",
    "steppling": "a cheerful walking and hiking spirit who turns long walks, trails, route markers, footprints, and movement milestones into a cozy outdoor habitat",
    "tasklet": "a determined, competent little doer who loves a checked-off list; focused workshop and productivity garden habitat",
    "vesperitt": "a wide-awake small-hours spirit, calm in the quiet after midnight; moonlit night owl study and stargazing habitat",
}

HOME_THEMES = {
    "explorer": (
        "A compact lookout cabin with a small porch, brass telescope, trail sign, map table, "
        "rolled maps, travelling bags, and a few pine shrubs. Use a sage-green roof, warm timber, "
        "and small brass accents."
    ),
    "creator": (
        "A compact open-front art studio with a curved rose-and-violet roof, a large studio window, "
        "easel and canvas, sculpture stand, shelves of paint pots and brushes, loose sketches, and "
        "one small worktable."
    ),
    "builder": (
        "A compact open-front workshop with a drafting table and blueprints, stacked timber and stone, "
        "measuring tools, gears, a tool rack, and one partially assembled structure. Use honey-toned "
        "wood with muted blue accents."
    ),
    "nurturer": (
        "A small warm cottage with flower boxes, simple garden beds, a watering can, an outdoor "
        "armchair, potted plants, and soft light glowing from the windows. Use sage, cream, and warm wood."
    ),
    "connector": (
        "A small welcoming clubhouse with an open entrance, gathering table, spare chairs, hanging "
        "lanterns, a blank message board, banners, and friendship ribbons. Use coral, cream, and gold."
    ),
    "dreamer": (
        "A small observatory with a domed roof, brass telescope, moon lamp, books, star ornaments, "
        "cloud-shaped stones, and a small reflective moon pool. Use indigo, violet, and gold."
    ),
}

ZODIAC_THEMES = {
    "aries": (
        "A celestial fire shrine with one curved ram-horn arch, two low ember-crystal braziers, "
        "a small solar stone, and restrained crimson, coral, and warm-gold accents."
    ),
    "taurus": (
        "A moonlit earth sanctuary with one broad horn-shaped stone arch, sturdy emerald crystal "
        "clusters, two rounded flowering planters, and moss, jade, cream, and antique-gold accents."
    ),
    "gemini": (
        "A twin observatory garden with two mirrored crescent arches, a paired set of floating star "
        "orbs, two matching ribbon-stream sculptures, and pale gold, sky-blue, and cream accents."
    ),
    "cancer": (
        "A gentle moon-pool shrine with one shell-shaped rear alcove, pearl lanterns, crescent stones, "
        "a small still star pool, and silver, moon-blue, and soft lavender accents."
    ),
    "leo": (
        "A radiant solar pavilion with one sun-mane arch, a warm central sun disc, two low flame "
        "lanterns, bold stepped plinths, and amber, saffron, coral, and gold accents."
    ),
    "virgo": (
        "A celestial harvest garden with one elegant leaf-and-grain arch, a small crystal astrolabe, "
        "orderly herb planters, sheaf motifs, and sage, ivory, wheat-gold, and pale-teal accents."
    ),
    "libra": (
        "A balanced sky pavilion with one graceful symmetrical arch, two suspended balance stones, "
        "paired low reflecting bowls, mirrored side planters, and rose, powder-blue, cream, and gold accents."
    ),
    "scorpio": (
        "A moonlit crystal grotto with one curled tail-like spire at the rear, deep amethyst crystals, "
        "two low red-violet star lamps, dark stone, and restrained plum, wine, and silver accents."
    ),
    "sagittarius": (
        "A comet lookout with one bow-shaped observatory arch, a single upward comet-arrow ornament, "
        "travel stones, a small brass telescope, and cobalt, coral, indigo, and warm-gold accents."
    ),
    "capricorn": (
        "A mountain-star sanctuary with one angular horned summit arch, layered climbing stones, "
        "small teal crystals, a summit beacon, and slate, pine, cream, and muted-gold accents."
    ),
    "aquarius": (
        "A sky-vessel fountain shrine with one sculpted celestial vessel at the rear, broad flowing "
        "water-ribbon forms, two low electric crystal conduits, and cyan, turquoise, silver, and violet accents."
    ),
    "pisces": (
        "A dream-tide sanctuary with one twin-fin arch, two small paired moon pools, flowing ribbon "
        "sculptures, pearl star lights, and ocean-blue, lilac, aqua, and silver accents."
    ),
}

TILE_FRAMING = (
    "Create one iconic main structure or landmark silhouette around the rear/top perimeter of the hex. "
    "Use both sides for a few large, readable thematic props and simple landscaping, creating a broad "
    "U-shaped composition. Keep the center/front standing area generous and uncluttered so the live "
    "central object remains fully readable there. Keep the front 30% as open grass. Keep every addition "
    "inside the original hex footprint and leave its outer edges unobstructed. No text or humans."
)

HOME_TILE_FRAMING = (
    f"{TILE_FRAMING} Keep the main structure at the rear, with its highest point near the upper safe "
    "area of the original square framing."
)

ZODIAC_TILE_FRAMING = (
    f"{TILE_FRAMING} Place one clear celestial landmark at the rear and distribute the sign-specific "
    "motifs across both sides. Keep the familiar's center/front standing area unobstructed."
)

TILE_VARIANTS = {
    "feastle": [
        "warm feast cafe with a tiny open counter, herb planters, picnic table, baskets and lanterns",
        "cozy outdoor supper patio with low back walls, prep shelves, garden herbs, cobble path and serving props",
        "small celebratory food market nook with open-roof back stall, produce baskets, meal table and warm lights",
        "quiet breakfast garden cafe with rounded benches, berry shrubs, tiny oven alcove and clear central floor",
    ],
    "cheerlet": [
        "bright celebration patio with chunky confetti shapes, low back party-garland walls, one tiny candle plinth, rounded balloon shrubs, gift-like blocks with no text, and a clear open standing area",
        "joyful garden party nook with low open-roof back perimeter, smooth bunting arches, oversized flower clusters, candle glow, soft path stones, and clean central floor",
        "small occasion plaza with rounded cake-stand shapes, confetti petals, lantern strings, tiny stage step, festive planters, and open front grass",
        "cozy birthday-candle courtyard with soft gold lights, chunky balloon posts, simple party table shapes, no writing, and a readable resident clearing",
    ],
    "gatherglow": [
        "warm shared-table hearth nook with low back walls, round communal table, glowing lantern belly motifs, ember lights, cozy stools, and a clear front standing space",
        "convivial evening garden with tiny open-roof gathering shelter, soft lantern strings, rounded bench circle, warm firefly embers, snack table shapes, and open central grass",
        "small feast-and-friends patio with low perimeter wall, hearth lamp, shared-table scarf color accents, chunky cushions, glowing jar lights, and clean resident clearing",
        "cozy community lantern courtyard with rounded seating arc, warm amber path stones, tiny tea table, ember-spark planters, and open front lawn",
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
    "pagelet": [
        "open-front bookshop with curved wooden bookshelves, a large open-book canopy, oversized stacked books, a cushioned reading chair, bookmark ribbons, blank book displays, and warm reading lamps",
        "cozy reading garden with an arched book alcove, chunky book stacks, a small library ladder, paper-leaf plants, ribbon markers, and a lantern-lit reading nook",
        "miniature story library with rounded shelves, an open-book roofline, large readable book props, a soft reading bench, scroll basket, and warm amber lamps",
        "quiet bookstore courtyard with a curved bookcase pavilion, oversized books, bookmark banners, a reading chair, paper ornaments, and walnut display tables",
    ],
    "skylo": [
        "bright city-corner pocket plaza with low back skyline-wall silhouettes, warm window-light lantern blocks, rounded bench, simple crosswalk stones, tiny street trees, and clear open standing space",
        "cozy downtown roof-garden nook with low parapet walls, chunky skyline shapes around the back edge, glowing window tiles, planters, soft path stones, and open front lawn",
        "urban stroll habitat with smooth pavement loop, toy-like lamp posts, rounded city planters, tiny transit sign with no writing, warm apartment-window motifs, and clear center grass",
        "mini city square with low open-roof perimeter, skyline crown motifs, cafe bench, soft amber lights, chunky shrubs, no text, and a readable resident clearing",
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


def mime_for(path: Path) -> str:
    suffix = path.suffix.lower()
    return "image/webp" if suffix == ".webp" else "image/jpeg" if suffix in {".jpg", ".jpeg"} else "image/png"


def file_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def call_function(name: str, payload: dict, *, timeout: int = 235) -> dict:
    supabase_url, supabase_key = load_env()
    request = urllib.request.Request(
        f"{supabase_url}/functions/v1/{name}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
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
    creature_path: Path | None,
    quality: str,
    gpt_size: int,
    model: str,
) -> str:
    payload = {
            "action": "generate",
            "model": model,
            "mode": "single",
            "gptImageSize": gpt_size,
            "gptQuality": quality,
            "outputName": output_name,
            "prompt": prompt,
            "referenceBase64": file_b64(base_path),
            "referenceMime": mime_for(base_path),
    }
    if creature_path is not None:
        payload["guideBase64"] = file_b64(creature_path)
        payload["guideMime"] = mime_for(creature_path)
    data = call_function(
        "generate-asset",
        payload,
        timeout=120,
    )
    if data.get("status") == "completed" and isinstance(data.get("imageUrl"), str):
        return str(data["imageUrl"])
    if data.get("status") == "completed" and isinstance(data.get("gridUrl"), str):
        return str(data["gridUrl"])
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
                "model": model,
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


def structured_tile_prompt(*, reference: str, art_style: str, visuals: str, framing: str) -> str:
    """Build a reusable image-edit prompt whose visual brief is easy to swap."""
    return "\n\n".join(
        [
            f"REFERENCE\n{reference}",
            f"ART STYLE\n{art_style}",
            f"VISUALS\n{visuals}",
            f"FRAMING\n{framing}",
        ]
    )


def theme_from_brief(path: Path, *, visual_key: str, kind: str) -> tuple[str, dict]:
    """Turn the portable JSON brief into one stable VISUALS paragraph."""
    try:
        brief = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Could not read environment brief {path}: {exc}") from None
    expected_kind = (
        "home"
        if kind == "floating-home-v2"
        else "zodiac"
        if kind == "zodiac"
        else "resident"
    )
    if brief.get("key") != visual_key or brief.get("kind") != expected_kind:
        raise SystemExit(
            f"Brief must declare key={visual_key!r} and kind={expected_kind!r}; "
            f"got key={brief.get('key')!r}, kind={brief.get('kind')!r}."
        )

    def joined(value: object) -> str:
        return ", ".join(str(item) for item in value) if isinstance(value, list) else str(value or "")

    perimeter = brief.get("perimeter") if isinstance(brief.get("perimeter"), dict) else {}
    cliff = brief.get("cliff") if isinstance(brief.get("cliff"), dict) else {}
    required = ("concept", "floor", "main_structure", "rear_props", "side_props", "lighting")
    if any(not brief.get(field) for field in required) or not perimeter or not cliff:
        raise SystemExit("Brief is incomplete; fill every creative field in new-environment-brief.json.")
    theme = " ".join(
        [
            f"Concept: {brief['concept']}",
            f"Floor: {brief['floor']}",
            f"Main structure: {brief['main_structure']}",
            f"Rear props: {joined(brief['rear_props'])}.",
            f"Upper-side props: {joined(brief['side_props'])}.",
            (
                f"Perimeter: {perimeter.get('material', '')}; palette {joined(perimeter.get('palette'))}; "
                f"emblems {perimeter.get('emblems', '')}."
            ),
            (
                f"Cliff: materials {joined(cliff.get('materials'))}; "
                f"palette {joined(cliff.get('palette'))}."
            ),
            f"Lighting: {brief['lighting']}",
        ]
    )
    return theme, brief


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
    return structured_tile_prompt(
        reference=(
            "Edit image 1. Preserve its exact hex footprint, position, scale, rotation, camera angle, "
            "perspective, depth, grass edge, soil side walls, and square framing. Keep the grass platform, "
            "soil-wall depth, and every platform corner unchanged. Add new structures only on the grass "
            "surface. Keep the flat pure-black background. Use image 2 only as a visual identity reference; "
            "do not draw its character."
        ),
        art_style=(
            "Match image 1's premium stylized 3D toy-diorama finish: rounded clay-like forms, soft "
            "bevels, smooth simplified materials, low-frequency detail, clean silhouettes, and soft warm lighting."
        ),
        visuals=f"{theme}. {flavor}.",
        framing=TILE_FRAMING,
    )


def prompt_for_floating_focused_v2(visual_key: str, theme: str) -> str:
    """Keep the approved floating-v2 island while freeing only its top perimeter."""
    return structured_tile_prompt(
        reference=(
            "Edit image 1 as the authoritative Floating Neighbourhood V2 production tile. Preserve its exact "
            "square canvas, flat-top six-corner hex footprint, position, scale, rotation, camera, perspective, "
            "top-face elevation, centered recessed front stairs, deep tapered floating-island silhouette, every "
            "large cliff-block proportion, cliff depth, cliff material scale, lighting, and padding. The complete "
            "cliff and platform below the top surface must remain in the approved Image 1 art style; do not replace "
            "it with a shallow soil slab, smooth vertical wall, realistic rock, or another island design. Image 2 "
            f"is the authoritative {visual_key} environment-content reference. Translate only its boundary "
            "language, structures, water, planting, furniture, and palette onto Image 1's exact top face. Do not "
            "copy Image 2's camera, outer silhouette, cliff, or rendering style. Do not draw a character."
        ),
        art_style=(
            "Match Image 1 and the approved Floating Neighbourhood V2 Katchimera tiles exactly: premium cozy "
            "stylized 3D toy-diorama art, chunky rounded clay-like forms, broad soft bevels, matte simplified "
            "materials, low-frequency surfaces, clean silhouettes, restrained warm light, and features readable "
            "at 256px. Image 1 controls rendering style; Image 2 controls environment identity only."
        ),
        visuals=theme,
        framing=(
            "Change only the top-face environment. The perimeter hedge visible in Image 1 is not an invariant and "
            "must not be automatically retained, repeated, or replaced by another continuous wall. When Image 2 "
            "supplies its own boundary language, erase Image 1's continuous dark-green hedge/parapet completely; "
            "it is removable top decoration, not part of the protected cliff. Preserve every cliff stone directly "
            "beneath it unchanged, and let the themed ground or moss terminate cleanly at that cliff edge. The top face "
            "may meet the cliff edge with open themed ground, scalloped moss, planting, water, stones, roots, or "
            "short bespoke fence segments from Image 2. Use the whole top face naturally, including the center; "
            "there is no mandatory empty stage or U-shaped layout. A bespoke fence must never sit inside, outside, "
            "or behind a second hedge or perimeter wall. Keep all additions within the exact six-corner top-face "
            "footprint, preserve the stairs, and leave the outer island silhouette readable. Preserve Image 1's "
            "clear upper canvas padding: the tallest feature must remain fully visible and no content may touch or "
            "be clipped by any square canvas edge. No text, number, UI, "
            "creature, human, watermark, bridge, cloud, external ground, cast shadow, realistic texture, tiny "
            "surface noise, or dense clutter."
        ),
    )


def prompt_for_home(visual_key: str, theme: str) -> str:
    return structured_tile_prompt(
        reference=(
            "Edit image 1. Preserve its exact hex footprint, position, scale, rotation, camera angle, "
            "perspective, depth, outline, grass edge, soil side walls, and square framing. Keep the existing "
            "grass platform and soil walls unchanged. Do not increase the platform depth or move its corners. "
            "Add structures only on the grass surface. Keep the flat pure-black background. The supplied "
            "empty base tile is the only image reference."
        ),
        art_style=(
            "Premium stylized 3D toy-diorama materials, rounded clay-like forms, soft bevels, simplified "
            "surface detail, clean silhouettes, and soft warm lighting."
        ),
        visuals=theme,
        framing=HOME_TILE_FRAMING,
    )


def prompt_for_floating_v2(visual_key: str, theme: str) -> str:
    return structured_tile_prompt(
        reference=(
            "Edit image 1. Preserve its exact square canvas, flat-top hex footprint, position, scale, "
            "rotation, camera angle, perspective, deep tapered island silhouette, front stairs, and padding. "
            "Copy the reference island's front geometry exactly: a broad straight front hex edge interrupted "
            "by a centered stair entrance. The stairs are recessed into that edge; never turn the front into "
            "a downward-pointing tip, triangular nose, projecting peninsula, or altered silhouette. "
            "Retheme the full top-face floor with the material described in the brief; replacing the "
            "reference grass is allowed and expected. Preserve the floor's exact elevation, flat shape, "
            "outer boundary, and relationship to the stairs. Keep the entire bottom/front half as one "
            "quiet, continuous, uncluttered floor surface. Use only broad low-frequency floor forms with "
            "no granular texture or small repeated pattern. Do not add a center circle, raised or sunken "
            "plaza, pedestal, distinct rug, path, ring, indentation, or character platform. Confine every "
            "structure and floor prop to the rear half or the upper portions of the left and right side edges. "
            "Build a richer U-shaped frame around the open stage; side details may extend toward the midpoint "
            "but must not enter the bottom half or block the front stairs. You may retheme the perimeter "
            "border and cliff materials as described. Keep a perfectly flat solid pure-black #000000 "
            "background for BiRefNet Heavy. The supplied neutral island is the only image reference."
        ),
        art_style=(
            "Match the Katchimeras premium stylized 3D toy-diorama finish: bold readable silhouettes, "
            "rounded clay-like forms, broad smooth bevels, simplified materials, low-frequency detail, "
            "large uninterrupted shapes, and soft warm lighting. Every feature must remain readable at 256px."
        ),
        visuals=theme,
        framing=(
            "Create a balanced rear-and-side silhouette with several large readable features. Keep the entire "
            "bottom half and full front approach empty of props for the "
            "separately rendered live creature. No text, creature, egg, nest, bridge, clouds, external shadow, "
            "watermark, tiny texture, grass blades, pebbles, cracks, or prop clutter. The black background is "
            "uniform with no gradient, floor, reflection, glow, haze, or cast shadow."
        ),
    )


def prompt_for_floating_home_v2(visual_key: str, theme: str) -> str:
    return structured_tile_prompt(
        reference=(
            "Edit image 1. Preserve its exact square canvas, flat-top hex footprint, position, scale, "
            "rotation, camera angle, perspective, deep tapered island silhouette, front stairs, padding, "
            "central circular stone plaza, and empty woven egg nest. The nest and plaza remain centered, "
            "fully visible, and unchanged in size for the separately rendered live egg. Retheme the cottage, "
            "continuous perimeter, cliff materials, planting, and habitat props as described. Keep the route "
            "from the front stairs to the nest clear. Use the rear and upper side edges as a rich U-shaped "
            "frame without placing objects in front of the nest. Keep a perfectly flat solid pure-black "
            "#000000 background for BiRefNet Heavy. The supplied home island is the only image reference."
        ),
        art_style=(
            "Match the Katchimeras premium stylized 3D toy-diorama finish: bold readable silhouettes, "
            "rounded clay-like forms, broad smooth bevels, simplified materials, low-frequency detail, "
            "large uninterrupted shapes, and soft warm lighting. Every feature must remain readable at 256px."
        ),
        visuals=theme,
        framing=(
            "Create one clear archetype-specific cottage silhouette with several large readable rear-and-side "
            "features. Preserve a calm open floor around the nest and the entire front approach. No baked egg, "
            "creature, bridge, clouds, external shadow, watermark, readable text, tiny texture, grass blades, "
            "pebbles, cracks, or prop clutter. The black background is uniform with no gradient, floor, "
            "reflection, glow, haze, or cast shadow."
        ),
    )


def prompt_for_zodiac(visual_key: str, theme: str) -> str:
    return structured_tile_prompt(
        reference=(
            "Edit image 1. Preserve its exact square canvas, flat-top hex footprint, position, scale, "
            "rotation, camera angle, perspective, deep tapered island silhouette, front stairs, and padding. "
            "Copy the reference island's front geometry exactly: a broad straight front hex edge interrupted "
            "by a centered recessed stair entrance, never a point, nose, peninsula, or altered silhouette. "
            "Retheme the complete top-face floor, continuous perimeter, and cliff materials as described while "
            "preserving their exact elevation, footprint, outer boundary, and relationship to the stairs. "
            "Keep the entire bottom/front half as one quiet continuous floor. Do not add a center circle, plaza, "
            "pedestal, distinct rug, path, ring, indentation, or familiar platform. Confine structures and props "
            "to the rear half and upper left/right sides, forming a rich U-shaped frame around the open stage. "
            "Keep a perfectly flat solid pure-black #000000 background for BiRefNet Heavy. The supplied neutral "
            "floating island is the only image reference."
        ),
        art_style=(
            "Match the Katchimeras premium stylized 3D toy-diorama finish: bold readable silhouettes, rounded "
            "clay-like forms, broad smooth bevels, simplified materials, low-frequency detail, large uninterrupted "
            "shapes, and soft luminous lighting. Every feature must remain readable at 256px."
        ),
        visuals=(
            f"Create a unique {visual_key.title()} zodiac sanctuary. {theme} "
            "Express the sign through architecture, material, colour, and abstract celestial motifs only. "
            "No writing, zodiac glyph, constellation diagram, character, creature, animal, or human."
        ),
        framing=(
            "Create one clear celestial landmark at the rear with a few large sign-specific forms across both "
            "upper sides. Preserve the entire bottom half and front approach as an unobstructed stage for the "
            "separately rendered live zodiac familiar. Keep all additions inside the original silhouette. No egg, "
            "nest, bridge, clouds, external shadow, watermark, tiny texture, grass blades, pebbles, cracks, star "
            "specks, fairy lights, or prop clutter. The black background is uniform with no gradient, floor, "
            "reflection, glow, haze, or cast shadow."
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--visual-key", required=True)
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument(
        "--base",
        help=(
            "Reference image. V2 kinds select their canonical neutral/home source automatically; "
            "legacy kinds retain the legacy grass default."
        ),
    )
    parser.add_argument("--creature", help="Path to Katchimera cutout; defaults to assets/images/katchimeras/cutouts/{visual-key}.png")
    parser.add_argument(
        "--guide",
        help="Optional second image reference. For floating-focused-v2, use the authoritative environment artwork.",
    )
    parser.add_argument(
        "--pipeline-lock",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--theme", help="Theme prompt override.")
    parser.add_argument(
        "--brief",
        help="Checked-in JSON brief copied from design/floating-neighborhood-v2/new-environment-brief.json.",
    )
    parser.add_argument("--quality", default="high")
    parser.add_argument("--gpt-size", type=int, default=2048)
    parser.add_argument(
        "--kind",
        choices=("resident", "floating-v2", "floating-focused-v2", "floating-home-v2", "home", "zodiac"),
        default="resident",
    )
    parser.add_argument(
        "--model",
        choices=("nano", "gpt", "seedream"),
        help="Generation route. V2 defaults to FAL Nano Banana 2; legacy kinds default to GPT.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve and persist prompts/reference metadata without generating or downloading images.",
    )
    args = parser.parse_args()
    if args.count < 1:
        sys.exit("--count must be at least 1.")
    if (
        args.kind == "floating-focused-v2"
        and args.pipeline_lock != "mossprout-hex-neighborhood-v2"
    ):
        sys.exit(
            "floating-focused-v2 is an internal locked mode. Use "
            "scripts/generate-mossprout-hex-neighborhood.py so the canonical manifest, references, "
            "prompts, dependency order, and review flow cannot drift."
        )
    if args.creature and args.guide:
        sys.exit("Use either --creature or --guide, not both.")
    if args.theme and args.brief:
        sys.exit("Use either --brief (preferred for v2) or --theme, not both.")
    if args.model is None:
        args.model = "nano" if args.kind in {"floating-v2", "floating-focused-v2", "floating-home-v2", "zodiac"} else "gpt"

    visual_key = args.visual_key
    default_base = (
        "design/floating-neighborhood-v2/floating-neutral-source.png"
        if args.kind in {"floating-v2", "floating-focused-v2", "zodiac"}
        else "design/floating-neighborhood-v2/floating-home-source.png"
        if args.kind == "floating-home-v2"
        else "assets/images/katchimeras/world/hex/grass_hex_tile_dense_v2.webp"
    )
    base_path = (ROOT / (args.base or default_base)).resolve()
    if args.kind in {"floating-v2", "floating-home-v2", "zodiac"} and args.creature:
        sys.exit(
            "V2 generation never accepts a creature reference. Describe identity through --brief or --theme; "
            "the live creature/egg is rendered separately."
        )
    guide_argument = args.guide or args.creature
    creature_path = (
        (ROOT / guide_argument).resolve()
        if guide_argument
        else (ROOT / f"assets/images/katchimeras/cutouts/{visual_key}.png").resolve()
        if args.kind == "resident"
        else None
    )
    if not base_path.exists():
        sys.exit(f"Missing base image: {base_path}")
    if creature_path is not None and not creature_path.exists():
        sys.exit(f"Missing creature image: {creature_path}")

    out_dir = OUT_ROOT / visual_key
    out_dir.mkdir(parents=True, exist_ok=True)
    brief_path = (ROOT / args.brief).resolve() if args.brief else None
    brief_data = None
    if brief_path is not None:
        if args.kind not in {"floating-v2", "floating-focused-v2", "floating-home-v2", "zodiac"}:
            sys.exit("--brief is supported only for floating-v2 and zodiac kinds.")
        theme, brief_data = theme_from_brief(
            brief_path,
            visual_key=visual_key,
            kind=args.kind,
        )
    elif (
        args.kind in {"floating-v2", "floating-focused-v2"}
        and not args.theme
        and visual_key not in CAST_THEMES
    ) or (
        args.kind == "floating-home-v2"
        and not args.theme
        and visual_key not in HOME_THEMES
    ) or (
        args.kind == "zodiac"
        and not args.theme
        and visual_key not in ZODIAC_THEMES
    ):
        sys.exit("New v2 keys require --brief (preferred) or an explicit --theme.")

    if brief_path is not None:
        pass
    elif args.theme:
        theme = args.theme
    elif args.kind in {"home", "floating-home-v2"}:
        theme = HOME_THEMES.get(visual_key, f"a polished home themed to {visual_key}")
    elif args.kind == "zodiac":
        theme = ZODIAC_THEMES.get(visual_key, f"a polished celestial sanctuary themed to {visual_key}")
    else:
        theme = CAST_THEMES.get(visual_key, f"a custom habitat themed to {visual_key}")

    records = []
    for index in range(1, args.count + 1):
        output_name = f"{visual_key}-{args.kind}-hex-{index}"
        prompt = (
            prompt_for_home(visual_key, theme)
            if args.kind == "home"
            else prompt_for_floating_home_v2(visual_key, theme)
            if args.kind == "floating-home-v2"
            else prompt_for_floating_focused_v2(visual_key, theme)
            if args.kind == "floating-focused-v2"
            else prompt_for_floating_v2(visual_key, theme)
            if args.kind == "floating-v2"
            else prompt_for_zodiac(visual_key, theme)
            if args.kind == "zodiac"
            else prompt_for(visual_key, theme, index)
        )
        prompt_path = out_dir / f"candidate-{index}-prompt.txt"
        prompt_path.write_text(prompt + "\n", encoding="utf-8")
        record = {
            "index": index,
            "visualKey": visual_key,
            "kind": args.kind,
            "theme": theme,
            "prompt": prompt,
            "promptPath": str(prompt_path.relative_to(ROOT)),
            "basePath": str(base_path.relative_to(ROOT)),
            "baseSha256": hashlib.sha256(base_path.read_bytes()).hexdigest(),
            "model": args.model,
            "quality": args.quality,
            "gptSize": args.gpt_size,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "status": "dry-run" if args.dry_run else "generated",
        }
        if brief_path is not None:
            record.update(
                {
                    "briefPath": str(brief_path.relative_to(ROOT)),
                    "briefSha256": hashlib.sha256(brief_path.read_bytes()).hexdigest(),
                    "brief": brief_data,
                }
            )
        if args.dry_run:
            records.append(record)
            print(f"dry-run {output_name}: {prompt_path.relative_to(ROOT)}")
            continue

        print(f"generating {output_name}...")
        image_url = generate_queued_tile(
            output_name=output_name,
            prompt=prompt,
            base_path=base_path,
            creature_path=creature_path,
            quality=args.quality,
            gpt_size=args.gpt_size,
            model=args.model,
        )
        out_path = out_dir / f"candidate-{index}.png"
        download(str(image_url), out_path)
        record.update({"url": image_url, "path": str(out_path.relative_to(ROOT))})
        records.append(record)
        print(f"  saved {out_path}")

    (out_dir / "candidates.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"DONE {out_dir}")


if __name__ == "__main__":
    main()
