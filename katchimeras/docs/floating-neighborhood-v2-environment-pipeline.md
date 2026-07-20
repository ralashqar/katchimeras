# Floating Neighbourhood V2 environment pipeline

This is the canonical, fresh-context runbook for creating resident environments,
home-archetype islands, and zodiac sanctuaries. Follow it even when earlier conversation history is
available. The longer visual history and approved examples live in
`design/floating-neighborhood-v2/README.md`.

## Non-negotiable inputs

Generation is an image edit through FAL `fal-ai/nano-banana-2/edit`, selected by
`--model nano` in the repository generator.

- Resident environment: use only
  `design/floating-neighborhood-v2/floating-neutral-source.png` as image input.
- Zodiac sanctuary: use only
  `design/floating-neighborhood-v2/floating-neutral-source.png` as image input.
- Home archetype: use only
  `design/floating-neighborhood-v2/floating-home-source.png` as image input.
- Do not pass a Katchimera, egg, old hex tile, Photo 1, Photo 2, or an existing
  resident habitat as another generation image. Identity is written in the
  theme brief. The canonical bases already carry the approved geometry and art
  grammar.
- Request 2048px generation and require a square source of at least 1024px on a
  perfectly flat pure-black `#000000` background. FAL may return a nearby native
  square size; promotion normalizes the preserved canvas to 2048 before final
  LOD packaging. Never use magenta/purple chroma.

The generator chooses the correct canonical base from `--kind`, rejects a
creature reference for v2, and records the complete prompt plus base SHA-256.

## Visual contract

Keep the exact square canvas, flat-top face, orientation, camera, scale, deep
tapered underside, front stairs, silhouette, and transparent padding of the
canonical base. Use low-frequency Katchimeras art: a few large rounded forms,
broad bevels, smooth materials, clear silhouettes, and restrained soft light.
Every important feature must read at 256px.

For resident environments:

- Retheme the habitat props, continuous perimeter, and large cliff blocks as a
  coordinated system.
- Retheme the full top-face floor to suit the resident: sand, carpet, broad
  timber, large stone slabs, smooth moss, and similar materials are valid.
- Build a rich U-shaped frame across the rear and upper portions of both sides.
- Keep the entire bottom/front half and stairs quiet, open, continuous, and
  free of props for the separately rendered live creature. “Open” constrains
  occupancy, not floor material.
- Do not add a center circle, raised or sunken plaza, platform, distinct rug,
  path, ring, or indentation. A single uniform themed floor is not a platform.

For home archetypes:

- Preserve the existing circular plaza, centered empty nest, and clear route
  from the stairs. These are exclusive to home art.
- Retheme the cottage, perimeter, cliff blocks, planting, and rear/upper-side
  props while keeping the nest unobstructed for the separately rendered egg.

For zodiac sanctuaries:

- Retheme the full floor, perimeter, cliff blocks, rear landmark, and upper-side
  props as a coordinated sign-specific environment.
- Express the sign through architecture, material, palette, and a few abstract
  celestial forms. Do not bake a familiar, animal, person, zodiac glyph, or
  constellation diagram into the bitmap.
- Keep the lower half open for the separately rendered element familiar, using
  the same no-platform rule as resident environments.

For both kinds, exclude baked creatures/eggs, bridges, bridge stubs, clouds,
text, watermarks, external shadows, tiny flowers, grass blades, pebbles, cracks,
specks, filigree, and dense prop clutter.

## 1. Write the brief

Copy `design/floating-neighborhood-v2/new-environment-brief.json` to
`design/floating-neighborhood-v2/briefs/<key>.json` for residents/homes or
`design/floating-neighborhood-v2/briefs/zodiac/<sign>.json` for zodiac art,
check it in, and complete
every field, including `floor`. Prefer one iconic landmark, two or three
signature props, a clear perimeter treatment, one broad low-frequency floor,
and two or three cliff colors/materials. The brief is the portable creative
input for another context window or agent.

Pass that file through `--brief`; the generator deterministically constructs
the theme paragraph and records both the brief and its SHA-256. `--theme` remains
available for deliberate one-off experiments, but the checked-in brief is the
reproducible production path. Do not repeat geometry rules in creative fields;
the generator supplies those invariant sections centrally.

## 2. Resolve and review the exact prompt

Resident example:

```powershell
python scripts/generate-katchimera-hex-tile.py --visual-key example --kind floating-v2 --brief design/floating-neighborhood-v2/briefs/example.json --dry-run
```

Home example:

```powershell
python scripts/generate-katchimera-hex-tile.py --visual-key explorer --kind floating-home-v2 --brief design/floating-neighborhood-v2/briefs/explorer.json --dry-run
```

Zodiac example:

```powershell
python scripts/generate-katchimera-hex-tile.py --visual-key aries --kind zodiac --brief design/floating-neighborhood-v2/briefs/zodiac/aries.json --dry-run
```

Review `.tmp/katchimera-hex-tiles/<key>/candidate-1-prompt.txt` and
`candidates.json`. Confirm the manifest says the expected kind, canonical base,
base hash, FAL selector `nano`, requested 2048 size, black background, and correct open
stage/plaza rule. Keep this manifest with the candidates; it is the generation
provenance record.

