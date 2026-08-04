# Steppling trophy generation prompt

Generated with the built-in image generator using these three references, in order:

- `assets/images/katchimeras/cutouts/steppling.png` — character material, palette and finish
- `assets/images/katchimeras/world/backgrounds/steppling-exploration-v2.png` — environment palette and world language
- `assets/images/katchimeras/world/objects/steps_path/steps_path_01.webp` — existing prop scale and rendering style

## Final prompt

Create one production asset sheet containing exactly 20 isolated trophy/keepsake objects for Steppling, arranged as a precise five-column by four-row grid. Match the supplied Katchimeras references: premium cozy stylized 3D game art, rounded handcrafted forms, soft clay, carved wood, worn leather and smooth stone, warm diffuse light, gentle ambient occlusion, blue, burnt-orange, cream and sage trail palette. These must feel like cherished objects found in Steppling's walking world, not generic award cups.

Use a perfectly flat solid `#ff00ff` background across the entire canvas. Leave generous clear padding inside every cell. No grid lines, labels, letters, numbers, characters, trophy cups, medals, emoji styling, glossy plastic, photorealism, cast shadows on the background, reflections, watermarks, or magenta inside any object.

The cell order is exact, left to right:

- Row 1, Big step days tiers I–V: one simple trail stepping stone; two stones with a tiny orange leaf; a short winding stone path with a blue trail marker; a longer rising path with a small wooden sign; a grand winding summit path ending at a celebratory orange-and-blue trail flag.
- Row 2 columns 1–4, Walking rhythm tiers I–IV: a small pair of walking boots; boots with tied laces and one trail leaf; well-loved boots on a short stone path; richly detailed trail boots with a circular path, leaves and a small dawn accent.
- Row 2 column 5, Walks shared tier I: a compact blue walking journal with an orange route line and one small leaf marker.
- Row 3 columns 1–3, Goals practised tiers I–III: a tiny rolled walking plan tied with blue cord; an open trail plan with a route and one marker; an accomplished layered route board with multiple markers and a small flag.
- Row 3 column 4, Walks shared tier II: an open treasured walking journal with several route sketches, pressed leaves and a small pencil.
- Row 3 column 5, Quests completed tier I: a small trail satchel with one simple stitched route badge.
- Row 4 columns 1–2, Quests completed tiers II–III: a fuller trail satchel with two badges and a rolled map; a richly equipped explorer satchel with several badges, compass, map and trail leaves.
- Row 4 columns 3–5, Longer goals tiers I–III: a small wooden trail arch over one stepping stone; a broader arch opening onto a winding path with a distant marker; an ornate summit gateway framing a long rising trail, flag and warm sunrise accent.

Make progression within each group immediately readable while keeping the base object recognizable. Center every object consistently and keep neighboring cells visually separate.

## Grid contract

The generated sheet is 5×4. Runtime file mapping and the inspected transparent-gutter UV cuts are stored in `steppling-v1.json`; do not infer names or cell boundaries from equal row/column division because two progressions share rows 2 and 3 and several objects cross those mathematical boundaries.
