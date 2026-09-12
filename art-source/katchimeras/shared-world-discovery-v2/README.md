# Shared-world discovery art

User-requested fal Nano Banana regeneration, using the existing project pipeline.

- **Steppling:** a developed blue/ochre/timber trailhead, broad hiking steps, pines, backpack and lantern. The quiet center is reserved for the live Egg/character; no character or chair is baked into the art. This replaces the level-0 art used by the shared-world reveal, not the legacy haven progression series.
- **Mist:** opaque pearl/blue/lavender cloud forms covering the whole upper surface and rim. No environment props, exposed hedge ring or character silhouettes. The lower cliff remains visible to preserve the floating-hex silhouette.

Both use Mossprout's main hex as the camera/geometry/style reference. Steppling also uses its previous regular environment for identity and palette. Existing Mossprout images and its protected generation manifest are unchanged.

## Recipe and provenance

`briefs.json` is the prompt/reference recipe. Each tile directory preserves the exact `prompt.txt`, `generation.json` with reference/source SHA-256 values, original 2048px `source.png`, and reviewed 2048px `alpha.png`.

Generation: existing `generate-asset` endpoint → `fal-ai/nano-banana-2/edit`. Background removal: existing BiRefNet Heavy pipeline, with source-backed interior restoration and boundary cleanup. Packaging: the existing premultiplied-alpha packager, directly deriving 1024/512/256 WebPs from the reviewed alpha without trimming/recentering, followed by regenerated alpha bounds.

```powershell
python scripts/generate-shared-world-discovery-art.py generate --tile steppling --dry-run
# Generation refuses to overwrite an existing source. Preserve reviewed candidates first.
python scripts/generate-shared-world-discovery-art.py generate --tile steppling
# Visually review source.png before continuing.
python scripts/generate-shared-world-discovery-art.py matte --tile steppling
# Visually review alpha.png before packaging.
python scripts/generate-shared-world-discovery-art.py package --tile steppling
# Repeat those stages with --tile mist.
python scripts/review-shared-world-discovery-art.py
```

`qa-512.png` and `qa-256.png` compare the packaged images with Mossprout on cream, dark, magenta and checker backgrounds. The review script verifies provenance, exact output dimensions, alpha and transparent padding. Runtime wiring uses static sources for all three LODs in the shared neighborhood and regular world registry; older asset files remain available for rollback. Camera, character placement, unlock state and transitions are unchanged.

Asset QA is not a substitute for an on-device mist-reveal/character-framing check.