## 3. Generate and select

Remove `--dry-run` from the reviewed command. Use `--count 2` or more when
exploring, then judge each candidate at full size and at approximately 256px.
Reject a candidate if geometry drifted, the island is clipped, the background
is not pure black, the lower half is occupied, the silhouette is noisy, or a
resident gained a central platform. Do not repair a composition mistake with a
deterministic paint-over: regenerate from the canonical base and revised brief.

## 4. Matte and package the approved candidate

Dry-run the promotion first:

```powershell
python scripts/promote-floating-neighborhood-v2-tile.py --key example --kind resident --candidate .tmp/katchimera-hex-tiles/example/candidate-1.png --dry-run
```

Use `--kind zodiac` for a zodiac candidate. Zodiac canonical files use
`floating-zodiac-<sign>-source.png` / `-alpha.png`, while production LODs use
`floating_neighborhood_v2_zodiac_<sign>_hex_tile...`.

Then run it without `--dry-run`. Add `--replace` only for an intentional redo of
an existing canonical tile. The command:

1. validates a square source of at least 1024px with black corners;
2. saves the canonical `*-source.png`;
3. calls the shared BiRefNet matte and restores the enclosed source-backed interior;
4. saves the canonical `*-alpha.png`;
5. packages 1024/512/256 WebPs; and
6. rebuilds `constants/kingdom-hex-tile-bounds.gen.ts`.

Canonical source and alpha PNGs remain lossless and are never derived from a
runtime WebP. Runtime packaging uses WebP quality 95 for the 1024 and 512 LODs,
quality 90 for the off-screen 256 LOD, and derives each resolution directly
from the canonical alpha PNG using premultiplied-alpha resizing.

The shared matte request is fixed to this known-good FAL payload:

```json
{
  "model": "General Use (Heavy)",
  "image_url": "<uploaded source URL>",
  "output_format": "png",
  "refine_foreground": true,
  "operating_resolution": "1024x1024"
}
```

Repository code names this selection `BiRefNet_lite`; the deployed edge
function translates it to FAL's accepted `General Use (Heavy)` transport value.
Do not send the enum directly to FAL HTTP.

BiRefNet can remove large grass floors, dark contact shadows, doorways, and
ambient-occlusion seams. The post-matte repair first flood-fills only neutral
near-black pixels connected to the source canvas boundary, which distinguishes
the true backdrop from dark pixels enclosed by the island. It then erodes that
foreground by three pixels and restores every non-opaque pixel in the safe
interior from the source at alpha `255`. BiRefNet remains authoritative in the
protected exterior edge band. The local matte cache is keyed by the source
SHA-256 and must be invalidated whenever source pixels change.

After interior restoration, the shared pipeline automatically performs the
approved mild edge treatment: inward colour padding for partial-alpha pixels
and a soft one-pixel contraction with a `0.45px` transition. It deliberately
does not flood through connected dark pixels or travel deeper into the art.
Canvas and LOD resizing uses premultiplied alpha so transparent RGB cannot
produce a dark filtering fringe.

## 5. Integrate the reviewed asset

Promotion intentionally stops before runtime mapping. In `utils/world-visuals.ts`:

- add static 1024 `require` export and 512/256 LOD requires;
- create a `KingdomHexTileSpec` using the generated alpha bounds;
- add residents to `FLOATING_NEIGHBORHOOD_V2_RESIDENT_TILES`, or homes to
  `FLOATING_NEIGHBORHOOD_V2_HOME_TILES` using the persisted archetype ID; and
- add zodiac signs to `FLOATING_NEIGHBORHOOD_V2_ZODIAC_TILES` using the
  persisted `ZodiacSignId`; and
- retain the neutral fallback for unsupported residents.

Static `require` calls are required by React Native bundling; do not construct
asset paths dynamically. Update `scripts/render-floating-neighborhood-v2-qa.py`
so the new art is visible beside existing islands with the live creature/egg at
production scale, then render QA:

```powershell
python scripts/render-floating-neighborhood-v2-qa.py
```

Inspect the 1024 alpha and all LODs against a dark background. Check fringe
color, internal alpha holes, complete silhouette, face alignment, readable
neighbour gaps, front-stage clearance, sprite anchor, clipping, and painter
order.

## 6. Validate

```powershell
npm run assets:audit:write
npm run check
git diff --check
```

`npm run verify` includes guards for the canonical bases, black-background
prompt contract, prompt provenance, promotion script, and exact BiRefNet model
mapping.

## Fresh-agent kickoff

When handing this work to a new context window or AI agent, provide the
completed brief and tell it to read these in order:

1. this runbook;
2. `design/floating-neighborhood-v2/README.md` for approved visual examples;
3. `scripts/generate-katchimera-hex-tile.py` for the centralized prompt;
4. the appropriate canonical source image at full resolution;
5. `utils/world-visuals.ts` for runtime registration.

The handoff must name the key, kind, completed brief path, whether it is a new
asset or redo, and the required QA composition. It must not rely on chat history
for prompts, references, matting settings, or filenames.
