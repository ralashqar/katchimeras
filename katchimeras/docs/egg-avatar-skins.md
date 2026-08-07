# Egg avatar skins

## Identity contract

The equipped egg skin is the player's character everywhere: profile, bottom navigation, and the forming egg on Today. Switching a skin must update all three immediately.

The v2 identity master is the approved cute egg reference: a softly rounded cream egg with two small feet and a clear, simple face. Art-direction v4 separates that identity into an interchangeable body and atomic face set while preserving one canonical canvas and feature layout.

Baristabbit remains the Katchimeras rendering reference: cozy premium 3D toy art, broad rounded forms, tactile painted materials, warm low-contrast cinematic light, and emotional friendliness. Avoid uncanny doll eyes, hollow pupils, realistic wet eyeballs, grime, photoreal shell texture, harsh contrast, and plastic shine.

## Production files

- `assets/images/katchimeras/egg-avatars/<skin>.png`: 2048 px archival alpha master.
- `assets/images/katchimeras/egg-avatars/<skin>.webp`: 1024 px app asset.
- `assets/images/katchimeras/egg-avatars/thumbnails/<skin>.webp`: 256 px picker/navigation asset.
- `assets/images/katchimeras/egg-avatars/effects/crack-*.png|webp`: reusable transparent hatch overlays shown above the equipped skin.
- `assets/images/katchimeras/egg-avatars/manifest.json`: approved references, models, art-direction version, hashes, and outputs.
- `assets/images/katchimeras/egg-avatars/bases/<skin>.png|webp`: runtime faceless bodies.
- `assets/images/katchimeras/egg-avatars/bases/thumbnails/<skin>.webp`: picker/navigation bodies.
- `assets/images/katchimeras/egg-avatars/faces/<face>.png|webp`: full-canvas atomic faces.
- `assets/images/katchimeras/egg-avatars/faces/thumbnails/<face>.webp`: picker/navigation faces.

Review candidates stay under ignored `.tmp` folders. Application code must only use production assets.

## Prompt architecture

Use three ordered references when generating a skin:

1. Approved Classic v2: strict character identity, silhouette, face, feet, pose, and camera.
2. Approved egg concept/reference: cute face proportions and intended personality.
3. Baristabbit: Katchimeras material, lighting, and premium toy-art style.

Prompts have four fixed blocks:

1. Identity lock: preserve the full face, feet, silhouette, pose, and framing.
2. Style lock: cozy premium cartoony 3D, rounded forms, tactile paint, warm soft light.
3. Face-layout lock: protect the canonical facial canvas and fixed feature anchors.
4. Theme edit: only the skin-specific palette, pattern, material, and one restrained accessory.
5. Negative/background lock: no anatomy changes, uncanny features, text, scenery, baked shadow, or non-uniform key background.

Change only the theme block when making a new skin.

## Canonical face-safe layout

All coordinates are normalized against the shared 2048 x 2048 production canvas and are defined in `constants/egg-avatar-face-layout.ts` and the asset manifest.

- Protected rounded rectangle: left `0.22`, top `0.34`, right `0.78`, bottom `0.66`.
- Eyes: `(0.385, 0.505)` and `(0.615, 0.505)`.
- Brows: `(0.39, 0.405)` and `(0.61, 0.405)`.
- Blush: `(0.31, 0.565)` and `(0.69, 0.565)`.
- Mouth: `(0.50, 0.57)`.

Inside the protected rounded rectangle, a body skin must remain smooth, low-detail, and visually continuous. No seam, groove, ridge, pattern, emblem, accessory, hard shadow edge, specular hotspot, or material transition may cross behind or touch a facial feature. Pumpkin lobes, robot panel seams, cracks, vines, moss, frost, stars, and similar motifs must route around it.

The runtime render order is `body -> atomic face -> cracks/effects`. The atomic face currently contains blush, eyes, brows, and mouth together. Every layer uses the same full canvas, so no per-body offsets are allowed.

