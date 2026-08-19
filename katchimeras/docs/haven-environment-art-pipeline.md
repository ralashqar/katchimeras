# Haven environment art pipeline

This is the reusable production path for a Katchimera's five linear Haven environment states. Mossprout and Steppling are the initial references. The validated production batches currently cover Feastle, Bedrotte, Pagelet, Gatherglow, Tasklet, and Shellio.

The pipeline generates five separate square images, removes their chroma backgrounds, reviews them as a complete set, and promotes them atomically to the canonical PNG and runtime WebP assets. A grid or contact sheet may be useful for review, but it is never cropped into production art.

Runtime Stage `0` through Stage `4` correspond to player-facing environment Level `1` through Level `5`.

## Why the sequence is endpoint-first

Generate the most different states first, then derive each midpoint from the two images around it:

```text
Stage 0 endpoint ───────────── Stage 4 endpoint
        └──────── Stage 2 ────────┘
             └── Stage 1
                       Stage 3 ───┘
```

The required generation order is `0, 4, 2, 1, 3`:

- Stage 0 and Stage 4 are generated independently from the neutral island and style reference art.
- Stage 2 is generated between the completed Stage 0 and Stage 4 images.
- Stage 1 is generated between the completed Stage 0 and Stage 2 images.
- Stage 3 is generated between the completed Stage 2 and Stage 4 images.

This gives the endpoints strong visual contrast while keeping the intermediate geometry, style, and density coherent. Do not generate all later stages from Stage 0, and do not make a simple Stage 0 → 1 → 2 → 3 → 4 edit chain.

## 1. Create a character manifest

Copy and adapt:

`design/floating-neighborhood-v2/haven/mossprout/progression.json`

Create the new manifest at:

`design/floating-neighborhood-v2/haven/<character>/progression.json`

Keep these production contracts:

- `schemaVersion` is `2`.
- Five contiguous stage IDs use keys named `<character>_haven_stage_<id>`.
- `canonicalNeutralSource` provides authoritative island geometry and camera.
- `styleReferences` contains one or more approved runtime tiles for the character's visual language.
- `generationOrder` is `[0, 4, 2, 1, 3]` and `referenceGraph` uses the matching endpoint/interpolation graph.
- `canonicalSize` remains `2048`, even when the built-in generator returns another square size.
- `candidateCount` remains `1`; create one deliberate image per graph node and retry that node explicitly when needed.
- Stage 0 is genuinely sparse and incomplete; Stage 4 has the signature landmark and definitive fantasy.
- Every stage preserves the island shell, front stairs, camera, crop, and a small standing patch in the lower portion immediately above the stairs.
- The standing patch is only large enough for the Katchimera. The rest of the tile should develop naturally rather than leaving the middle empty.
- Favor large rounded silhouettes and low-frequency surfaces. Avoid prop-count inflation and tiny texture.

Describe persistent landmark anchors in the manifest so interpolation cannot move them around. For example, Mossprout's sprout grows into a tree at rear-center, the damp rear-right patch becomes a pond, and the resting nook develops at rear-left.

## 2. Build the Codex generation plan

The local script validates the manifest and writes the exact prompts, references, dependencies, hashes, and expected output paths:

```powershell
python scripts/generate-haven-progression.py --character <character> --mode all --dry-run
```

The default workspace is:

`.tmp/haven-progressions/<character>/codex-generation/`

It contains `codex-generation-plan.json` and one `stage-N-prompt.md` per stage. Planning never spends image-generation credits and never invokes a network API.

To inspect or retry a single node:

```powershell
python scripts/generate-haven-progression.py --character <character> --mode stage --stage 2 --require-inputs
```

`--require-inputs` verifies that every generated image dependency already exists.

## 3. Generate the five images with Codex

Use Codex's built-in image generator, one call per stage, in the order recorded in the plan. Do not use a local API runner and do not generate a multi-cell sheet.

For every task:

1. Read its `promptPath`.
2. Load every listed `inputImagePaths` image as a reference.
3. Label the image roles exactly as the prompt describes: authoritative geometry/style references for endpoints, or lower/upper progression references for interpolation.
4. Generate one square image on a perfectly flat `#FF00FF` chroma background.
5. Inspect the result at full size and at thumbnail size.
6. Copy the accepted built-in output into the task's `expectedOutputPath`, named `stage-N-chroma.png`.
7. Continue only after that dependency exists.

