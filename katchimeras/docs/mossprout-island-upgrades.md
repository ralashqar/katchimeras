# Mossprout island upgrades

All six nature islands use the existing upgrade speech bubble, confirmation sheet with Glow cost in the CTA, durable purchase journal, and camera/payment/reveal sequence. Level 0 is mist; paying for level 1 clears it. Further purchases advance one level at a time to level 4. FTUE continues to own its Garden and Steppling mist targets before normal exploration is available.

## Level data

Edit `constants/mossprout-nature-islands.ts` for island names, level names, descriptions, costs and story gates. The four costs in each island definition correspond to destination levels 1–4:

| Island | Clear mist → 1 | Level 2 | Level 3 | Level 4 |
| --- | ---: | ---: | ---: | ---: |
| Seed Nursery | 40 | 60 | 150 | 300 |
| Bloom Garden | 40 | 60 | 150 | 300 |
| Pond Sanctuary | 40 | 65 | 150 | 300 |
| Orchard Grove | 40 | 65 | 150 | 300 |
| Ancient Tree Grove | 40 | 75 | 150 | 300 |
| Wildgrowth Grove | 40 | 75 | 150 | 300 |

Existing progression gates are retained: the Garden must be restored, level 1 requires chapter zero complete, and levels 2–4 require the corresponding Mossprout story level. Finishing a tier on every island advances the aggregate Haven tier. Offers, confirmation and the purchase reducer read the same level catalog; insufficient Glow never charges, and receipt replay never charges twice. Existing unlocked levels are preserved.

## Art fallbacks

`MOSSPROUT_NATURE_ISLAND_ART` in `components/katchadeck/world/mossprout-hex-neighborhood-scene.ts` contains each island's current sources, measured alpha bounds and map coordinate. These sources are the fallback for every unlocked level. To add bespoke art, add `levelArt: { 2: { sources: { full, medium, thumb }, alphaBounds } }` to that island. Use static bundled image requires and normalized 1024px alpha bounds. Missing level entries use the island's fallback; level 0 always uses shared mist art.

The renderer reserves the mist, fallback and every authored level's bounds before laying out the scene. This prevents reveals from shifting the camera or unrelated tiles. Both mist and revealed tiles retain their interaction footprint. Upgrade previews and reveal layers use the same scene resolver, including when consecutive levels share identical artwork.

## Verification

`tests/world-upgrades.test.tsx` covers every island and level, offer visibility, purchase cost, save/reload, duplicate receipts, final tier completion, mist hit targets, stable reveal layout and optional bespoke art with fallback. Native animation appearance still needs device review.