Runtime presentation calibration is deliberately separate from the art canvas contract. `EggAvatarArtwork` applies one global face scale and optional per-body `presentation` values from `constants/egg-avatar-skins.ts`. Use these only to normalize the perceived core egg silhouette when a hat, sprout, stem, or other extension made the generated body appear smaller. The face remains centered on the canonical canvas and is never scaled with the accessory-heavy body. Keep overrides restrained, review them in Profile and Today, and prefer `scale` plus a small normalized `offsetY` over regenerating approved art.

Selection is stored as schema v2 (`equippedSkinId` plus `equippedFaceId`). A stored v1 body choice migrates automatically and receives `classic-smile`.

## FAL.ai production workflow

The script's `generate`, `matte`, and `approve` commands call the deployed generation and BiRefNet functions. Secrets remain server-side.

```powershell
python scripts/generate-egg-avatar-skins.py generate --skin moss --count 4
python scripts/generate-egg-avatar-skins.py matte --skin moss
# Review every candidate at full size and 40 px.
python scripts/generate-egg-avatar-skins.py approve --skin moss --candidate 1
npm run art:egg-avatars:validate
```

To create or refresh the separated layer set:

```powershell
python scripts/generate-egg-avatar-skins.py layered-generate --source-dir tmp/imagegen/egg-avatar-layers
python scripts/generate-egg-avatar-skins.py layered-matte --source-dir tmp/imagegen/egg-avatar-layers
# Inspect every neutral body and face at full size before promotion.
python scripts/generate-egg-avatar-skins.py import-layered-v1 --source-dir tmp/imagegen/egg-avatar-layers
npm run art:egg-avatars:validate
```

`layered-generate` uses `fal-ai/nano-banana-2/edit`. Solid body silhouettes are matted by `fal-ai/birefnet/v2`, General Use (Heavy), at `1024x1024` with foreground refinement. A face is a disconnected set of dark eyes and semi-transparent blush marks; it must pass a separate empty-background alpha gate. Component-aware chroma matting is the recorded fallback when BiRefNet treats the plate between disconnected features as foreground.

Faces are generated from scratch; never extract face pixels from a baked egg. The body image may be supplied only as a layout/personality reference. Require exactly seven isolated shapes, crisp antialiased vector-like boundaries, shading contained inside each shape, and bounded opaque blush rather than airbrushed blush. Never accept shell-colored rims, fuzzy edges, or a matte that retains key-color pixels.

Reviewed art created through the built-in reference workflow can be promoted with the same normalization and manifest contract:

```powershell
python scripts/generate-egg-avatar-skins.py import-approved-skin --skin robot --source tmp/imagegen/egg-avatar-new-skins/robot.png
```

For a curated local art-direction pass, prepare keyed-and-matted `<skin>.png` files plus `crack-1.png` and `crack-2.png`, then promote them consistently:

```powershell
python scripts/generate-egg-avatar-skins.py import-art-direction-v2 --source-dir .tmp/imagegen/egg-avatars-v2
```

## Approval gates

- The body has no eyebrow, eye, mouth, blush, tint, indentation, outline, or facial ghost.
- The recomposed character matches Classic's face, feet, body proportions, pose, and camera.
- Eyes have intact dark pupils and small catchlights; they are friendly, not glassy or looming.
- Brows, blush, and happy mouth remain readable and correctly positioned.
- The entire canonical face-safe rounded rectangle is free of theme seams, grooves, patterns, accessories, and hard lighting transitions.
- The theme does not obscure the face and uses at most one restrained accessory.
- There is no scenery, cast shadow, text, watermark, extra anatomy, or baked hatch state.
- Alpha corners are transparent, edges are clean, and the subject is centered.
- The skin reads clearly at 40–56 px as well as full size.
- The profile picker, bottom-bar avatar, and Today egg all update after selection.
- Validation and the asset audit pass; the manifest records v2 provenance and hashes.

## Today and hatch behavior

`EggShell` reads both selections from `EggAvatarProvider`. Hatch progress never swaps either one back to Classic. Reusable transparent golden crack effects crossfade above body and face, preserving the chosen identity through both growth stages.

## Adding a future skin

Add a permanent ID to the Python theme map, TypeScript ID list, and catalog. Generate from approved Classic v2 with the locked reference order and face-layout lock, review at full and navigation size, approve, validate, and run the asset audit. Visual revisions increment the catalog and manifest version rather than renaming the ID.
