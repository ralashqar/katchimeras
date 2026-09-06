# Pagelet trophy generation prompts

Generated through the secure Supabase `generate-asset` route using fal's `openai/gpt-image-2/edit` endpoint at 1536 px / high quality.

Style references:

- `assets/images/katchimeras/cutouts/pagelet.png`
- `assets/images/katchimeras/world/backgrounds/pagelet-exploration-v1.png`
- `assets/images/katchimeras/world/objects/keepsake_set/book_stack_pick.png`

## Art set

Open-book reading nooks, collected libraries, book crests, reader satchels, and library portals.

- Sheet A contains the authored family-specific ladders plus three runtime goal tiers. Regular 4×3 sheets include one generation-only goal tier; Flickerbun's 4×4 sheet includes generation-only cinema and goal tiers to preserve its grid.
- Sheet B contains companion quest tiers I–III and Journey goal tiers I–III.
- The generation key is magenta #ff00ff, selected to preserve the family's native palette.
- Exact production prompts are stored as `pagelet-v1-sheet-a-prompt.txt` and `pagelet-v1-sheet-b-prompt.txt`.
- fal request IDs, prompt hashes, references, and source URLs are stored in `tmp/imagegen/creativity-batch-v1/*.generation.json`.

Measured transparent grid cuts and runtime mappings are stored in `pagelet-v1.json`.

