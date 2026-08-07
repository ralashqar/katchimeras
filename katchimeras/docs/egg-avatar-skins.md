# Egg avatar skins

## Identity contract

The equipped egg skin is the player's character everywhere: profile, bottom navigation, and the forming egg on Today. Switching a skin must update all three immediately.

The v2 identity master is the approved cute egg reference: a softly rounded cream egg with two small feet, aqua and tan speckles, friendly black-and-brown cartoon eyes, tiny curved brows, rosy cheeks, and a small happy mouth. Every skin preserves that face, expression, pose, camera, and body proportions.

Baristabbit remains the Katchimeras rendering reference: cozy premium 3D toy art, broad rounded forms, tactile painted materials, warm low-contrast cinematic light, and emotional friendliness. Avoid uncanny doll eyes, hollow pupils, realistic wet eyeballs, grime, photoreal shell texture, harsh contrast, and plastic shine.

## Production files

- `assets/images/katchimeras/egg-avatars/<skin>.png`: 2048 px archival alpha master.
- `assets/images/katchimeras/egg-avatars/<skin>.webp`: 1024 px app asset.
- `assets/images/katchimeras/egg-avatars/thumbnails/<skin>.webp`: 256 px picker/navigation asset.
- `assets/images/katchimeras/egg-avatars/effects/crack-*.png|webp`: reusable transparent hatch overlays shown above the equipped skin.
- `assets/images/katchimeras/egg-avatars/manifest.json`: approved references, models, art-direction version, hashes, and outputs.

Review candidates stay under ignored `.tmp` folders. Application code must only use production assets.

## Prompt architecture

Use three ordered references when generating a skin:

1. Approved Classic v2: strict character identity, silhouette, face, feet, pose, and camera.
2. Approved egg concept/reference: cute face proportions and intended personality.
3. Baristabbit: Katchimeras material, lighting, and premium toy-art style.

Prompts have four fixed blocks:

1. Identity lock: preserve the full face, feet, silhouette, pose, and framing.
2. Style lock: cozy premium cartoony 3D, rounded forms, tactile paint, warm soft light.
3. Theme edit: only the skin-specific palette, pattern, material, and one restrained accessory.
4. Negative/background lock: no anatomy changes, uncanny features, text, scenery, baked shadow, or non-uniform key background.

Change only the theme block when making a new skin.

## FAL.ai production workflow

The script's `generate`, `matte`, and `approve` commands call the deployed generation and BiRefNet functions. Secrets remain server-side.

```powershell
python scripts/generate-egg-avatar-skins.py generate --skin moss --count 4
python scripts/generate-egg-avatar-skins.py matte --skin moss
# Review every candidate at full size and 40 px.
python scripts/generate-egg-avatar-skins.py approve --skin moss --candidate 1
npm run art:egg-avatars:validate
```

For a curated local art-direction pass, prepare keyed-and-matted `<skin>.png` files plus `crack-1.png` and `crack-2.png`, then promote them consistently:

```powershell
python scripts/generate-egg-avatar-skins.py import-art-direction-v2 --source-dir .tmp/imagegen/egg-avatars-v2
```

## Approval gates

- The character matches Classic's face, feet, body proportions, pose, and camera.
- Eyes have intact dark pupils and small catchlights; they are friendly, not glassy or looming.
- Brows, blush, and happy mouth remain readable and correctly positioned.
- The theme does not obscure the face and uses at most one restrained accessory.
- There is no scenery, cast shadow, text, watermark, extra anatomy, or baked hatch state.
- Alpha corners are transparent, edges are clean, and the subject is centered.
- The skin reads clearly at 40–56 px as well as full size.
- The profile picker, bottom-bar avatar, and Today egg all update after selection.
- Validation and the asset audit pass; the manifest records v2 provenance and hashes.

## Today and hatch behavior

`EggShell` reads the equipped skin from `EggAvatarProvider`. Hatch progress never swaps it back to Classic. Instead, reusable transparent golden crack effects crossfade above the selected asset, preserving the chosen identity through both growth stages.

## Adding a future skin

Add a permanent ID to the Python theme map, TypeScript ID list, and catalog. Generate from approved Classic v2 with the locked reference order, review at full and navigation size, approve, validate, and run the asset audit. Visual revisions increment the catalog and manifest version rather than renaming the ID.
