# Wisp cards and Lantern artwork

Generated with the built-in image-generation tool. Exact prompts are retained in `prompts.json`.

- `lantern-lit-v2.png`: cozy toy Lantern with warm light and molded leaf roof.
- `lantern-dormant-v2.png`: unlit planting state in the same cream, sage and wood palette.
- `wisp-pack.png`: original green-and-gold collectible pack with a Wisp emblem.
- `wisp-card-frame.png`: cream-and-gold frame with a transparent art window, blank header and nameplate.

Runtime WebP derivatives are in `art/assets/images/katchimeras/wisps/cards`. Resizing preserves generated transparency; alpha was checked in the background corners and frame window. Text, rarity colour/symbol and Wisp art are rendered by the app so the frame can be reused for every card and translated without regenerating assets.

The Common/Rare card composition was checked using the actual `WispCollectionCard` in a browser preview. Native world placement and swipe behavior still need an on-device playthrough.
