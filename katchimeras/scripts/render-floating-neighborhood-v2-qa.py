import json
from math import sqrt
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HEX_DIR = ROOT / "assets/images/katchimeras/world/hex"
OUT_DIR = ROOT / "design/floating-neighborhood-v2"
WORLD_VIEW = json.loads((ROOT / "constants/kingdom-world-view.json").read_text(encoding="utf-8"))
HEX_CONFIG = WORLD_VIEW["hexTiles"]
V2_SPACING = HEX_CONFIG["layoutProfiles"]["floating-neighborhood-v2"]

HEX_W = float(HEX_CONFIG["width"])
HEX_H = HEX_W * (sqrt(3) / 2) * float(HEX_CONFIG["projectionTilt"])
HORIZONTAL_SPACING = float(V2_SPACING["horizontalSpacing"])
VERTICAL_SPACING = float(V2_SPACING["verticalSpacing"])
VIEW_SCALE = 0.8
CANVAS = (1400, 1150)
CENTER = (700.0, 520.0)
FACE_BOUNDS = (46, 167, 978, 697)


def center_for(q: int, r: int) -> tuple[float, float]:
    return (
        CENTER[0] + HEX_W * 0.75 * HORIZONTAL_SPACING * q * VIEW_SCALE,
        CENTER[1] + HEX_H * VERTICAL_SPACING * (r + q / 2) * VIEW_SCALE,
    )


def paste_tile(canvas: Image.Image, filename: str, center: tuple[float, float]) -> None:
    image = Image.open(HEX_DIR / filename).convert("RGBA")
    face_left, face_top, face_right, _ = FACE_BOUNDS
    scale = HEX_W * VIEW_SCALE / (face_right - face_left)
    size = round(1024 * scale)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    target_left = center[0] - HEX_W * VIEW_SCALE / 2
    target_top = center[1] - HEX_H * VIEW_SCALE / 2
    left = round(target_left - face_left * scale)
    top = round(target_top - face_top * scale)
    canvas.alpha_composite(image, (left, top))


def paste_egg(canvas: Image.Image, center: tuple[float, float]) -> None:
    image = Image.open(ROOT / "assets/images/katchimeras/cutouts/egg-base.webp").convert("RGBA")
    width = round(200 * WORLD_VIEW["egg"]["globalScale"] * VIEW_SCALE)
    height = round(258 * WORLD_VIEW["egg"]["globalScale"] * VIEW_SCALE)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    anchor_x = center[0] + HEX_W * WORLD_VIEW["egg"]["horizontalOffsetHexTileWidth"] * VIEW_SCALE
    anchor_y = center[1] + HEX_H * WORLD_VIEW["egg"]["verticalOffsetHexTileHeight"] * VIEW_SCALE
    canvas.alpha_composite(image, (round(anchor_x - width / 2), round(anchor_y - height / 2)))


def paste_creature(canvas: Image.Image, key: str, center: tuple[float, float]) -> None:
    image = Image.open(ROOT / f"assets/images/katchimeras/cutouts/{key}.png").convert("RGBA")
    size = round(58 * WORLD_VIEW["katchimera"]["globalScale"] * VIEW_SCALE)
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    anchor_x = center[0] + HEX_W * WORLD_VIEW["katchimera"]["horizontalOffsetHexTileWidth"] * VIEW_SCALE
    anchor_y = center[1] + HEX_H * WORLD_VIEW["katchimera"]["verticalOffsetHexTileHeight"] * VIEW_SCALE
    left = round(anchor_x - size / 2 + (size - image.width) / 2)
    top = round(anchor_y - 94.54 * VIEW_SCALE + (size - image.height) / 2)
    canvas.alpha_composite(image, (left, top))


def paste_zodiac_familiar(canvas: Image.Image, element: str, center: tuple[float, float]) -> None:
    image = Image.open(ROOT / f"assets/images/katchimeras/zodiac/familiar_{element}.webp").convert("RGBA")
    base_size = 58.0
    size = round(base_size * WORLD_VIEW["zodiac"]["globalScale"] * VIEW_SCALE)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    anchor_x = center[0] + HEX_W * WORLD_VIEW["zodiac"]["horizontalOffsetHexTileWidth"] * VIEW_SCALE
    anchor_y = center[1] + HEX_H * WORLD_VIEW["zodiac"]["verticalOffsetHexTileHeight"] * VIEW_SCALE
    left = round(anchor_x - size / 2)
    top = round(anchor_y - base_size * 0.63 * VIEW_SCALE - (size - base_size * VIEW_SCALE))
    canvas.alpha_composite(image, (left, top))


