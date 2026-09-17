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
   Upload through the Supabase dashboard (Storage > content-pack-art): this project's storage is on the legacy infrastructure and `supabase storage cp` refuses it. The stand-in files of the two bundled fixtures are staged at `.tmp-content-pack-art/<packId>/<version>/` at the repo root, untracked; each fixture already names their bucket urls, sizes and checksums.
   A hex tile's art comes out of the shared-world recipe pack-ready (all from `apps/katchimeras`, repo-root paths as shown):
   ```
   python scripts/generate-shared-world-discovery-art.py generate --tile wanderling-trail      # a briefs.json entry; review source.png
   python scripts/generate-shared-world-discovery-art.py matte --tile wanderling-trail         # review alpha.png
   python scripts/generate-shared-world-discovery-art.py package --tile wanderling-trail --out-dir ../../.tmp-content-pack-art/wanderling-trail/1 --pack-tile-id wanderling-trail
   python scripts/generate-hex-tile-bounds.py --dir ../../.tmp-content-pack-art/wanderling-trail/1 --json bounds.json
   python scripts/assemble-content-pack-art.py --manifest data/content-packs/wanderling-trail.json --dir ../../.tmp-content-pack-art/wanderling-trail/1 --bounds bounds.json --base-url https://ecwlxvidbrvatqtyttpw.supabase.co/storage/v1/object/public/content-pack-art/wanderling-trail/1 --write
   ```
   `package --out-dir` writes `tile-<id>-full.webp` (1024), `-medium` (512) and `-thumb` (256) and leaves the bundled tree and `kingdom-hex-tile-bounds.gen.ts` alone; the bounds script measures `tile-*-full.webp` under `--dir`; the assembler fills `bytes`, `md5`, the `:full` entry's `alphaBounds` and, with `--base-url`, the urls, for the keys the manifest already names (keys are authored, never guessed from file names). A brief entry names `base` (the Mossprout hex, camera authority), an optional `guide` (identity and palette only, for a form its bundled cut-out) and a prompt that reserves the front clearing for the resident.
3. Insert a row in `content_packs` (`supabase/migrations/20260917120000_create_content_packs.sql`): `id`, `version`, `content_schema_version`, `manifest` (the document), `min_app_version`, `starts_at`, `ends_at`, `enabled`.
   The table, bucket and RPC were applied to the linked project (`ecwlxvidbrvatqtyttpw`) on Sept 17 2026 with `supabase db query --linked -f <migration>` and recorded with `supabase migration repair --status applied 20260917120000`, because the remote is missing every migration since 2026-08-13 and a plain `db push` would apply all of them; the migration is idempotent so a later push is safe.
4. The app calls `get_content_pack_v1(app_version, schema_version)` after its first render (`features/content-packs/content-pack-provider.tsx`), downloads and verifies the art, saves the pack and plays it from the next launch. Set `enabled = false` (or let the window close) to retire it.

## Bundled packs

A pack can ship inside the app: `features/content-packs/bundled-packs.ts` lists them, every registry reads them before any installed pack, and the validator treats what they bring as part of the bundle (a later pack cannot bring the same ids, sit on the same hex or continue the same chapter). Their art is bundled under the ordinary keys, so they carry no `art` map: a story tile's `alphaBoundsKey` names its bundled hex file and its art is an entry in `constants/story-tiles/tile-art.ts`, packaged with `package-transparent-hex-tile.py --key <assetKey>` (bounds regenerate). The Wander Trail (`data/content-packs/wanderling-trail.json`) is the first bundled pack, an island story (below). `tests/bundled-content-packs.test.ts` proves each one is accepted against the rest of the bundle and read from the first launch.

## A friend's island as pack content (schema 6)

A pack may bring `islands` (a nature island: coord, four levels, art under `island:<id>:full` unless the id is in `constants/nature-island-art-ids.ts`, whose art the scene bundles) and `islandCampaigns` (the same `IslandCampaignDefinition` Petalimp's story is authored as: resident form, four chapters with three answers, requests, optional restoration boards with a `mechanic`, payoff, copy). A campaign may say when its island wakes with `wake`: `friend_hatched` (a companion out of their Egg), `friend_home` (a form's card owned) or `always`; without it the bundled wake order applies. Its chapters compile to conversations spoken by the resident form; the card it earns belongs to that form's own family. The Wander Trail (`data/content-packs/wanderling-trail.json`) is authored this way: west of Steppling's tile, asleep until Steppling hatches, then offered with Wanderling's silhouette and a Glow cost like any friend's island; its first chapter is a column-shot board (tier damage, overflow lost, shots drift to the nearest wisp so a delivery is always what finishes it).

## A place with a resident form, and a board that can miss (schema 5)

A story tile may name `residentSkinId`: a form of its `companion`'s family who stands on the tile once its mist has cleared, drawn as that friend's owned slot (the shared resident stage and the form's bundled cut-out) but as its own creature (`utils/story-tile-residents.ts`). A chapter may name `speakerSkinId`: the form who speaks its compiled episodes (`constants/companion-journey-chapters/episode-conversation.ts`). Both must exist and belong to the friend's family; a conversation's `speakerSkinId` and an episode's `conversationId` must exist too. A form's arc is a continuation (`afterChapterId`) of the friend's chapter, so it opens once that chapter is complete; Developer Tools > Journey tools > "Finish Steppling's chapter 1" records the chapter complete for a device run. Tapping the resident opens the plain creature sheet in this first pass.

A column-shot board with `emptyColumn: "lost"` (and usually `overflow: "lost"`) is one where a merge under empty sky wastes the shot. Such a board cannot promise that every path finishes, so the walk (`features/mission-mechanics/validate.ts`) checks instead that at every position reached by hitting, a hit is still at hand, sliding a piece under a wisp first if need be, and that hitting all the way ends the board; the finger never points at a miss (the `free` guide says to slide a piece under a wisp); and a board with nothing left to merge and wisps standing offers its seed again with the damage kept ("More pieces drift in", `store.reseed`). The bundled pack `data/content-packs/wanderling-trail.json` is all of this: the Wander Trail west of Steppling's tile with Wanderling on it, an arc after The Path Outside in Wanderling's voice, and a lost-column board of Steppling's own chain.

## Developer Tools

Content Packs (live ops): fetch a document by URL, paste one, or load the bundled fixture; every issue is listed; Activate downloads the art and restarts; Put away removes it and restarts. The screen also shows what is playing now and whether any registry was built before the pack was primed (an import-order regression).
