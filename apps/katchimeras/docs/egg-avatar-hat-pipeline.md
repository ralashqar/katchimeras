# Egg Avatar Hat Pipeline

This is the canonical process for generating egg-avatar hats. It produces a 2D layer that renders in front of the egg body. It does not produce a complete freestanding hat model.

## Non-negotiable layer contract

- The canonical Classic egg defines initial geometry, scale, crown shape, and canvas registration for a new hat.
- The geometry result then becomes the edit target for a dedicated style-map pass using Baristabbit and the exact Today runtime background as style references.
- Generate only the part of the hat visibly facing the camera when worn by the egg.
- The lower front edge must overlap the egg crown enough to preserve the rounded head silhouette.
- Never include the egg, face, feet, underside, hollow interior, rear brim, rear wall, back layer, hidden surface, platform, hand, or cast shadow.
- Generate one image per hat. Do not create candidate grids or silently select among variants.
- Never manually erase, flood-fill, crop, recenter, or reconstruct hat pixels.
- If the generated geometry is wrong, reject it and generate one replacement with one targeted prompt correction.
- BiRefNet is the only background-removal stage. Do not add SAM or another segmentation/extraction model.

## Fixed production configuration

| Setting | Value |
| --- | --- |
| Generator | FAL `openai/gpt-image-2/edit` |
| Quality | `low` |
| Image size | `square_hd` |
| Number of images | `1` |
| Geometry reference | `assets/images/katchimeras/egg-avatars/classic.png` on black |
| Style reference | `assets/images/katchimeras/cutouts/baristabbit.png` |
| Runtime light/palette reference | `assets/images/katchimeras/world/today/today_bg.webp` |
| Generated background | Uniform `#000000` |
| Background removal | FAL `fal-ai/birefnet/v2`, General Use (Heavy) |
| Review workspace | `.tmp/egg-avatar-hats-v4/<hat-id>/` |
| Production output | `assets/images/katchimeras/egg-avatars/hats/` |

The implementation and authoritative prompts live in `scripts/generate-egg-avatar-skins.py` under `hat_front_prompt` and `hat_style_prompt`. Do not maintain copies in another script.

## Art-style contract

The versioned style contract is `katchimeras-cozy-toy-v1`. The three inputs have deliberately different authority:

1. **Image 1 — current hat:** authoritative for silhouette, design, color identity, visible-front construction, crown contact edge, perspective, scale, position, and canvas registration.
2. **Image 2 — Baristabbit:** authoritative for the Katchimeras character-rendering language: broad rounded forms, smooth softly painted materials, clean transitions, restrained highlights, and friendly mobile-game readability.
3. **Image 3 — runtime `today_bg.webp`:** authoritative only for warm daylight, low-contrast lighting, gentle saturation, and the simplified toy-diorama finish.

Reference priority is geometry from Image 1, character-art treatment from Image 2, then lighting and palette from Image 3. Baristabbit must not redesign the hat. The Today background must never contribute scenery, objects, a platform, or new geometry.

The contract intentionally rejects realistic material simulation. Do not request or approve individual fibers, yarn strands, fuzz, leather grain, embossing, pores, scratches, tiny stitching, noisy bump maps, photographic texture, or dense surface variation. A knitted or organic object is communicated with its broad silhouette and a few large form cues, not literal microtexture.

Promotion verifies that generation metadata contains the exact geometry edit target plus both locked style references. Asset validation also requires the current pipeline and style-contract versions in the production manifest. Changing a reference path, its role, or the art-direction rules requires a new style-contract version and a full compatibility review.

## Normal workflow

Generate and matte one hat without touching production:

```powershell
npm run art:egg-avatar-hats -- cozy-beanie
```

For a new hat this performs exactly three remote operations:

1. GPT Image 2 creates the direct visible-front geometry from the egg reference.
2. GPT Image 2 maps that exact layer to the Baristabbit and Today-environment art style.
3. BiRefNet Heavy removes the black background.

It then creates `.tmp/egg-avatar-hats-v4/review-sheet-cozy-beanie.png`, showing the proposed layer on every egg body in the Today environment. The command intentionally stops before promotion.

To keep existing approved geometry and redo only its art style, use the `restyle` phase. This performs one GPT Image 2 style edit plus BiRefNet:

```powershell
npm run art:egg-avatar-hats -- cozy-beanie restyle
```