FILENAMES = {
    "neutral": "floating_neighborhood_v2_neutral_hex_tile.webp",
    "home": "floating_neighborhood_v2_home_hex_tile.webp",
    "home-explorer": "floating_neighborhood_v2_home_explorer_hex_tile.webp",
    "home-creator": "floating_neighborhood_v2_home_creator_hex_tile.webp",
    "home-builder": "floating_neighborhood_v2_home_builder_hex_tile.webp",
    "home-nurturer": "floating_neighborhood_v2_home_nurturer_hex_tile.webp",
    "home-connector": "floating_neighborhood_v2_home_connector_hex_tile.webp",
    "home-dreamer": "floating_neighborhood_v2_home_dreamer_hex_tile.webp",
    "tasklet": "floating_neighborhood_v2_tasklet_hex_tile.webp",
    "feastle": "floating_neighborhood_v2_feastle_hex_tile.webp",
    "cheerlet": "floating_neighborhood_v2_cheerlet_hex_tile.webp",
    "skylo": "floating_neighborhood_v2_skylo_hex_tile.webp",
    "pagelet": "floating_neighborhood_v2_pagelet_hex_tile.webp",
    "steppling": "floating_neighborhood_v2_steppling_hex_tile.webp",
    "mossprout": "floating_neighborhood_v2_mossprout_hex_tile.webp",
    "flickerbun": "floating_neighborhood_v2_flickerbun_hex_tile.webp",
    "relicoon": "floating_neighborhood_v2_relicoon_hex_tile.webp",
    "bedrotte": "floating_neighborhood_v2_bedrotte_hex_tile.webp",
    "gatherglow": "floating_neighborhood_v2_gatherglow_hex_tile.webp",
    "shellio": "floating_neighborhood_v2_shellio_hex_tile.webp",
    "vesperitt": "floating_neighborhood_v2_vesperitt_hex_tile.webp",
    "zodiac-aries": "floating_neighborhood_v2_zodiac_aries_hex_tile.webp",
    "zodiac-taurus": "floating_neighborhood_v2_zodiac_taurus_hex_tile.webp",
    "zodiac-gemini": "floating_neighborhood_v2_zodiac_gemini_hex_tile.webp",
    "zodiac-cancer": "floating_neighborhood_v2_zodiac_cancer_hex_tile.webp",
    "zodiac-leo": "floating_neighborhood_v2_zodiac_leo_hex_tile.webp",
    "zodiac-virgo": "floating_neighborhood_v2_zodiac_virgo_hex_tile.webp",
    "zodiac-libra": "floating_neighborhood_v2_zodiac_libra_hex_tile.webp",
    "zodiac-scorpio": "floating_neighborhood_v2_zodiac_scorpio_hex_tile.webp",
    "zodiac-sagittarius": "floating_neighborhood_v2_zodiac_sagittarius_hex_tile.webp",
    "zodiac-capricorn": "floating_neighborhood_v2_zodiac_capricorn_hex_tile.webp",
    "zodiac-aquarius": "floating_neighborhood_v2_zodiac_aquarius_hex_tile.webp",
    "zodiac-pisces": "floating_neighborhood_v2_zodiac_pisces_hex_tile.webp",
}


def render(
    name: str,
    tiles: list[tuple[int, int, str]],
    creatures: list[tuple[int, int, str]],
    egg_coords: list[tuple[int, int]] | None = None,
) -> None:
    canvas = Image.new("RGBA", CANVAS, "#0b1020")
    placed = [(center_for(q, r), kind) for q, r, kind in tiles]
    for center, kind in sorted(placed, key=lambda item: (item[0][1], item[0][0])):
        paste_tile(canvas, FILENAMES[kind], center)
    for q, r in egg_coords if egg_coords is not None else [(0, 0)]:
        paste_egg(canvas, center_for(q, r))
    for q, r, key in creatures:
        paste_creature(canvas, key, center_for(q, r))
    out = OUT_DIR / name
    canvas.convert("RGB").save(out, quality=94)
    print(out.relative_to(ROOT))


def render_zodiac_neighborhood(
    name: str,
    signs: list[tuple[int, int, str, str]],
) -> None:
    tiles = [(0, 0, "neutral"), *((q, r, f"zodiac-{sign}") for q, r, sign, _ in signs)]
    canvas = Image.new("RGBA", CANVAS, "#0b1020")
    placed = [(center_for(q, r), kind) for q, r, kind in tiles]
    for center, kind in sorted(placed, key=lambda item: (item[0][1], item[0][0])):
        paste_tile(canvas, FILENAMES[kind], center)
    for q, r, _, element in signs:
        paste_zodiac_familiar(canvas, element, center_for(q, r))
    out = OUT_DIR / name
    canvas.convert("RGB").save(out, quality=94)
    print(out.relative_to(ROOT))


