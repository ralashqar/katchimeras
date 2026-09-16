# Content packs: live-ops content without a build

A content pack is one JSON document plus the art it names. It can bring a hex tile (with progression art like an island's), a character and its cut-out, merge chains and generators, a mission board with its own mechanic, a journey chapter, conversations and content flows. Every entry is the same definition the bundled content is authored as, so the registries read a pack the way they read the bundle. Built Sept 2026; the fixture `data/content-packs/event-column-shot.json` is a complete example.

## Rules

- **A pack only adds.** Every id it brings must be new to the bundle; a bundled id is refused (the FTUE and every shipped board are safe by construction).
- **Everything it names must exist**, in the bundle or in the pack: chains a character uses, skins a family anchors on, tiles a chapter reveals, missions a chapter docks by `missionId`, art for every tile, cut-out and creature it adds.
- **A board must play out.** Every mission is walked through every way of playing it (`features/mission-mechanics/validate.ts`): no dead end, a move to point at at every step, and the bar equal to the wisps' hit points for a column-shot board.
- **Refused whole.** One issue and nothing of the pack is used; the app keeps the pack it had. `normalizeContentPack` (`features/content-packs/normalize-content-pack.ts`) lists every issue.
- **Applied at launch.** Registries are module constants, so the stored pack is primed as the root layout's very first import (`features/content-packs/prime.ts`) and the app restarts after an activation. A pack the server stops offering is put away on the next launch.

## Document

```json
{
  "id": "harvest-2026", "version": 1, "contentSchemaVersion": 1, "title": "Harvest Grove",
  "minAppVersion": "1.0.0", "startsAt": "2026-10-01T00:00:00Z", "endsAt": "2026-11-01T00:00:00Z",
  "mergeChains": [{ "chainId": "nature:orchard", "icon": "leaf.fill", "color": "#D98F4A", "names": ["Windfall", "…"] }],
  "characters": [{ "id": "harvest-hare", "name": "Harvest Hare", "coreChains": ["nature:orchard", "nature:garden"], "guestChains": [], "narrativeTheme": "…" }],
  "skins": [], "families": [], "mergeGenerators": [], "islands": [],
  "storyTiles": [{ "id": "harvest-grove", "coord": { "q": 3, "r": -2 }, "unlockId": "harvest-grove:reveal", "name": "…", "companion": "mossprout", "revealPreset": "mist-clear", "alphaBoundsKey": "tile:harvest-grove", "lines": { "reveal": "…" } }],
  "missions": [{ "id": "mission:harvest-grove", "storageKey": "…", "required": 14, "mechanic": { "kind": "column-shot", "…": "…" }, "seed": { "…": "…" }, "guides": { "…": "…" }, "wisps": [], "lines": { "…": "…" } }],
  "chapters": [], "conversations": [], "flows": [],
  "art": { "tile:harvest-grove:full": { "url": "https://…/harvest_grove_hex_tile.webp", "bytes": 231044, "md5": "…", "alphaBounds": { "left": 20, "top": 120, "right": 1000, "bottom": 900 } } }
}
```

`contentSchemaVersion` is gated against `CONTENT_SCHEMA_VERSION` (`types/content-pack.ts`); raise it when the shape of an entry changes so older apps refuse newer packs.

## Art keys

| Key | Read by |
| --- | --- |
| `tile:<tileId>:full`, `:medium`, `:thumb` | `hatchableTileArt`, `storyTileArt` (`constants/*/tile-art.ts`) |
| `island:<islandId>:full` and `island:<islandId>:level:<n>:full` (medium/thumb optional) | `natureIslandArt` in the hex scene |
| `cutout:<companion>` | the Garden lesson's closing scene |
| `creature:<visualKey>` | `creatureVisual` (`constants/home-mvp.ts`), the Kingdom and every card |
| `item:<chainId>:<tier>` | `mergeWorldItemArt` |
| `wisp:<wispId>`, `wisp:<wispId>:thumb` | `wispAsset` |

Resolution is `utils/art-source.ts`: registered pack art first, then the bundled table. A tile's `alphaBounds` travels with its `:full` art entry and is registered under the art key and the bare tile key (`utils/hex-alpha-bounds.ts`); measure it with `python scripts/generate-hex-tile-bounds.py --json bounds.json --dir <folder of full hex webps>`.

## Publishing

1. Author the document; check it in Developer Tools > Content Packs (paste, or Bundled fixture) until it is accepted.
2. Upload the art to the `content-pack-art` bucket under `<packId>/<version>/…`; fill each entry's `url`, `bytes` and `md5`.
   Upload through the Supabase dashboard (Storage > content-pack-art): this project's storage is on the legacy infrastructure and `supabase storage cp` refuses it. Sizes and MD5s: `python -c "import hashlib,sys;d=open(sys.argv[1],'rb').read();print(len(d),hashlib.md5(d).hexdigest())" <file>`. The fixture's stand-in files (the Old Grove tile, Mossprout's cut-out, the Garden chain, renamed) are staged at `.tmp-content-pack-art/harvest-2026/1/` at the repo root, untracked; the fixture already names their bucket urls, sizes and checksums.
3. Insert a row in `content_packs` (`supabase/migrations/20260917120000_create_content_packs.sql`): `id`, `version`, `content_schema_version`, `manifest` (the document), `min_app_version`, `starts_at`, `ends_at`, `enabled`.
   The table, bucket and RPC were applied to the linked project (`ecwlxvidbrvatqtyttpw`) on Sept 17 2026 with `supabase db query --linked -f <migration>` and recorded with `supabase migration repair --status applied 20260917120000`, because the remote is missing every migration since 2026-08-13 and a plain `db push` would apply all of them; the migration is idempotent so a later push is safe.
4. The app calls `get_content_pack_v1(app_version, schema_version)` after its first render (`features/content-packs/content-pack-provider.tsx`), downloads and verifies the art, saves the pack and plays it from the next launch. Set `enabled = false` (or let the window close) to retire it.

## Developer Tools

Content Packs (live ops): fetch a document by URL, paste one, or load the bundled fixture; every issue is listed; Activate downloads the art and restarts; Put away removes it and restarts. The screen also shows what is playing now and whether any registry was built before the pack was primed (an import-order regression).
