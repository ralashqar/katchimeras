# Egg Snap shell art v1

Built-in imagegen masters and prompts are retained in `sources/`. The final user direction supersedes the original symbol proposal: **regular shell tiles and their egg shots have no symbols**, including readability mode. Five original gameplay colour IDs are preserved. Bomb and shield retain their functional visual cues and live labels/numbers.

Rebuild: `python apps/egg-snap/scripts/package-shell-art.py` (Pillow). The packer uses alpha only, rejects opaque-background sources, preserves pale shell highlights, removes disconnected alpha debris, and normalizes regular art to 126×126 within a 128×128 cell. Eggs preserve aspect ratio. Overlay transparency is retained. Readability mode increases colour separation/contrast without adding symbols.

Atlas: 8 columns × 5 palette rows, 128px per sprite. Columns: regular cell, pulse, broad shell chip, reserved empty glyph, ghost socket, miniature ghost socket, egg shot, bomb egg shot. Columns 0–5 keep prior meanings. UI images and column 0 are byte-checked during packing. Previous `assets/blocks` remains available for rollback.

Runtime: both fighters use the same shell art. Empty targets are 18% opacity (32% readability). Bomb and shield art sits above them at matching cell bounds. A shot holds the square until its scheduled launch, crossfades square→egg over 90ms, and preserves the original 360ms flight/impact deadline. Backfire explicitly selects the bomb egg. Shared hosts without the optional projectile columns continue firing squares.

Verification: app tests include actual renderer frames before launch, throughout square-shell flight, both directions, pause, backfire and reduced motion. Native exports verify bundling; phone performance and haptics require a device playthrough.