def main() -> None:
    base_tiles = [
        (0, -1, "neutral"),
        (1, -1, "neutral"),
        (-1, 0, "neutral"),
        (0, 0, "home"),
        (1, 0, "neutral"),
        (-1, 1, "neutral"),
        (0, 1, "neutral"),
    ]
    render("qa-seven-island-neighborhood.png", base_tiles, [])
    resident_tiles = [
        (q, r, "tasklet" if (q, r) == (-1, 1) else "feastle" if (q, r) == (1, 0) else kind)
        for q, r, kind in base_tiles
    ]
    render(
        "qa-tasklet-feastle-neighborhood.png",
        resident_tiles,
        [(-1, 1, "tasklet"), (1, 0, "feastle")],
    )
    surface_theme_tiles = [
        (q, r, "cheerlet" if (q, r) == (0, 1) else kind)
        for q, r, kind in resident_tiles
    ]
    render(
        "qa-cheerlet-surface-theme.png",
        surface_theme_tiles,
        [(-1, 1, "tasklet"), (1, 0, "feastle"), (0, 1, "cheerlet")],
    )
    all_resident_tiles = [
        (q, r, "skylo" if (q, r) == (0, -1) else "pagelet" if (q, r) == (1, -1) else kind)
        for q, r, kind in surface_theme_tiles
    ]
    render(
        "qa-five-resident-themes.png",
        all_resident_tiles,
        [
            (0, -1, "skylo"),
            (1, -1, "pagelet"),
            (-1, 1, "tasklet"),
            (1, 0, "feastle"),
            (0, 1, "cheerlet"),
        ],
    )
    steppling_mossprout_tiles = [
        (q, r, "steppling" if (q, r) == (-1, 1) else "mossprout" if (q, r) == (1, 0) else kind)
        for q, r, kind in base_tiles
    ]
    render(
        "qa-steppling-mossprout-neighborhood.png",
        steppling_mossprout_tiles,
        [(-1, 1, "steppling"), (1, 0, "mossprout")],
    )
    refreshed_resident_tiles = [
        (
            q,
            r,
            "skylo"
            if (q, r) == (0, -1)
            else "tasklet"
            if (q, r) == (-1, 1)
            else "mossprout"
            if (q, r) == (1, 0)
            else kind,
        )
        for q, r, kind in base_tiles
    ]
    render(
        "qa-skylo-mossprout-tasklet-refresh.png",
        refreshed_resident_tiles,
        [(0, -1, "skylo"), (-1, 1, "tasklet"), (1, 0, "mossprout")],
    )
    pagelet_cheerlet_feastle_tiles = [
        (
            q,
            r,
            "pagelet"
            if (q, r) == (0, -1)
            else "cheerlet"
            if (q, r) == (-1, 1)
            else "feastle"
            if (q, r) == (1, 0)
            else kind,
        )
        for q, r, kind in base_tiles
    ]
    render(
        "qa-pagelet-cheerlet-feastle-refresh.png",
        pagelet_cheerlet_feastle_tiles,
        [(0, -1, "pagelet"), (-1, 1, "cheerlet"), (1, 0, "feastle")],
    )
    flickerbun_relicoon_tiles = [
        (q, r, "flickerbun" if (q, r) == (-1, 1) else "relicoon" if (q, r) == (1, 0) else kind)
        for q, r, kind in base_tiles
    ]
    render(
        "qa-flickerbun-relicoon-neighborhood.png",
        flickerbun_relicoon_tiles,
        [(-1, 1, "flickerbun"), (1, 0, "relicoon")],
    )
    bedrotte_gatherglow_tiles = [
        (q, r, "bedrotte" if (q, r) == (-1, 1) else "gatherglow" if (q, r) == (1, 0) else kind)
        for q, r, kind in base_tiles
    ]
    render(
        "qa-bedrotte-gatherglow-neighborhood.png",
        bedrotte_gatherglow_tiles,
        [(-1, 1, "bedrotte"), (1, 0, "gatherglow")],
    )
    shellio_vesperitt_tiles = [
        (q, r, "shellio" if (q, r) == (-1, 1) else "vesperitt" if (q, r) == (1, 0) else kind)
        for q, r, kind in base_tiles
    ]
    render(
        "qa-shellio-vesperitt-neighborhood.png",
        shellio_vesperitt_tiles,
        [(-1, 1, "shellio"), (1, 0, "vesperitt")],
    )
    home_archetype_tiles = [
        (0, -1, "home-explorer"),
        (1, -1, "home-creator"),
        (-1, 0, "home-builder"),
        (1, 0, "home-nurturer"),
        (-1, 1, "home-connector"),
        (0, 1, "home-dreamer"),
    ]
    render(
        "qa-six-home-archetypes.png",
        home_archetype_tiles,
        [],
        [(q, r) for q, r, _ in home_archetype_tiles],
    )
    ring_coords = [(0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1)]
    render_zodiac_neighborhood(
        "qa-zodiac-fire-earth.png",
        [
            (*ring_coords[0], "aries", "fire"),
            (*ring_coords[1], "leo", "fire"),
            (*ring_coords[2], "sagittarius", "fire"),
            (*ring_coords[3], "taurus", "earth"),
            (*ring_coords[4], "virgo", "earth"),
            (*ring_coords[5], "capricorn", "earth"),
        ],
    )
    render_zodiac_neighborhood(
        "qa-zodiac-air-water.png",
        [
            (*ring_coords[0], "gemini", "air"),
            (*ring_coords[1], "libra", "air"),
            (*ring_coords[2], "aquarius", "air"),
            (*ring_coords[3], "cancer", "water"),
            (*ring_coords[4], "scorpio", "water"),
            (*ring_coords[5], "pisces", "water"),
        ],
    )


if __name__ == "__main__":
    main()
