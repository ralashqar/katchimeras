# Mossprout hex-neighborhood art pipeline

This is the only supported generation path for Mossprout's focused-world hex
tiles. Do not reconstruct prompts from chat history, call the internal focused
mode directly, reuse the old resident-tile method, or start from a shallow
island guide.

## Locked authorities

- `design/mossprout-hex-neighborhood-v1/pipeline.json` owns every reference,
  exact theme prompt, dependency, model setting, and generation order.
- `scripts/generate-mossprout-hex-neighborhood.py` is the only entry point.
- `main-source.png` is the approved Mossprout style reference.
- The deep tapered floating cliff, large block proportions, recessed front
  stairs, six-corner platform, camera, scale, lighting, and padding are fixed.
- Only top-face environment content and boundary treatment may change.
- A continuous hedge, fence, wall, perimeter ring, U-shaped presentation frame,
  and empty center are never mandatory.
- Every object must remain fully inside the square canvas with transparent
  padding on all four sides. A clipped source must be regenerated; matting
  cannot reconstruct missing artwork.

The internal generator rejects `floating-focused-v2` calls that do not carry
the canonical Mossprout pipeline lock. This prevents ad-hoc prompt variants.

## Generate candidates

Review prompts without spending a generation:

```powershell
python scripts/generate-mossprout-hex-neighborhood.py generate --dry-run
```

Generate the complete set in its locked dependency order:

```powershell
npm run art:mossprout:hex:generate
```

Generate one or more tiles:

```powershell
python scripts/generate-mossprout-hex-neighborhood.py generate --tile garden --tile wildgrowth-grove
```

Candidates and provenance are written to
`.tmp/katchimera-hex-tiles/<tile>/`. Inspect every candidate at full size and
in the complete neighborhood before promotion. Reject any shallow cliff,
changed stair geometry, camera drift, hedge wall, inherited unrelated boundary,
or rendering-style drift.

## Promote reviewed candidates

Promotion deliberately uses candidate 1 from each selected tile. Run it only
after visual review:

```powershell
npm run art:mossprout:hex:promote
```

Promotion copies canonical sources, preserves exact prompts and generation
records under `generation-floating-focused-v2/`, extracts true alpha, packages
1024/512/256 runtime tiers, regenerates bounds, and renders the QA neighborhood.

### Background extraction contract

Generated sources retain the pipeline's near-black studio backdrop. Never use
a global brightness key: the cliffs, doorways, hollow logs, root shadows, and
ambient-occlusion seams contain legitimate dark pixels. The canonical packager
removes only neutral near-black pixels connected to the canvas boundary, keeps
the single connected island component, preserves every enclosed dark region,
pulls partial-edge colour inward, and applies a soft one-pixel contour cleanup.

Dense silhouettes that expose background-removal defects can opt into the
canonical Supabase/FAL BiRefNet Heavy rematte in `pipeline.json`:

```powershell
python scripts/generate-mossprout-hex-neighborhood.py rematte --tile bloom-garden --tile wildgrowth-grove
```

This preserves the approved source art. BiRefNet supplies the exterior alpha;
the shared hex pipeline restores only source-backed safe interior pixels, pads
partial-edge RGB inward, contracts the edge softly, and records a source hash
plus model provenance. Runtime LODs are then rebuilt with premultiplied alpha.

The packager rejects any alpha touching a canvas edge. QA is rendered both as a
complete neighborhood and at tile-detail scale against dark, cream, checkerboard,
sky-cyan, and saturated magenta backgrounds:

- `qa-complete-neighborhood.jpg`
- `qa-alpha-matte-neighborhood.jpg`
- `qa-alpha-matte-details.jpg`

Inspect all backgrounds. Reject retained backdrop, transparent holes, dark or
coloured fringes, clipped contours, and detached speckles before promotion.

## Validate

```powershell
npm run art:mossprout:hex:check
npm run typecheck
npx tsx --test tests/haven-square-world.test.ts
```

The visual authority is
`design/mossprout-hex-neighborhood-v1/qa-complete-neighborhood.jpg`.
