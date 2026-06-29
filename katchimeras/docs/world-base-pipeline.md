# World Base image pipeline

The WORLD patch ground is **one large isometric base image** (`base_meadow`). POI
objects (memory chest, journey, sleep, food, egg/creature, …) are planted on top
of it by `components/katchadeck/world/world-canvas.tsx` (image-base mode), and the
user can drag them around in "Customize" mode. This doc is the fast path to
**replace that base image** whenever you want a different look.

## What the base must be

- **One isometric ground slab / island, GROUND ONLY** — grass surface, dirt,
  water, paths; the floating rocky underside is fine. **No buildings, trees,
  rocks, props, or characters** — those are planted as objects on top.
- **~2048² (2K)** so it can be zoomed/panned. Square-ish reads best (the in-app
  framing is roughly square), but any aspect works — anchors are normalised.
- **True alpha** around the slab (BiRefNet matte) so it floats on the dark world
  background. Transparent corners + opaque centre.

The live file is committed at:

```
assets/images/katchimeras/world/base/base_meadow.png
```

It's wired via `worldBaseSource('base_meadow')` in `utils/world-visuals.ts`
(`WORLD_BASE_SOURCES`). Metro picks up the new bytes on reload — no code change
needed to swap the art.

## Replace the base — the script

All paths below run from `katchimeras/` (the Expo app dir). The script uses the
Supabase edge functions (`generate-katchimera-art` → FAL, `remove-image-background`
→ BiRefNet); keys come from `.env.local`.

### A) You already have an image you like (fastest)

Pick an image (e.g. a `fal.media` URL from a chat, or any public image URL) and
matte it straight into the live base:

```bash
python scripts/generate-world-base.py --matte-url "<IMAGE_URL>"
```

This runs **only** BiRefNet on that image and overwrites `base_meadow.png`.
BiRefNet preserves the input resolution, so feed it a ~2K image. Reload the app.

### B) Generate a fresh base from a prompt

Generates with the locked "expansive, ground-only, organic" style + mattes it.
Writes a per-model **candidate** (`base_meadow__nano.png`) so the live base isn't
touched until you promote a winner:

```bash
# nano-banana-2 @ 2K (default, square, highest res)
python scripts/generate-world-base.py --model nano --resolution 2K

# GPT Image 2 (richer detail; landscape, lower res — needs a preset/dict size)
python scripts/generate-world-base.py --model gpt --size 1536x1024
```

Review the candidate PNG, then **promote** the one you want to the live file:

```bash
python scripts/generate-world-base.py --model nano --promote --force
# ...or just copy the chosen candidate over base_meadow.png
```

Tune the look by editing `BASE_STYLE` / `BASES[...]` (the subject) in
`scripts/generate-world-base.py`.

### Flags

| flag | meaning |
|---|---|
| `--matte-url <URL>` | skip generation, matte this image into `base_meadow.png` |
| `--model nano\|gpt` | generation model family |
| `--resolution 0.5K\|1K\|2K\|4K` | nano size (default `2K`; default-of-model is `0.5K`, too small) |
| `--size 1024x1024\|1536x1024` | gpt `image_size` (a `WxH` string → sent as a `{width,height}` dict; gpt rejects raw strings) |
| `--promote` | write straight to the live `base_meadow.png` instead of a candidate |
| `--force` | overwrite an existing candidate/file |

## After swapping: tune the in-app placement (if needed)

The base art changes how objects seat on it. The tunables live at the top of
`components/katchadeck/world/world-canvas.tsx`:

| constant | effect |
|---|---|
| `BASE_FACTOR` | how big the base is drawn vs the object cluster (bigger ⇒ objects read smaller) |
| `BASE_OFFSET_X` / `BASE_OFFSET_Y` | nudge the base so its grass-top seats under the objects |
| `BASE_DEFAULT_ZOOM` | starting zoom |
| `BASE_DRAG_FRAC` | how far across the base objects can be dragged (toward `1.0` = more reach) |

These only need touching if the new art has a very different slab size/position
in its frame. Drag positions persist per slot via `utils/world-base-customisation.ts`.

## Object art — grids of variants (`generate-world-object-grid.py`)

Generate a **grid of variants** of one object, in the base tile's art style, then
split it into individual cutouts. Reusable for any new structure/object — change
`--name` + `--subject`.

```bash
# default egg_pedestal (subject saved in CONFIG)
python scripts/generate-world-object-grid.py --name egg_pedestal --keep-grid

# a brand-new object — just describe it
python scripts/generate-world-object-grid.py --name lamp_post \
  --subject "a tall cozy iron street lamp post with a warm glowing lantern on top"
```

What it does:
1. Sends the base tile (`--ref base_meadow`, downscaled to 512px) to the model's
   **/edit** endpoint as a **style reference** so the object matches the ground's
   lighting / materials / palette.
2. Prompts for an **N×N grid** (`--grid 4`) of distinct variations of the subject
   ONLY (no egg/creature/props on top), premium 3D mascot isometric style.
