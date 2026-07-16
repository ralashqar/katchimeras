# Katchimera asset pipeline

How production art is made in this repo: prompt → FAL generation → BiRefNet
matting (true alpha) → visual QA → crop → bundle → wire into the app. Every
step is real and runnable; `scripts/asset-pipeline.py` is the CLI that drives
it, and `/katchimera-assets` is the skill that operationalizes this doc.

Nothing here touches a designer's machine — FAL runs in the cloud, the Swift
never enters the loop, and a Windows box with Python is enough.

## Architecture

```
Python CLI (.env.local anon key)
   │  POST /functions/v1/...
   ▼
Supabase edge functions (hold FAL_KEY + service role as secrets)
   ├─ generate-katchimera-art   → FAL fal-ai/nano-banana-2            → bucket + generated_katchimeras row
   ├─ generate-katchimera-art   → FAL fal-ai/nano-banana-2/edit       → consistent frame variants from a source image
   └─ remove-image-background   → FAL fal-ai/birefnet/v2 (matting)    → cutouts/<name>/<ts>.png (true alpha)
   ▼
Storage bucket: katchimera-art-dev (public)  ·  audit table: generated_katchimeras
   ▼
Download → QA (Read the PNG) → crop (PIL) → assets/images/katchimeras/cutouts/ → wire into constants
```

### Why these tools

- **FAL `nano-banana-2`** for generation; the **`/edit`** sibling for variants
  that must stay visually consistent with a source frame (egg crack stages,
  mood variants) — pass the original via `input.image_urls`.
- **BiRefNet v2** for background removal, *not* "transparent background"
  prompting (which fakes a checkerboard) and *not* greenscreen chroma-key
  (which fringes). BiRefNet emits a real alpha channel, so creatures float
  over the app's gradients instead of reading as photos in circles.
- **Supabase edge functions** keep `FAL_KEY` and the service role server-side;
  the client only ever holds the public anon key.

### Secrets (already set in the Supabase project)

`FAL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Set/inspect with
`npx supabase secrets list` / `set`. The CLI here needs none of them — only
the anon key from `.env.local`.

## The functions

### `generate-katchimera-art`
`supabase/functions/generate-katchimera-art/index.ts`. POST body:
```jsonc
{
  "renderProfile": { "id": "...", "displayName": "...", "imagePrompt": "...", /* + metadata */ },
  "modelId": "fal-ai/nano-banana-2",            // optional; or .../edit
  "input": { "image_urls": ["https://..."] }     // required for edits
}
```
Inserts a `generated_katchimeras` row (status `generating`), calls FAL, downloads
the result, uploads to `katchimera-art-dev`, flips the row to `completed` with
the public `image_url`. Returns `{ record: {...} }`.

### `remove-image-background`
`supabase/functions/remove-image-background/index.ts`. POST `{ imageUrl | imageBase64, outputName }`
→ BiRefNet → stores `cutouts/<outputName>/<ts>.png` → `{ status, imageUrl }`.

## The CLI

```bash
# 1. Generate a candidate (no-text negatives are appended automatically)
python scripts/asset-pipeline.py generate \
  --id location_cafe_lattelet \
  --prompt "<the encounter profile's imagePrompt>" \
  --out /tmp/lattelet.png

# 2. (variants only) Edit from a source frame for visual consistency
python scripts/asset-pipeline.py edit \
  --id egg_crack_1 \
  --prompt "the exact same egg, thin glowing golden cracks across the upper shell, light seeping out; same egg, position, lighting, background" \
  --image-url https://.../egg-base.png \
  --out /tmp/egg-crack-1.png

# 3. Matte to true alpha (verifies corners=0 / subject opaque automatically)
python scripts/asset-pipeline.py matte \
  --name lattelet --in /tmp/lattelet.png \
  --out assets/images/katchimeras/cutouts/lattelet.png

# verify any existing PNG
python scripts/asset-pipeline.py verify --in assets/images/katchimeras/cutouts/lattelet.png
```

### Hatchling-to-final evolution grids

`scripts/generate-evolution-grid.py` creates an ordered 3x3 review sheet for
any catalog Katchimera. Its default `guided-sheet` strategy passes the fixed
base hatchling as the sole generation image reference, supplies the adult
identity and every monotonic stage as text, and then runs the sheet through the
deployed BiRefNet **General Use (Heavy)** matte. The exact hatchling and exact
existing adult cutout are stamped into stages one and nine after generation.
This avoids both backward egg states and premature copying of the adult design.
The default hatchling reference is the approved richer
`assets/images/katchimeras/hatchlings/base-hatchling-v2.png` derived from the
`exec-e274bd86-4c34-4a20-ab70-37850ce0d4f8` render.

```bash
# Resolves the profile and final cutout from the catalog/name.
python scripts/generate-evolution-grid.py --creature pagelet

# Epic progression: egg only in cell 1, canonical adult in cell 8, generated
# overpowered ultimate form in cell 9.
python scripts/generate-evolution-grid.py \
  --name Pagelet \
  --hatchling assets/images/katchimeras/hatchlings/pagelet-hatchling-v1.png \
  --final assets/images/katchimeras/cutouts/pagelet.png \
  --progression epic

# Sequential low-cost continuity test. Each 1024px stage receives the approved
# hatchling plus one history-board reference containing every accepted earlier
# stage. Stages are Heavy-matted individually and assembled afterward.
python scripts/generate-evolution-grid.py \
  --name Pagelet \
  --hatchling assets/images/katchimeras/hatchlings/pagelet-hatchling-v1.png \
  --final assets/images/katchimeras/cutouts/pagelet.png \
  --strategy sequential \
  --progression epic \
  --size 1024 \
  --quality low

