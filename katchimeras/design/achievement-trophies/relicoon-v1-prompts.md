# Relicoon trophy generation prompts

Generated through the secure Supabase `generate-asset` route using fal's `openai/gpt-image-2/edit` endpoint at 1536 px / high quality.

Style references:

- `assets/images/katchimeras/cutouts/relicoon.png`
- `assets/images/katchimeras/world/backgrounds/relicoon-exploration-v3.png`
- `assets/images/katchimeras/world/props/artefact_museum_banner.png`

## Art set

Museum entrances, curator displays, catalogue boards, field satchels, and gallery portals.

- Sheet A contains the authored family-specific ladders plus three runtime goal tiers. Regular 4×3 sheets include one generation-only goal tier; Flickerbun's 4×4 sheet includes generation-only cinema and goal tiers to preserve its grid.
- Sheet B contains companion quest tiers I–III and Journey goal tiers I–III.
- The generation key is magenta #ff00ff, selected to preserve the family's native palette.
- Exact production prompts are stored as `relicoon-v1-sheet-a-prompt.txt` and `relicoon-v1-sheet-b-prompt.txt`.
- fal request IDs, prompt hashes, references, and source URLs are stored in `tmp/imagegen/creativity-batch-v1/*.generation.json`.

Measured transparent grid cuts and runtime mappings are stored in `relicoon-v1.json`.

