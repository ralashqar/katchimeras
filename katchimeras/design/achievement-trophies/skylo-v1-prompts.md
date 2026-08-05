# Skylo trophy generation prompts

Generated through the secure Supabase `generate-asset` route using fal's `openai/gpt-image-2/edit` endpoint at 1536 px / high quality.

Style references:

- `assets/images/katchimeras/cutouts/skylo.png`
- `assets/images/katchimeras/world/backgrounds/skylo-exploration-v1.png`
- `assets/images/katchimeras/world/objects/place_marker/place_marker_04.webp`

## Art set

Neighbourhood wayfinders, city skylines, city-map crests, urban explorer satchels, and civic gateways.

- Sheet A contains the two authored four-tier family ladders plus three runtime goal tiers; the fourth goal cell is a generation-only continuity reference.
- Sheet B contains companion quest tiers I–III and Journey goal tiers I–III.
- The generation key is magenta `#ff00ff`, selected to preserve the family's native palette.
- Exact production prompts are stored as `skylo-v1-sheet-a-prompt.txt` and `skylo-v1-sheet-b-prompt.txt`.
- fal request IDs, prompt hashes, references, and source URLs are stored in `tmp/imagegen/exploration-batch-v1/*.generation.json`.
- Every sheet is alpha-extracted with border-connected chroma removal, split on measured empty gutters, then tight-fitted to 78% subject coverage with edge fragments rejected.

Measured transparent grid cuts and runtime mappings are stored in `skylo-v1.json`.

