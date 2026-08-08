# Egg avatar skins

## Identity contract

The equipped egg skin is the player's character everywhere: profile, bottom navigation, and the forming egg on Today. Switching a skin must update all three immediately.

The v2 identity master is the approved cute egg reference: a softly rounded cream egg with two small feet and a clear, simple face. Art-direction v4 separates that identity into an interchangeable body and atomic face set while preserving one canonical canvas and feature layout.

Baristabbit remains the Katchimeras rendering reference: cozy premium 3D toy art, broad rounded forms, smooth softly painted materials, clean transitions, restrained highlights, warm low-contrast cinematic light, and emotional friendliness. Avoid uncanny doll eyes, hollow pupils, realistic wet eyeballs, grime, photoreal texture, material microdetail, harsh contrast, and plastic shine.

## Production files

Catalog metadata and shipping availability are defined in `data/egg-avatar/*.json`. See `docs/egg-avatar-catalog.md` for the source-of-truth contract, planned-to-ready promotion flow, and static Expo asset-registry generation.

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

The runtime render order is `body -> atomic face -> hat -> held accessory -> cracks/effects`. The atomic face currently contains blush, eyes, brows, and mouth together. Every art asset uses the same full canvas. A hat inherits the selected body's presentation transform and may add a small recorded hat-specific scale/offset so its front contact edge stays above the face on every body.

Runtime presentation calibration is deliberately separate from the art canvas contract. `EggAvatarArtwork` applies one global face scale and optional per-body `presentation` values from `data/egg-avatar/bodies.json`. Use these only to normalize the perceived core egg silhouette when a hat, sprout, stem, or other extension made the generated body appear smaller. The face remains centered on the canonical canvas and is never scaled with the accessory-heavy body. Keep overrides restrained, review them in Profile and Today, and prefer `scale` plus a small normalized `offsetY` over regenerating approved art.

Selection is stored as schema v3 (`equippedSkinId`, `equippedFaceId`, nullable `equippedHatId`, and nullable `equippedHeldAccessoryId`). Stored v1/v2 choices migrate automatically; legacy Moss, Barista, and Pumpkin selections receive their formerly integrated top accessory as a separate hat.

## FAL.ai production workflow

The script's `generate`, `matte`, and `approve` commands call the deployed generation and BiRefNet functions. Secrets remain server-side.

New catalog body concepts use the dedicated `body-draft` path. It sends the approved faceless Classic body as the exact edit target to FAL `openai/gpt-image-2/edit` with `quality: low`, plus Baristabbit for character art style and the runtime Today background for lighting and palette only. It generates exactly one candidate per requested body, removes the pure-black background with BiRefNet Heavy, then promotes successful output by default: production PNG/WebP/thumbnail assets, manifest provenance, body accent, catalog `ready` state, and the generated Expo registry are updated together. Use `--review-only` only when a draft must deliberately stay out of the app.

```powershell
# First four planned bodies: Honeycomb, Strawberry Cream, Blueberry Swirl, Matcha Marble
npm run art:egg-avatar-bodies -- starter-batch

# Next four ungenerated costume bodies
npm run art:egg-avatar-bodies -- costume-batch

# Watermelon plus the next three ungenerated costume bodies
npm run art:egg-avatar-bodies -- mixed-batch

# One body, or repeat only its background removal
npm run art:egg-avatar-bodies -- honeycomb
npm run art:egg-avatar-bodies -- honeycomb matte

# Promote files that were previously generated without another paid render
npm run art:egg-avatar-bodies -- honeycomb promote

# Explicit opt-out from the default promotion behavior
npm run art:egg-avatar-bodies -- honeycomb render --review-only
```

Review the raw GPT Image result and BiRefNet output together in the app and in the recorded `.tmp` source folder. Replace the body by rerunning its explicit ID even after it is `ready`; replacement promotion increments its catalog and manifest version. Regenerate when it has a face remnant, changed camera/canvas registration, crown ornament, central detail crossing the face-safe region, missing feet, hollow body region, scenery, pedestal, or style drift. Costume collars, scarves, lapels, trim, straps, belts, buttons, jewels, seams, and panel boundaries must remain below normalized `y = 0.68` across the central `x = 0.22–0.78` face span. Do not manually erase or repair generated pixels. Promotion uses only the established solid-body enclosed-hole flood-fill normalization; the BiRefNet exterior edge remains authoritative.

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

