# Egg Snap combat environment workflow

The canonical camera is the approved detailed v3 forest. `apps/egg-snap/data/combat-stage-template.json` owns its source size, standing contacts and play region. Both gameplay and this authoring workflow consume that file. Creating a new art variant never rewrites it.

1. Prepare a unique variant:

   `python tooling/art-pipeline/scripts/egg-snap-environment.py prepare frost-garden-v1 --style "Cozy snowy toy garden, smooth cream platforms, cushiony snow, low texture detail"`

2. Read the generated `recipes/<id>/prompt.txt`. Use the built-in image generator to edit `reference.png` with that prompt. It is an interactive generation step; this CLI does not call an API or silently fall back to FAL. Additional style references may guide materials, never the camera.

3. Import the selected result:

   `python tooling/art-pipeline/scripts/egg-snap-environment.py import frost-garden-v1 --source C:/absolute/path/generated.png`

4. Inspect `recipes/<id>/review.html`: compare the original and candidate with identical platform/contact guides. Also compare the complete top ellipses, outer rims, camera and gameplay clearances. The CLI rejects aspect-ratio changes over 0.5%, checks reference/template hashes and tracks the candidate hash. It cannot automatically guarantee generated geometry. Reject a shifted platform and regenerate; do not move the eggs to compensate. Guides are standing-surface bounds, not platform cutout masks.

5. After visual review, activate:

   `python tooling/art-pipeline/scripts/egg-snap-environment.py activate frost-garden-v1 --review-note "Compared platform silhouettes and contact guides; camera and scales match"`

   This copies the approved source, packages full/medium WebP assets, generates static Metro references and records the active id separately from pure geometry. Runtime geometry remains unchanged. The review flag records the reviewer's findings; it is not a request for extra user approval.

6. Run `npm run check --workspace=egg-snap`, preview a duel at normal and compact phone sizes, and check grounded feet, targets and hero text. Rebuild the active LODs later with `prepare-egg-snap-stage.py`.

Each recipe retains its prompt, reference copy, guide, candidate, hashes and review notes. Use a new id for each candidate to retain rejected outputs and avoid accidental replacement. Material-only refinement prompts should also be saved with the recipe. To restore an earlier recipe, activate that reviewed recipe again.

Current example: `mossprout-duel-toy-v6`, generated with built-in imagegen using the requested cozy, cushiony toy style and a second material-simplification pass. The original v3 remains the composition authority.
