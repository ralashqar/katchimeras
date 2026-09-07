# Egg Snap duel plates

Generated with the built-in image generator. These images contain scenery only. Eggs, shadows, targets and HUD are rendered by the app.

## Active artwork: template-based toy forest (v6)

The current artwork is `source/mossprout-duel-toy-v6.png`, created with built-in imagegen. Its generation prompt, material refinement prompt, original reference, candidate, comparison guide and review record are saved under `recipes/mossprout-duel-toy-v6/`. This variant uses the unchanged v3 camera/ground-contact template.

The reusable workflow is documented in `tooling/art-pipeline/EGG-SNAP-ENVIRONMENTS.md`. Use `egg-snap-environment.py prepare`, generate with the built-in image tool, then `import`, visually review, and `activate`. App-owned template JSON is shared by rendering and authoring; activating artwork never changes platform geometry.

## Previous artwork: detailed forest with lower camera (v3 restored)

The user selected the later detailed forest with flatter platforms and a lower camera angle. Runtime uses `source/mossprout-duel-v3.png` and its existing WebP variants, with measured platform contacts: rival (0.500, 0.306), player (0.500, 0.674), source 941 x 1672. Current UI and tray-relative framing are retained. Other art revisions below are historical alternatives, not active assets.

## Historical Mossprout hex style, built-in imagegen (v5)

Active source: `source/mossprout-duel-v5.png` (941 x 1672), with full/medium WebP variants. Generated with the built-in image generator, replacing the rejected FAL revision. Style references were `world/hex/mossprout_focused_v1_main_hex_tile_512.webp` and `world/hex/mossprout_focused_v1_ancient_tree_grove_hex_tile.webp`. V3 supplied camera/composition only.

Prompt direction: reproduce the hex tiles' clean sculpted toy forms, oversized cushion-shaped leaves, rounded wooden posts, cream paving, leaf-roof cottage and sparse large daisies. Use a handful of readable shapes with broad breathing spaces, very low detail and virtually no surface texture. Preserve the two empty platforms and open gameplay areas. No eggs, UI, writing, realistic bark, grain, dirt, intricate moss or dense small foliage. Full-bleed portrait environment, not a floating hex island.

Final edit prompt: preserve composition and large shapes; remove grain, speckling, mottling, scratches, bark lines and surface texture. Use clean smooth molded clay/vinyl, broad colours and gentle lighting gradients. Keep crisp rounded leaf and petal silhouettes, smooth olive ground and warm cream stones; add no objects or detail.

Measured contacts: rival (0.505, 0.300), player (0.500, 0.694). Runtime projection keeps the player grounded 42 points above the tray. Rebuild LODs with `prepare-egg-snap-stage.py`.

## Historical project toy style via FAL (v4, rejected)

Active source: `source/mossprout-duel-v4-nano.png` (1536 x 2752), with full/medium WebP runtime variants. Generated through the existing Supabase/FAL art pipeline using **fal-ai/nano-banana-2/edit**, not the built-in image generator. The v3 scene is the composition reference and `world/base/base_env2.png` is the material/shape style guide.

Direction: cozy toy diorama 3D, soft bevels, cushiony forms, low detail, very low texture detail. Preserve the camera, platforms, lantern, cottage and quiet gameplay areas; simplify surfaces into smooth matte clay/vinyl, pillowy foliage and chunky rounded trunks. No bark grooves, grain, cracks, realistic moss, characters or UI.

The full prompt and provider receipt are in `source/mossprout-duel-v4-nano.json`. Reproduce or resume with `python tooling/art-pipeline/scripts/generate-egg-snap-stage.py`; the script does not regenerate an existing output. Then rebuild runtime LODs with `prepare-egg-snap-stage.py`. Existing normalized ground contacts remain valid.

## Historical lower camera (v3)

Active source: `source/mossprout-duel-v3.png` (941 x 1672), with full/medium WebP variants. Generated with the built-in image generator from the user's second visual reference. V1 and V2 remain historical references.

Prompt: Create an empty cozy 3D toy forest plate using the reference's lower camera angle and shallow elliptical platform tops. Soft bevels, cushiony foliage, smooth low-texture materials, warm sunlight, a rounded cottage and lantern. Two empty platforms with clear central pathway and player-side target space. Remove all eggs, UI, writing, signs, bars, tiles, symbols and character shadows. Keep ground below for the runtime tray.

Measured contacts: rival (0.50, 0.306), player (0.50, 0.674). The projection is scaled and vertically aligned to keep the player's feet 42 points above the tray. Art and ground contacts use the same projection. Hero grades appear above the player without a panel. Health is a slim bar inside the tray with an accessible health label. Idle instruction panels are omitted; attack warnings appear during warning phases.

## Historical cozy toy diorama (v2)

The active Mossprout plate is `source/mossprout-duel-v2.png`, with `mossprout-duel-v2-full.webp` and `mossprout-duel-v2-medium.webp` runtime variants. Created with the built-in image generator from v1. The original neutral master and v1 remain as historical composition references; derive future toy environments from v2.

