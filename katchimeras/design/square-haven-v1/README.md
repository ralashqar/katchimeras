# Mossprout nature world

Mossprout's Haven is a single pannable floating world built around two core
islands and six independently upgradeable nature islands. The main Katchimera
island sits at the top centre and the persistent merge-board island sits below
it. The six smaller islands form three balanced side rows:

| Position | Island |
| --- | --- |
| Upper left | Seed Nursery |
| Upper right | Bloom Garden |
| Middle left | Pond Sanctuary |
| Middle right | Orchard Grove |
| Lower left | Ancient Tree Grove |
| Lower right | Wildgrowth Grove |

The former Baristabbit and Egg Home satellite islands are not part of the
Mossprout runtime scene. There are no bridges, ropes, or connector lines between
the new islands. Empty sky keeps each silhouette readable at the initial fitted
camera scale.

## Progression

The first Mossprout restoration reveals all six nature islands at level 1.
After that, each island upgrades independently through levels 2, 3, and 4. The
existing Mossprout tier prices are distributed across the six islands: 400
coins in total for level 2, 900 for level 3, and 1,800 for level 4. Existing
story gates still control when a tier is available.

Every island follows the shared visual rhythm of small natural patch,
cultivated area, lush garden, and magical thriving biome. An island tap focuses
the camera and opens its detail sheet with the current form, next form, story
requirement, coin price, and upgrade action. Upgrade state is persisted per
island. Saves from schema versions 18-20 preserve the restored main island and
story progress while starting the six new satellites at level 1.

## Runtime composition

The core Mossprout environment retains its approved transparent square-island
art. The live merge board uses a dedicated orthographic portrait `1024x1488`
floating-island master with `512x744` and `256x372` runtime LODs. Its central lawn
is intentionally empty; the app projects the 7x9 checkerboard, hit targets,
items, Mist, effects, and selection states over calibrated source-space corners.
Order chairs remain independent dynamic runtime layers. Each nature island has a bespoke generated
Level 4 master under `design/mossprout-nature-islands-v1/max-level/`, art-directed
from the approved Mossprout composition and live main-island render. The runtime
uses optimized 1024, 512, and 256 WebP tiers with genuine alpha. Until bespoke
early stages exist, every visible level uses its island's final-form master;
progression and upgrade UI still advance normally while the art remains stable.
Future Level 1-3 art should be derived backwards from these masters so camera,
silhouette, landmarks, and relative scale remain stable across every stage.

The painted source bounds and nature-island interaction frames are owned by
`utils/haven-square-world.ts`. Scene construction lives in
`components/katchadeck/world/mossprout-square-scene.ts`; components must derive
placement and hit areas from those scene frames rather than duplicating world
coordinates. The persistent Mossprout board now exposes the complete canonical
7-by-9 row-major state, preserving every stored occupant and authored Mist cell.

Rebuild and review the portrait board with:

```powershell
npm run art:haven:portrait-board
npm run art:haven:portrait-board:qa
```

The player Katchimera, egg, merge sprites, status markers, interaction targets,
and upgrade effects remain live runtime layers. The previous hex renderer and
older island art remain available to developer surfaces and have not been
deleted.