After visually approving the raw image, matte, and review sheet, promote the existing reviewed files:

```powershell
npm run art:egg-avatar-hats -- cozy-beanie promote
```

The `promote` phase never generates a replacement. It promotes the files already reviewed, writes PNG/WebP/thumbnail outputs, updates manifest provenance, and refreshes the complete production compatibility sheet.

To restyle the entire existing hat catalogue without changing its geometry:

```powershell
npm run art:egg-avatar-hats -- all restyle
# Review .tmp/egg-avatar-hats-v4/review-sheet-all.png.
npm run art:egg-avatar-hats -- all promote
```

Regenerate a review sheet from existing unpromoted files without another image-generation call:

```powershell
npm run art:egg-avatar-hats:review -- all
```

Do not use `all` when changing only one hat; it would spend time and generation cost replacing every source.

## Required visual review

Inspect these files at full size:

- `.tmp/egg-avatar-hats-v4/<hat-id>/front-fal.png`
- `.tmp/egg-avatar-hats-v4/<hat-id>/front-birefnet.png`
- `.tmp/egg-avatar-hats-v4/review-sheet-<hat-id>.png`

Approve only when all of the following are true:

- Only the hat is visible in the source and matte.
- No egg-colored pixels, facial features, feet, pedestal, or background remain.
- No underside, hollow opening, rear rim, back layer, or invented hidden surface is visible.
- The bottom edge reads as the front contact edge crossing over the egg crown.
- The hat preserves the egg's rounded head rather than flattening it.
- Brows, eyes, and face remain completely unobstructed on all ten bodies.
- Materials and lighting read as the same simple, cozy, premium 3D toy family as the Classic egg.
- Surfaces use broad smooth forms rather than realistic fibers, yarn strands, leather grain, embossing, pores, scratches, stitching, or noisy microtexture.
- BiRefNet preserves intended narrow shapes such as leaf tips, brim corners, and crown gaps without halos.

If a result fails, rerun the normal command for that one ID after making one focused wording change. Never repair failed generated pixels manually.

## Adding a new hat

Before generation:

1. Add the new ID to `EGG_AVATAR_HAT_IDS` in `types/egg-avatar.ts`.
2. Add its concise visual description to `ACCESSORY_SPECS` in `scripts/generate-egg-avatar-skins.py` with `slot: "hat"`.
3. Add an initial `HAT_PRESENTATIONS` entry. Start near `scale: 1`, `offsetX: 0`, `offsetY: 0`; calibrate only after viewing the review sheet.
4. Add the catalogue entry and static asset paths to `constants/egg-avatar-hats.ts`.
5. Run the one-hat pipeline and review it across every body.

Presentation values are non-destructive runtime registration, not image curing. A hat inherits the selected body's presentation and then applies its own small scale/offset. The transformed alpha bounds must remain inside the canonical hat area: normalized `x 0.16–0.84`, `y 0.01–0.34`.

## Files and provenance

Each review directory contains:

- `front-fal.png`: untouched GPT Image 2 result on black.
- `front-generation.json`: style-map model, quality, style-contract version, prompt, all three reference roles, record ID, and source URL.
- `geometry-fal.png` and `geometry-generation.json`: initial front-layer geometry for newly generated hats.
- `front-birefnet.png`: BiRefNet result.
- `front-matting.json`: matting model and service metadata.

Promotion creates:

- `hats/<hat-id>.png`: 2048px production master.
- `hats/<hat-id>.webp`: 1024px app asset.
- `hats/thumbnails/<hat-id>.webp`: 256px picker asset.
- Updated entries in `assets/images/katchimeras/egg-avatars/manifest.json`.

The production source remains a full square canvas. Promotion does not crop or recenter it.

## Validation

Run after promotion:

```powershell
npm run art:egg-avatars:validate
npm run test:egg-avatars
npm run typecheck
npm run lint
npm run art:egg-avatar-hats:preview
```

The tests enforce GPT Image 2, `quality: low`, the versioned style contract, exact Baristabbit and Today reference paths and roles, the direct visible-front prompt, BiRefNet provenance, runtime presentation metadata, and the absence of the obsolete fit/extract/SAM pipeline.

## Scope

This document covers hats only. Held accessories use the separate `accessory-generate`, `accessory-matte`, and `accessory-approve` commands because they do not share the crown-overlap geometry contract.
