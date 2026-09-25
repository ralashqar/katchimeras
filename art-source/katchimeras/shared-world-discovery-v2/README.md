# Shared-world discovery art

User-requested fal Nano Banana regeneration, using the existing project pipeline.

- **Steppling:** a developed blue/ochre/timber trailhead, broad hiking steps, pines, backpack and lantern. The quiet center is reserved for the live Egg/character; no character or chair is baked into the art. This replaces the level-0 art used by the shared-world reveal, not the legacy haven progression series.
- **Baristabbit (Sept 12, 2026):** the lit window: a cream cafe kiosk with a terracotta roof and one amber-lit window at the rear, a blank sign, two lanterns, a teapot, a round table and a sage bench, on honey plank flooring over warm sandstone and terracotta cliffs. The quiet centre is reserved for the live Egg/character. Generated with the same recipe (`--tile baristabbit`), Mossprout's main hex as the geometry reference and the floating-neighborhood Baristabbit render as the identity guide.
- **Mist:** opaque pearl/blue/lavender cloud forms covering the whole upper surface and rim. No environment props, exposed hedge ring or character silhouettes. The lower cliff remains visible to preserve the floating-hex silhouette.

- **The Last Clearing, step 4 (Sept 24, 2026).** Each uses Mossprout's main hex as the geometry and style reference:
  - `lost-trail-tracks`: the Lost Trail's misted story-tile state. The rear two thirds are under the house Mist (the `mist` source is the style guide), an ochre path runs into it with small paw prints going in, and a leaning blank trail marker stands at the edge. No character is baked in; Steppling's silhouette is drawn at runtime.
  - `lost-trail`: the revealed trail to the sea. The Steppling palette guide supplies the sea-glass stepping stones, the shell on a sandy boulder, a pine, an upright blank marker and a lantern.
  - `hollow-tree`: the far landmark. A fully misted hex, with one huge leafless grey hollow tree rising from it. The scene draws it at 1.6x, past the outer ring.

- **Petalimp's Bloom House (Sept 25, 2026):** `bloom-house-1/2/3`, the three looks of Petalimp's hero building on the Bloom Garden island.
  - The house grows from a petal-roofed cottage, to two tiers with a watering can, to a tulip-bud tower beside a glass greenhouse.
  - The garden itself is unchanged.
  - The identity guide `bloom-garden-l4-guide/source.png` is the island's shipped level-4 tile flattened onto black. That tile has no 2048px source.

- **Fernip's Thicket (Sept 25, 2026):** `fern-thicket-1/2/3`, the three looks of Fernip's hero building on the Wildgrowth Grove.
  - The building grows from a fern-roofed burrow nook, to a house with a lantern and a fern arch, to a great house crowned by a huge fiddlehead.
  - The house takes the red mushroom's place at the rear left. The purple and orange mushrooms, the log tunnel and the path are unchanged.
  - The guide `wildgrowth-grove-guide/source.png` is the island's shipped tile flattened onto black.
  - `fern-thicket-2-candidate-1` is the rejected first stage 2: it replaced the purple mushroom.

- **Baristabbit's Café and Feastle's Kitchen (Sept 25, 2026):** `cafe-2/3` and `kitchen-2/3`, the grown looks of the two food buildings. Each building's first look is the friend's own tile.
  - **The Café** grows from the window kiosk to a two-storey café with a menu board, then a grand café with a striped awning, a rooftop terrace and a coffee machine.
  - **The Kitchen** grows from the hearth cottage to a cottage with a brick-chimneyed kitchen wing, then a grand kitchen hall with a serving counter.
  - Stage 2's small table with bowls sits further forward than on the other two looks.

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

- **Misted own tiles (Sept 25 2026):** each is the friend's own tile under the house Mist. `dream-mist-imagegen-soft-v1` (the v4 full Mist) is the style guide, and each layout matches the cleared tile, so a reveal crossblends in place.
  - `mossprout-veiled`: Mossprout's main tile, fully misted except the round patio where he stands. It is the Last Clearing's veiled home.
  - `steppling-misted`: Steppling's trailhead, its rear three quarters misted, with the front strip and paw prints clear. It replaces the separate Lost Trail tile: the trail's battles dock here and the tile clears as he is rescued.
