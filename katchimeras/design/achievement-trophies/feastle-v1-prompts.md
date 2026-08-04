# Feastle trophy generation prompts

Both sheets were generated with the built-in image generator using these references:

- `assets/images/katchimeras/cutouts/feastle.png` — primary character materials and palette
- `assets/images/katchimeras/world/today/feastle-full-spread.webp` — hearth kitchen architecture and world language
- `assets/images/katchimeras/world/objects/food/hearth_pot.webp` — existing iron, fire and food-prop finish

## Shared direction

Create isolated Feastle keepsakes matching the supplied premium cozy miniature 3D Katchimeras art: plump rounded handcrafted forms, terracotta clay, honey-gold food, seasoned iron, warm carved wood, cream linen, copper details and restrained sage accents. They are treasured objects from Feastle's cooking-and-food world, never generic cups or medals. Use a perfectly flat solid `#ff00ff` chroma-key background. No grid lines, cast/contact shadows, floor plane, reflections, characters, text, numbers, generic awards, photorealism, watermark, or magenta inside objects.

Every subject must occupy no more than 68% of its cell, remain centered, and keep at least 10% completely empty uninterrupted chroma gutter on every side. Nothing may touch or cross a cell boundary.

## Sheet A — exact 4×3 grid

- Row 1, Food memories I–IV: small bread-and-vegetable plate; fuller platter on linen; covered feast dish on carved trivet; abundant celebratory platter beneath an ornate copper arch.
- Row 2, Flavours discovered I–IV: single leaf-stopper spice jar; three-jar wooden caddy; five-jar spice chest with mortar; eight-jar world-flavour carousel with brass handle.
- Row 3, Goals practised I–IV: one-symbol wooden recipe token; two-symbol chopping-board medallion; three-symbol kitchen crest with spoon and fork; elaborate four-symbol hearth crest. Tier IV is generation-only progression reference.

## Sheet B — exact 3×2 grid

- Row 1, Quests completed I–III: compact linen market satchel; fuller cook's tote with bread, vegetables and utensils; equipped hearth-adventure backpack with copper pan and spice pouch.
- Row 2, Longer Journey goals I–III: tiny terracotta oven arch and one tile; richer pantry/hearth arch with two tiles, lamp and bread basket; inviting hearth gateway with three tiles, twin lanterns and glowing pot.

Sheet A's safe vertical gutters shift between rows, so `feastle-v1.json` records measured per-cell pixel bounds. This is the reference example for preserving row-specific gutters without clipping or neighbour bleed.
