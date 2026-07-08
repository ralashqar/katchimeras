---
name: katchimera-assets
description: Produce Katchimera creature/egg/UI art in this repo via the FAL + Supabase pipeline. Use when the user asks to generate, regenerate, add, matte/cut-out, or bundle a creature, mascot, egg, or widget/onboarding image — or to wire a new character into the app. Covers generation (fal nano-banana-2), consistent variants (edit endpoint), true-alpha background removal (BiRefNet), QA, cropping, and constants wiring.
---

# Katchimera asset production

Full reference: `docs/katchimera-asset-pipeline.md`. CLI: `scripts/asset-pipeline.py`.
This skill is the operational checklist; read the doc for the why and the deeper recipes.

## Preconditions
- Run from the app dir: `C:\Users\daruk\Projects\Katchimeras\katchimeras\katchimeras`.
- `.env.local` has the Supabase URL + anon key (the CLI reads them). FAL key and
  service role are Supabase function secrets — never handled client-side.
- The two edge functions are already deployed: `generate-katchimera-art`,
  `remove-image-background`. Only redeploy (`npx supabase functions deploy <fn>`)
  if you changed their `index.ts`.

## Flow for a new / regenerated creature
1. **Source the prompt.** For an existing encounter profile, use its `imagePrompt`
   from `data/katchimeras/encounter-katchimeras.json`. For a new one, write a
   prompt in the art-bible style (head-dominant mascot, oversized glossy eyes,
   inner glow core, one signature motif, dark bg, centered).
2. **Generate:** `python scripts/asset-pipeline.py generate --id <id> --prompt "<prompt>" --out /tmp/<name>.png`
   (a hard no-text negative is appended automatically).
3. **QA — Read the PNG.** Judge the five gates (thumbnail read, silhouette, glow
   core, single motif, eyes). **Reject baked-in text/numbers/monograms** and
   regenerate (model variance — just rerun). Flag taste calls for the user.
4. **Matte:** `python scripts/asset-pipeline.py matte --name <name> --in /tmp/<name>.png --out assets/images/katchimeras/cutouts/<name>.png`
   — auto-verifies alpha (corners 0, subject opaque). Read the cutout to confirm
   the matte is clean (translucent bodies/pedestals are the usual failure).
5. **Wire it in** (`docs/katchimera-asset-pipeline.md` § Bundling & wiring):
   `HomeVisualKey` → `homeCreatureVisuals` → `encounterLiveCast` (+ `voice`),
   and a seed + regen if it's a new category.
6. **Verify:** `node scripts/verify-encounter-engine.cjs`, `npx tsc --noEmit`,
   `npm run lint`.

## Consistent variants (egg crack stages, mood variants)
Use the edit endpoint so the variant matches a source frame, then matte and
**shared-bbox crop** the set together (PIL) so crossfades stay aligned:
`python scripts/asset-pipeline.py edit --id <id> --prompt "the exact same X, <change>; same subject, position, lighting, background" --image-url <source> --out /tmp/<name>.png`

## UI textures (no FAL — PIL only)
Rings/glows/glass are generated PNGs tinted at runtime (RN can't blur or draw
conic gradients). See the doc's § Generated UI textures for the recipes
(`aurora-ring`, `soft-glow`, `glass-dome`).

## Rules
- **Never bias to "transparent background" prompts or greenscreen** — always
  matte with BiRefNet for true alpha.
- **Always visually QA** by Reading the PNG; never bundle an unseen asset.
- Adding art is a Metro-reload change, **not** a native rebuild — except
  widget-visible images (bundled into the widget target at build time).
- Surface taste/brand judgment calls (cast identity, which render to keep) to
  the user; don't auto-decide them.