Accessory-ready legacy bodies and new wearable/held layers use the same production FAL path. Base eggs are edited from their approved original reference, matted by BiRefNet Heavy, and may use enclosed-hole flood fill because the egg body must be solid. Accessory alpha is preserved exactly so intentional openings such as prop handles remain transparent.

```powershell
python scripts/generate-egg-avatar-skins.py accessory-base-generate --source-dir .tmp/egg-avatar-accessory-bases-v1 --skin moss
python scripts/generate-egg-avatar-skins.py accessory-base-matte --source-dir .tmp/egg-avatar-accessory-bases-v1 --skin moss
python scripts/generate-egg-avatar-skins.py accessory-base-approve --source-dir .tmp/egg-avatar-accessory-bases-v1 --skin moss

python scripts/generate-egg-avatar-skins.py accessory-generate --source-dir .tmp/egg-avatar-accessories-fal-v1 --id warm-lantern
python scripts/generate-egg-avatar-skins.py accessory-matte --source-dir .tmp/egg-avatar-accessories-fal-v1 --id warm-lantern
python scripts/generate-egg-avatar-skins.py accessory-approve --source-dir .tmp/egg-avatar-accessories-fal-v1 --id warm-lantern
```

Hats use a geometry-then-style workflow with exactly one result at each stage. First pass the canonical Classic egg to FAL `openai/gpt-image-2/edit` at `quality: low` and request only the visible front hat layer. Then pass that exact hat as the edit target alongside Baristabbit and the runtime `today_bg.webp`, preserving geometry while mapping it to their simplified cozy premium 3D toy materials, palette, and lighting. The output remains on pure black, then BiRefNet Heavy supplies the production alpha. Neither stage may add the egg body, underside, interior, rear brim, back layer, or hidden surface.

See `docs/egg-avatar-hat-pipeline.md` for the authoritative `katchimeras-cozy-toy-v1` style contract, reference priority, repeatable two-phase pipeline, exact review gates, file layout, and new-hat checklist.

```powershell
npm run art:egg-avatar-hats -- cozy-beanie
# Inspect geometry-fal.png, front-fal.png, front-birefnet.png, and the review sheet.
npm run art:egg-avatar-hats -- cozy-beanie promote
npm run art:egg-avatar-hats:preview
```

Approval requires a closed visible-front silhouette whose lower edge overlaps the egg crown without touching the brows. The approved source remains a full-canvas layer; production promotion never crops, recenters, flood-fills, or hand-erases hat pixels. Review the compatibility sheet across every body before shipping.

`layered-generate` uses `fal-ai/nano-banana-2/edit`. Solid body silhouettes are matted by `fal-ai/birefnet/v2`, General Use (Heavy), at `1024x1024` with foreground refinement. A face is a disconnected set of dark eyes and semi-transparent blush marks; it must pass a separate empty-background alpha gate. Component-aware chroma matting is the recorded fallback when BiRefNet treats the plate between disconnected features as foreground.

Faces are generated from scratch; never extract face pixels from a baked egg. The body image may be supplied only as a layout/personality reference. Require exactly seven isolated shapes, crisp antialiased vector-like boundaries, shading contained inside each shape, and bounded opaque blush rather than airbrushed blush. Never accept shell-colored rims, fuzzy edges, or a matte that retains key-color pixels.

The v1 expression test set is `classic-smile`, `happy-squint`, `sleepy`, `curious`, and `determined`. Every expression shares the full-canvas contract and is normalized into the same face-layer bounds; only the feature silhouettes change. After reviewing keyed sources, create component-aware chroma mattes with pure `#00FF00`, despill, a soft antialiased matte, and a one- or two-pixel edge contraction selected by the green-spill QA gate, then promote the complete reviewed set:

```powershell
python scripts/generate-egg-avatar-skins.py import-face-set --source-dir tmp/imagegen/egg-avatar-faces-v1
npm run art:egg-avatars:validate
```

The source directory must contain `<face-id>-matted.png` for each non-default variation. Promotion writes the 2048 px PNG, 1024 px WebP, 256 px picker thumbnail, hashes, expression direction, and matting provenance without changing any approved body asset.

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

Add a permanent planned ID and full visual brief to `data/egg-avatar/bodies.json`; do not add placeholder art. Generate from approved Classic v2 with the locked reference order and face-layout lock, review at full and navigation size, approve, then promote the entry to `ready` with all three asset references. Run `npm run avatar:catalog:generate`, validate, and run the asset audit. Visual revisions increment the catalog and manifest version rather than renaming the ID.