3. **BiRefNet** mattes the whole grid.
4. Splits into `grid×grid` cells, trims each to its content, saves
   `assets/.../world/objects/<name>/<name>_NN.png` (1-based).

**Level sets (objects that grow 1→4).** Use `--mode progression --grid 2 --frame iso`:
the prompt asks for the SAME object as 4 sequential growth stages (reading order:
top-left smallest → bottom-right biggest), and `--frame iso` packs all 4 into ONE
shared 1:2 bottom-anchored frame so they render at a consistent scale (the object
grows within a constant frame) through `SpriteView`. Map cells `_01.._04` to the
engine's level slots. Example (the restyled image-memories + locations):

```bash
python scripts/generate-world-object-grid.py --name memory_photos --mode progression \
  --grid 2 --frame iso --keep-grid --subject "<staged description, stage 1..4>"
python scripts/generate-world-object-grid.py --name place_marker --mode progression \
  --grid 2 --frame iso --keep-grid --subject "<staged description, stage 1..4>"
```
Then add the four cutouts to `WORLD_OBJECT_SOURCES` and point the engine map at them
(e.g. `VAULT_ASSET` / `PLACES_ASSET` in `today-patch-engine.ts`). To re-split a kept
grid without regenerating, call `split_grid(grid_png, name, 2, 'iso')` via importlib.

**Frame modes.** SpriteView-rendered objects use a **1:1 SQUARE** frame (matches the
grid-cell look) with the object's real bottom pixel planted at `OBJECT_BOTTOM_FRAC`
(0.96) and centred horizontally — derived from the trimmed bbox, no legacy 2:1
assumption. `SpriteView` renders a matching square box (`h = w`), so the object seats
on the tile; the bottom contact point is independent of frame height, so square vs the
old 2:1 doesn't move it. A SHARED square frame across a set keeps a level set scaled
consistently (small stage sits small in the frame, big stage fills it).
- `iso` / `square` — both produce that shared square frame (`square_frame_for()`);
  the two names are kept for callers but behave identically now.
- `trim` — natural cutout for art NOT seated via SpriteView (e.g. the egg pedestal,
  drawn with its own explicit sizing).

To reframe already-split cutouts in place (no regeneration): load each PNG, trim to
its alpha bbox, and re-save via `square_frame_for(obj, cells)` over the set.

For non-growth state sets (e.g. sleep = good/normal/low moods, or a pick-one like
food), use `--mode variants` and map the cells you want by eye when wiring.

**Clean matting (BiRefNet).** Two levers, both needed for light objects:
1. Objects render on a FLAT high-contrast CHROMA backdrop (`BACKDROP` — a bold solid
   colour the object doesn't use, like a green screen), NOT a low-contrast neutral bg.
2. The matte uses BiRefNet **'General Use (Light 2K)'** (`BIREFNET_MODEL`) + `refine_foreground`
   at 2K, not the default 'General Use (Light)' which cuts chunks out of light objects.
   ('General Use (Heavy)' is the slower, more-accurate alternative.)
   The `remove-image-background` edge function now passes `model` / `operatingResolution` /
   `refineForeground` through to `fal-ai/birefnet/v2` (must be deployed:
   `npx supabase functions deploy remove-image-background --project-ref <ref>`).
To re-matte an already-generated grid with a different model (no regeneration), call
`matte(rawGeneratedUrl, name)` on the logged "generated grid" URL, then `split_grid`.

Notes / gotchas:
- **Model**: defaults to `--model nano` (`fal-ai/nano-banana-2/edit`). GPT Image 2's
  edit endpoint (`openai/gpt-image-2/edit`) times out the synchronous edge function
  (504) and caps square output at 1024 — nano is faster and does 2K, so cells come
  out higher-res. `--model gpt` is still available if you want to retry it.
- The style-reference data URI must stay small (≤~512px) or the request 400s
  (body too large).
- `outputName` for BiRefNet must be `[a-z0-9-]+` (the script lowercases + hyphenates).
- Use `--keep-grid` to keep the stitched `_<name>_grid.png` for inspection.

### Wiring a generated object into the app

1. Pick the default cutout, add it to a sources map in `utils/world-visuals.ts`
   (see `EGG_PEDESTAL_SOURCES` / `eggPedestalSource()` for the pattern — only the
   default is bundled; add more keys to offer variants later).
2. Render it where needed. The **egg pedestal** is layered UNDER the egg/creature
   at the base-tile centre (`EGG_CELL` / `CENTRE_CELL` = `{1.5,1.5}`), drawn just
   before the egg in `world-canvas.tsx`; tune `PEDESTAL_W_FACTOR` /
   `PEDESTAL_ASPECT` / `PEDESTAL_TOP_FRAC` / `PEDESTAL_DROP`.

## Adding a second base (later)

To support multiple bases (themes/styles): add the key to `BASES` in the script +
`WORLD_BASE_SOURCES` in `utils/world-visuals.ts`, generate it, then point
`IMAGE_BASE_ID` (world-canvas) at it — or make it selectable. See
[[world-iso-graphics-redesign]] in memory for the broader plan.