# Fully from scratch: the approved generic hatchling is used only to generate
# a new species-specific stage 1. No existing creature/adult artwork is used;
# all later stages, including adult and epic, grow from accepted history.
python scripts/generate-evolution-grid.py \
  --creature location_coffee_shop_baristabbit \
  --strategy sequential \
  --progression epic \
  --from-scratch \
  --size 1024 \
  --quality low

# Redraw one completed grid toward an authoritative original creature identity.
# Image 1 preserves the grid/progression; image 2 controls character identity.
python scripts/generate-evolution-grid.py \
  --name Baristabbit \
  --description "<concise authoritative identity>" \
  --refine-grid assets/images/katchimeras/evolution-grids/<run>/baristabbit-evolution-grid.png \
  --identity-reference assets/images/katchimeras/cutouts/baristabbit.png \
  --model gpt \
  --size 2048 \
  --quality medium

# Production three-stage evolution: generate a species hatchling from the
# approved base + existing adult, then generate one child from that hatchling +
# adult. The adult itself is preserved unchanged.
python scripts/generate-evolution-grid.py \
  --creature location_coffee_shop_baristabbit \
  --three-stage \
  --model gpt \
  --size 1024 \
  --quality medium

# Retry only the child while keeping an approved hatchling.
python scripts/generate-evolution-grid.py \
  --creature location_coffee_shop_baristabbit \
  --three-stage \
  --reuse-hatchling assets/images/katchimeras/evolution-grids/<run>/matted-stages/stage-01-hatchling.png \
  --model gpt \
  --size 1024 \
  --quality medium

# Explicit inputs for a new or non-catalog creature.
python scripts/generate-evolution-grid.py \
  --name moonling \
  --description "a soft moonlit cloud creature with crescent ears" \
  --final path/to/moonling.png

# Prefer a precise adult description: palette, anatomy, motif, tail/ears and
# explicit exclusions such as no clothing or handheld props.

# Prompt and manifest only; no generation cost.
python scripts/generate-evolution-grid.py --creature pagelet --dry-run --force
```

Outputs live under
`assets/images/katchimeras/evolution-grids/<name>/`: raw and matted sheets,
`cells/stage-01.png` through `stage-09.png`, the assembled review grid, the
exact prompt, and `manifest.json` with generation provenance.

## QA gates (do not skip — taste is human)

After downloading, **Read the PNG** and judge against the art bible's five gates:
1. **Thumbnail read** — recognizable at timeline-orb size (~58px).
2. **Silhouette** — distinct outline, head-dominant mascot proportions.
3. **Glow core** — a visible inner light.
4. **One signature motif** — a single oversized encounter cue, not clutter.
5. **Eyes** — oversized, glossy, characterful.

Reject and regenerate when:
- **Any baked-in text/numbers/monograms** (violates art bible + the brand's
  no-metrics rule). The CLI appends a hard no-text negative; if it still leaks,
  regenerate — model variance, not a prompt bug. (Real cases this session:
  Steppling's "12,345 MILES", Quietome's "Q" bookmark tag.)
- Background clutter, extra creatures, a human, a weapon, plastic-toy look.

Every run is preserved in `generated_katchimeras` + the bucket for audit, so
rejects cost nothing but a regenerate.

## Cropping & compositing (PIL)

- **Pedestal / stray element crop** — when the model adds a base or platform,
  find the transparency gap below the subject and crop there, then recenter.
- **Shared-bbox crop for animation frames** — tight-crop a set of frames (egg
  base + crack stages) to one **shared** bounding box so crossfades stay
  pixel-aligned. Mismatched crops jump on transition.
- **Geometry verification** — before changing on-screen sizing, composite the
  asset over ink at the app's exact stage dimensions and Read it, rather than
  guessing margins (how the egg/dome fit was sized).

## Generated UI textures (no FAL — pure PIL)

RN views cannot blur or draw conic gradients, so soft/edge effects are baked
into PNGs and tinted at runtime with `tintColor`:
- `aurora-ring.png` — conic violet→teal→ember ring (timeline/collection orbs).
- `soft-glow.png` — radial alpha falloff (egg/creature halos).
- `glass-dome.png` — crisp top-lit rim + faint fresnel body + specular crescent
  (the egg membrane).
- Egg crack frames — generated via the `/edit` endpoint, matted, shared-bbox cropped.

## Bundling & wiring a new creature

1. Cutout → `assets/images/katchimeras/cutouts/<name>.png`.
2. Add the key to `HomeVisualKey` in `types/home.ts`.
3. Add a `homeCreatureVisuals` entry in `constants/home-mvp.ts` (source +
   accentColor) pointing at the cutout.
4. Add an `encounterLiveCast` entry in `constants/encounter-cast.ts` (profileId,
   seedId, categoryLabel, visualKey, **voice** for M3 reflections).
5. If the character needs a new encounter category, add a seed to
   `data/katchimeras/encounter-seeds.json`, regenerate
   (`node scripts/generate-encounter-katchimeras.mjs`), and add the engine
   signal + probe group.
6. Run `node scripts/verify-encounter-engine.cjs`, `tsc`, `expo lint`.

Adding art = a JS/asset change (Metro reload). It does **not** need a native
rebuild — except the home-screen widget, which bundles images at build time
(`targets/widget/expo-target.config.js`), so new widget-visible art is a rebuild.