The image generator may vary the magenta slightly despite the prompt. That is expected; preparation combines the project's BiRefNet outer matte with an edge-connected chroma silhouette instead of deleting one exact color.

Landmark arches and other open structures may enclose background away from the canvas edge. Preparation explicitly excludes every magenta-like pixel from interior restoration, so these openings remain transparent instead of becoming solid pink cutouts.

Endpoint approval is important. Before generating Stage 2, confirm that Stage 0 and Stage 4 share the same island shell and camera but have a large, readable difference in floor coverage, silhouette, and landmark development.

## 4. Prepare transparent art

After all five `stage-N-chroma.png` files exist:

```powershell
python scripts/prepare-haven-progression.py `
  --character <character> `
  --source-dir .tmp/haven-progressions/<character>/codex-generation `
  --force
```

This runs the existing BiRefNet Heavy matting path plus chroma-backed interior repair and creates:

```text
prepared/stage-0.png
prepared/stage-0-alpha.png
...
prepared/stage-4.png
prepared/stage-4-alpha.png
prepared/preparation.json
```

`stage-N-alpha.png` is the 2048px transparent master. `stage-N.png` is its exact 2048px black composite for canonical source compatibility. The preparer starts from the pipeline's raw `matted.png`, retains BiRefNet's antialiased exterior edge, restores only the safe interior enclosed by edge-connected magenta, applies the shared edge treatment, and uses premultiplied-alpha resizing. This prevents semantic matting from cutting holes in broad quiet floors without restoring the exterior chroma field.

Preparation validates square source size, transparent corners, visible coverage, and records source/output hashes and alpha bounds.

## 5. Review before runtime promotion

Render QA directly from the prepared files:

```powershell
python scripts/render-haven-progression-qa.py `
  --character <character> `
  --prepared-dir .tmp/haven-progressions/<character>/codex-generation/prepared
```

This writes to `.tmp/haven-progressions/<character>/qa-prepared/`:

- `progression.png`: all five stages plus thumbnail checks.
- `with-character.png`: the Katchimera positioned over each standing patch.
- `style-comparison.png`: the proposed set beside approved runtime style references.

Approve the five images as one sequence. Check:

- stable island shell, camera, stairs, crop, and landmark positions;
- clear progression at 256px, especially between Stages 0 and 4;
- the small standing patch remains directly above the stairs, not at vertical center;
- the character fits without requiring a large empty middle or long path;
- no magenta fringe, black halo, clipped silhouette, text, creature, or watermark;
- rounded cozy 3D forms with restrained detail and no clutter.

If a stage fails, regenerate that graph node and every descendant that used it. For example, changing Stage 2 invalidates Stages 1 and 3; changing Stage 0 invalidates Stages 2, 1, and 3. Re-run preparation and QA for the complete set.

## 6. Promote the approved set

Dry-run first:

```powershell
python scripts/promote-haven-progression.py `
  --character <character> `
  --prepared-dir .tmp/haven-progressions/<character>/codex-generation/prepared `
  --replace `
  --dry-run
```

Then promote:

```powershell
python scripts/promote-haven-progression.py `
  --character <character> `
  --prepared-dir .tmp/haven-progressions/<character>/codex-generation/prepared `
  --replace
```

The set-aware command validates every black/alpha pair before writing anything. It then atomically replaces canonical source and alpha PNGs, packages transparent `1024`, `512`, and `256` WebPs, and regenerates shared alpha bounds once. If any stage fails, it restores the previous complete set from its recovery snapshot.

The older `--candidate-dir` path remains available for already-black candidates that still need matting. New Codex-generated Haven art should use `prepare-haven-progression.py` followed by `--prepared-dir` so it is not matted twice.

## 7. Final verification

Render QA once more from canonical assets and run repository checks:

```powershell
python scripts/render-haven-progression-qa.py --character <character>
node scripts/verify-haven-art-pipeline.cjs
npm run verify
git diff --check
```

Update the asset audit only after the final runtime images are approved and intentionally changed. No gameplay or save migration is required when replacing art for existing stage keys.

## Adding future Katchimeras

The scripts are character-agnostic, but runtime integration still needs five matching visual keys and assets. Before promotion, ensure the app maps `floating_neighborhood_v2_<character>_haven_stage_0_hex_tile` through Stage 4 and that the character cutout exists for QA.

Treat the manifest, generation plan, chroma sources, prepared alpha files, and QA sheets as one traceable production run. Only canonical PNGs and packaged WebPs are runtime sources; `.tmp` generation artifacts are reproducible working files, not application dependencies.
