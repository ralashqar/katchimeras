# Cheerlet trophy generation prompts

Generated through the secure Supabase `generate-asset` route using fal's `openai/gpt-image-2/edit` endpoint at 1536 px / high quality.

Style references:

- `assets/images/katchimeras/cutouts/cheerlet.png`
- `assets/images/katchimeras/world/backgrounds/cheerlet-exploration-v1.png`
- `assets/images/katchimeras/world/objects/festival_set/festival_bunting_pick.png`

## Art set

Celebration tables, chapter keepsake cabinets, party-star crests, celebration helper bags, and festival gateways.

- Sheet A contains the authored life-event and chapter-type ladders plus three runtime goal tiers; the unused fourth chapter and goal cells are generation-only continuity references.
- Sheet B contains companion quest tiers I–III and Journey goal tiers I–III.
- The generation key is magenta `#ff00ff`, selected to preserve the family's native palette.
- Exact production prompts are stored as `cheerlet-v1-sheet-a-prompt.txt` and `cheerlet-v1-sheet-b-prompt.txt`.
- fal request IDs, prompt hashes, references, and source URLs are stored in `tmp/imagegen/exploration-batch-v1/*.generation.json`.
- Every sheet is alpha-extracted with border-connected chroma removal, split on measured empty gutters, then tight-fitted to 78% subject coverage with edge fragments rejected.

Measured transparent grid cuts and runtime mappings are stored in `cheerlet-v1.json`.