Measured v2 contacts: rival `(0.505, 0.341)`, player `(0.500, 0.645)`. Rival platform top spans approximately x29.5–71.5%, y30.1–38.0%; player top x13.5–86.5%, y55.2–73.6%. The rival is 45% wider on ordinary portrait screens, with height bounded by its HUD clearance. Compact phones reduce the foreground egg slightly to leave the attack warning clear. Match callouts sit beneath the player; compact perfect callouts use one line.

### V2 prompt set

Restyle the entire forest as a cozy 3D toy diorama: soft bevels, cushiony rounded volumes, smooth matte clay-like surfaces, very low texture detail. Use pillowy foliage clusters, simple rounded tree trunks, plump sculpted bushes and sparse toy flowers. Smooth warm cream clay platforms with thick rounded beveled rims; avoid realistic grain, cracks and busy foliage. Gentle warm golden light and a small rounded cottage. Enlarge and bring the opponent platform closer. Preserve empty standing surfaces, clear player-side target areas and open bottom ground; no eggs, characters, UI, labels or baked character shadows.

A composition correction enlarged and lowered the opponent platform and lowered the foreground platform. The selected final image is measured above; generated geometry differs from requested percentages. Rebuild v2 LODs with the pipeline command below.

## Historical v1 sources and derivation

- `source/two-platform-master-v1.png`: neutral clay composition master.
- `source/composition-guide.svg`: vector overlay on the master identifying ground contacts, platform surfaces and quiet gameplay areas.
- `source/mossprout-duel-v1.png`: final cinematic forest derivative, preserving the master's two platforms and camera.
- `mossprout-duel-v1-full.webp` and `mossprout-duel-v1-medium.webp`: runtime LODs (852 and 640 pixels wide). The source aspect ratio is 852:1846.

Run `python tooling/art-pipeline/scripts/prepare-egg-snap-stage.py` from the repository root to rebuild runtime variants and the seven opaque-body contact calibrations. It processes existing artwork only and makes no generation requests.

Historical v1 platform anchors: rival `(0.507, 0.254)`, player `(0.503, 0.655)`. Use the canonical source dimensions and shared cover projection for every runtime resolution. Do not shift eggs independently to compensate for a crop.

## Prompt set

### Neutral master

Create a single very tall 9:19.5 portrait production game environment composition master. A neutral, beautifully lit clay/stone grey stylized 3D woodland diorama with TWO EMPTY circular raised stone platforms, joined by a winding path. Camera looks gently downward into a deep corridor. Small distant platform centred at x50%, standing centre near y27%, width36%. Large foreground platform centred x50%, standing centre y65%, width88%, shallow ellipse top extending from y58% to y72%, low stone rim ending near y76%. Ground continues below the foreground platform through the bottom quarter. Simple dark open space on the left and right between y44% and y59% for live puzzle targets. Sculpted vegetation and trees frame the outside edges and top, with atmospheric light near the upper centre. No writing, characters, eggs, statues, symbols, UI, grids or markers. Neutral monochrome warm grey materials so other biomes can preserve the composition.

The first candidate put both platforms too high. A targeted image edit moved the small platform from approximately y19.5% to y25–27%, and the foreground platform from approximately y51% to y65%, shortening the empty bottom area. The corrected output is the saved master; actual geometry takes precedence over requested prompt percentages.

### Mossprout material and lighting derivative

Edit the supplied neutral master into a gorgeous final cinematic forest game background. Preserve exact image proportions, camera, positions and shapes of BOTH EMPTY platforms and the central path. Do not enlarge, move or obscure platforms. Render high-quality stylized 3D cinematic storybook realism: rich mossy green foliage, warm amber sunlight through the canopy, misty atmospheric distance, weathered golden-grey stone pavers, small purple and blue wildflowers at the outer edges. A small woodland cottage with a warm amber round window at the far right edge, never intruding into the centre. Keep the midway flanks dark and low-detail for live targets. Light the near platform warmly and keep both flat top surfaces visible. Crisp stage stonework, softer distant forest, dark leafy framing and subdued bottom ground. NO EGGS, CHARACTERS, STATUES, piece outlines, text, symbols, HUD, UI or prepainted character shadows. This is a material-and-lighting derivative, not a new composition.

## Future biomes

Supply the neutral master as the edit target; retain its proportions, camera and platform surfaces. Change surrounding vegetation, materials, architecture and lighting. Inspect the output against the guide and remeasure anchors if generation drifts. Add an app-owned stage definition and art references only after the crop/grounding tests and a visual pass succeed. Cheerlet deliberately retains its previous stage until its own derivative is authored.

## Calibration and QA

Battle pause → Stage guides toggles the development overlay. Pink points are contacts, gold rectangles platform tops, cyan rectangles opaque egg bounds, purple the authored play region and green the live drop field. Growth pivots at the contact; the wisp stays inside the central corridor. Compact phones use a side rival-health panel and put player health below the tray. Tablets use a centred portrait stage with ambient edge fill. World, collection and result scenes retain their previous artwork.
