# Baristabbit café merge art v1

Production source set for Baristabbit's café-focused merge progression. The
runtime sprites are generated from the `*-alpha.png` sheets by the versioned
manifests in `tooling/art-pipeline/scripts`.

## Art direction

- Cozy toy-diorama 3D with broad matte colours, soft studio light, thick
  rounded silhouettes, large bevels, cushiony proportions, and restrained
  contact occlusion.
- Readable at 34–50 px. One centred object per grid cell with generous safe
  padding and a clear tier-to-tier increase in abundance and ceremony.
- Prepared drinks and café objects from tier one onward. No raw leaf, mint,
  berry, or ingredient-pile opening tiers.
- No text, logos, floor planes, cast shadows, fine texture, photorealism, thin
  steam, detached crumbs, or decorative fragments.

Baristabbit's primary discovery and story ladder is the colourful refreshing
chain: Small Juice Cup → Iced Fruit Tea → Berry Smoothie → Lemonade Pitcher →
Garden Drinks Cart → Festival Drinks Fountain. The specialty chain adds a
second single-drink progression—espresso, latte, pink boba, green matcha,
purple shake, and rainbow float—without returning to trays or cup clusters.

## Final built-in image-generation prompt set

All sheets use a uniform `#FF00FF` generation background for deterministic
connected-chroma extraction. Each item sheet is a 3 × 2 grid in row-major tier
order; the generator sheet is a 1 × 2 grid.

1. **Specialty drinks:** Tiny Espresso; Caramel Latte; Strawberry Boba; Matcha
   Cloud Frappe; Blueberry Star Shake; Grand Rainbow Café Float. Each tier is
   one increasingly large and colourful vessel, never a tray or cup cluster.
2. **Refreshing drinks:** Small Juice Cup; Iced Fruit Tea; Berry Smoothie;
   Lemonade Pitcher; Garden Drinks Cart; Festival Drinks Fountain.
3. **Café pastry:** Butter Biscuit; Cookie Pair; Berry Cupcake; Pastry Board;
   Afternoon Tea Stand; Dream Patisserie.
4. **Café sharing:** Café Coaster; Two-Cup Tray; Coffee Table Set; Window Nook;
   Friends' Café Table; Lantern Café Terrace.
5. **Generators:** Ritual Bar that visibly serves hot and refreshing cups; Café
   Counter that visibly offers pastries and welcoming table pieces.

Shared prompt contract: “Game merge-item sprite sheet; cozy low-detail
cushion-toy 3D; broad matte colours, soft bevels, rounded readable silhouettes,
gentle major-contact ambient occlusion; one isolated object per cell; 12% safe
padding; no text, logo, scenery, floor, cast shadow, raw ingredients, or
detached fragments.”

The live tile used the existing Baristabbit tile as the edit target and the
Mossprout focused main tile as the scale/detail reference. Its prompt requested
a compact cup-topped café kiosk, one espresso machine, two cups, a lantern,
planters, a small two-seat pause table, and a large open resident area while
preserving the established hex footprint, camera, soft toy materials, and
transparent exterior. The generated checker preview is retained beside the
cleaned alpha master under `../floating-neighborhood-v2/`.

## Processing

1. Run `remove-connected-chroma.py` on each chroma sheet.
2. Run `process-merge-world-item-sheets.py` with
   `baristabbit-merge-item-art-manifest-v1.json` and
   `baristabbit-generator-art-manifest-v1.json`.
3. The item manifest removes small detached lower-edge generation debris,
   normalizes every silhouette to a shared extent, emits 256 px WebP, and
   audits centring, alpha, dimensions, and file size.
4. Run `remove-connected-checkerboard.py` for the tile master, then
   `package-transparent-hex-tile.py` with key
   `floating_neighborhood_v2_baristabbit_hex_tile` to publish 1024/512/256
   runtime LODs and regenerate shared face bounds.

The contact sheets are the visual acceptance record for the two sprite groups.
