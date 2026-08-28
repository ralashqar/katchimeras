# Mossprout square merge-board island v1

Generated with the built-in image-generation workflow. The approved square
Mossprout environment is the strict Square Haven v2 camera, footprint,
material, lighting, cliff-depth, and simplification reference. The previous
merge island is a functional-layout reference only.

## Production contract

- Match `design/square-haven-v2/island-camera-contract.json`.
- Use a compact square floating platform and shallow 18–22% block cliff.
- Reserve a wide, uninterrupted central field for a separately rendered 7×6
  merge board.
- Give the field an identifiable rounded inset border, but bake no grid, cells,
  paving seams, items, mist, shadows, or decoration into the playable surface.
- Keep the rear and front openings centered. Render all flowers, leaves, rails,
  and four lanterns outside the calibrated playfield.
- Do not include a hut, resident platform, water, bridge, dock, tray, creature,
  UI, text, or extra island.
- Preserve the cozy matte molded-toy style, broad bevels, low texture detail,
  and large thumbnail-readable forms.
- Generate over flat `#ff00ff`; remove the key locally for the alpha master.

The runtime grid, cells, mist, items, drag geometry, and hit testing all use the
same calibrated playfield constants in `utils/haven-square-world.ts`.
