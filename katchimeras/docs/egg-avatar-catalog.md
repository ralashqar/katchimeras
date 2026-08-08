# Egg avatar catalog

The player avatar catalog is data driven. Product metadata lives in JSON; application code must not maintain a second handwritten list of names, prices, availability, or art paths.

## Source of truth

- `data/egg-avatar/bodies.json`: 50 body designs, including a broad costume family.
- `data/egg-avatar/faces.json`: 30 face designs.
- `data/egg-avatar/hats.json`: 40 hat designs.
- `data/egg-avatar/held.json`: held-accessory designs (the initial six are production-ready).
- `data/egg-avatar/body-accents.json`: UI accent color for each ready body.
- `data/egg-avatar/catalog.schema.json`: documented data contract.

Each item records a permanent kebab-case ID, player-facing name and description, detailed visual direction, rarity, access rule, availability, sort order, version, compositor layout version, and optional presentation calibration.

`availability` is the shipping gate:

- `planned`: the design exists in the roadmap but `assetRefs` must be `null`. It is excluded from every runtime picker and ID accepted by saved selections.
- `ready`: all three production assets must exist. The item is emitted into the runtime registry and appears in the relevant customizer section.

The current production items remain `free`. Planned entries may describe their intended `free`, `premium`, or `essence` access before their art is produced. The access modes are mutually exclusive:

- `free`: available to everyone; `essencePrice` is `null`.
- `premium`: requires premium membership; `essencePrice` is `null`.
- `essence`: unlocked through soft-currency purchase; `essencePrice` is a positive integer.

## Expo asset registry

React Native bundling requires literal `require()` calls for local images. Run:

```powershell
npm run avatar:catalog:generate
```

This validates the JSON and writes two files: `constants/egg-avatar-catalog.generated.ts` contains platform-neutral typed ID tuples and body accents, while `constants/egg-avatar-assets.generated.ts` contains the literal static Expo asset registry. Keeping them separate allows Node tests and data tooling to load IDs without trying to decode native image imports. Never edit either generated file by hand.

`constants/egg-avatar-catalog.ts` exposes the full roadmap, ready-only lists, item lookup, and access resolution. The existing `egg-avatar-skins`, `egg-avatar-faces`, `egg-avatar-hats`, and `egg-avatar-held-accessories` modules are thin runtime adapters, so existing renderers consume the new data without changing their public APIs.

## Adding a planned design

1. Add the metadata entry to the appropriate JSON file with a globally unique permanent ID.
2. Set `availability` to `planned` and `assetRefs` to `null`.
3. Give it the next contiguous `sortOrder` and capture enough visual constraints to reproduce the design consistently later.
4. Run `npm run avatar:catalog:generate` and `npm run test:egg-avatars`.

The entry is now documented and typed, but cannot appear in the game.

## Promoting art to production

1. Generate and approve the art using the relevant egg-avatar art pipeline and review gates.
2. Place the high-resolution PNG, app WebP, and thumbnail WebP at stable paths below `assets/images/katchimeras/egg-avatars/`.
3. Fill all three `assetRefs`, set `availability` to `ready`, and increment `version` when replacing existing art.
4. Add a body accent when promoting a body. Record a restrained `presentation` override only when compositing review proves it is needed.
5. Run the generator, avatar tests, art validation, typecheck, lint, and an Expo export.

The catalog validator deliberately rejects missing files, planned entries with art references, ready entries without art, duplicate IDs, inconsistent access pricing, and stale generated output. Availability and ownership are separate: generated art may be `ready` while its `free`, `premium`, or `essence` access metadata determines the intended unlock rule.
