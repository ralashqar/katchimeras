# Mossprout hex neighborhood v1

The focused Mossprout world uses the production top-level flat-top hex shell
and `floating-neighborhood-v2` projection. The approved floating-focused V2
main proof locks the six-corner platform, deep segmented tapered cliff, stairs,
camera, scale, materials, lighting, and padding for the complete set.

`main-source.png` is the visual authority for Mossprout landmarks and palette.
The Garden and six final-form nature tiles reuse the same physical shell while
allowing their top-face content and boundary treatments to vary. A continuous
hedge, fence, wall, perimeter ring, and empty center are not required. Generated
sources use a pure-black matte; `package-mossprout-hex-neighborhood.py` extracts
reviewed alpha masters and packages 1024/512/256 WebP tiers. Exact prompts and
generation records are retained under `generation-floating-focused-v2/`.

Runtime topology:

| Tile | Axial coordinate |
| --- | --- |
| Main | `(0, 1)` |
| Garden | `(0, 2)` |
| Seed Nursery / Bloom Garden | `(-1, 1)` / `(1, 0)` |
| Pond Sanctuary / Orchard Grove | `(-1, 2)` / `(1, 1)` |
| Ancient Tree Grove / Wildgrowth Grove | `(-1, 3)` / `(1, 2)` |

Rebuild and review with:

```powershell
npm run art:mossprout:hex:generate
npm run art:mossprout:hex:promote
npm run art:mossprout:hex:check
```

Do not call the internal focused generator mode directly. The single canonical
runbook is `docs/mossprout-hex-neighborhood-pipeline.md`; its checked manifest
owns all prompts, guides, base dependencies, and generation order.
