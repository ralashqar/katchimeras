# The Wide World: regions around the Sanctuary

Sept 26 2026. Cozy 4X v2, after Chapter 10: the lands beyond the Hollow Tree.

**Status:** Region 2's foundation and its first chapter are built. Everything else here is design.

## Why

- **The cast is far bigger than the game uses.** The catalogue has 25 Katchimera families and about 190 forms. The main quest uses 13 of them: Mossprout's garden forms, Steppling, Baristabbit and Feastle.
- **The ending already points onward.** Chapter 10 ends on "Someone else is keeping a lamp lit."
- **The idea:** every family gets a home in the wider world, grouped into regions by theme. Each region grows around a landmark the player has been able to see from the start.

## The map: a flower of petals

- **The centre (Region 1)** is the Sanctuary: the Heart Tree, and rings 1 to 3.
- **Six landmarks** stand four cells out from the centre, one in each hex direction.
- **Each landmark is the heart of a region, or "petal".** A region holds:
  - its landmark;
  - the landmark's first ring: its families' homes, plus the doorstep cell facing the Sanctuary;
  - the landmark's second ring: its Frontier and its islands.
- **Where petals meet,** a cell belongs to the nearest landmark. On an exact tie it stays wild Frontier.
- **On the horizon from the start:** the landmarks are drawn misted and faint, the way the Hollow Tree always has been. Every region is a visible goal long before it is reached.
- **Why this shape:** the world grows outward in every direction, so the map never becomes a long corridor. The camera always has a centre (the Heart Tree), and each region reads as its own neighbourhood.

```
            [N]  Hollow Tree      Region 2  The Hollow Reaches
   [NW] Mist's Heart   [NE] Sleeping Lighthouse   Region 3  The Night Shore
            ( Sanctuary )
   [SW] Glade Stage    [SE] Old Clocktower        Region 4  The Busy Hills
            [S]  Lantern Hall     Region 5  The Bright Commons
   Region 6: The Showtime Glade (SW)     Region 7: The Mist's Heart (NW), the finale
```

## The regions

Each region has a keeper (its first friend, the one who kept a light), three or four more families, a new kind of wisp, and a landmark restored at its end.

| # | Region | Landmark | Theme | Keeper | Families | Region wisp idea |
|---|---|---|---|---|---|---|
| 2 | The Hollow Reaches (N) | the Hollow Tree | Remembering: the first Sanctuary | **Dawnle** (keeps the lamp, the first light) | Relicoon (old things), Pagelet (stories), Museling (art) | *Hush* wisps: a whole lane falls silent (no plant fires) while they stand |
| 3 | The Night Shore (NE) | the Sleeping Lighthouse | Rest and care | **Bedrotte** | Snuglet, Shellio, Mendle, Heartmote | *Drowsy* wisps: plants they pass fall asleep until a merge wakes them |
| 4 | The Busy Hills (SE) | the Old Clocktower | Doing things | **Tasklet** | Errandimp, Flexel, Voyagle | *Clockwork* wisps: they speed up every time one is left standing too long |
| 5 | The Bright Commons (S) | the Lantern Hall | Together | **Gatherglow** | Cheerlet, Kindling, Skylo | *Crowd* wisps: they march side by side and share their damage |
| 6 | The Showtime Glade (SW) | the Glade Stage | Play and performance | **Encora** | Flickerbun, Pixooka, Waglet | *Encore* wisps: once, they come back after falling |
| 7 | The Mist's Heart (NW) | the Grey Well | The source | none | none | The last forgetting: every kind at once |

That covers all 21 families not in the main quest.

## A region's shape

1. **Doorstep:** the cell between the Sanctuary's ring 3 and the landmark (Region 2's is the Hollow Tree's doorstep, already built).
2. **The keeper's signal:** a light in the Mist on the keeper's home. It uses the same beacon and silhouette as Chapter 1's lit window.
3. **The keeper's rescue:** a Lanes rescue battle docked under their home. Their home clears with them standing on it; their arrival scene follows; they become a hero with an ability.
4. **The region's Frontier:** its second-ring cells. They are lit once the region is open and fought for like the Sanctuary's. Mist Surges reach them too.
5. **The other families:** one chapter each. A signal, a rescue, their home, a hero ability, and a form or two found on their land.
6. **Forms:** each family's forms (Relicoon's Timepaw, Fossilfin, Curiootter…) are found in their family's levels over time and join the roster. This is the collection layer; it comes after the first families.
7. **The finale:** a boss at the landmark, which is then restored. The next region's signal flares.

## Region 2, the Hollow Reaches: chapters

| Ch | Title | What happens |
|---|---|---|
| 11 | The Lamp Beyond | Dawnle's light past the Hollow Tree. Rescue Dawnle (Lanes rescue), push into the Reaches' Frontier, train Dawnle. **Built.** |
| 12 | The Keeper of Old Things | Relicoon guards what the first Sanctuary left behind. Hush wisps first appear. |
| 13 | The Story Tree | Pagelet's pages are blank; the Mist took the words. |
| 14 | The Painted Hollow | Museling's colours, the Reaches' last family. |
| 15 | The Reaches Remember | The region finale: a boss at the Hollow Tree's crown, and the Sleeping Lighthouse's signal (Region 3). |

## Built now (Region 2 foundation)

- **`constants/regions.ts`:** the regions, their landmarks, the petal geometry (`regionCells`), and which cells hold homes.
- **Region friends** (`constants/region-friends.ts`): the lightweight way a region's friends join. There is no egg, flow or journal.
  - Each friend is a placed home tile, a Lanes rescue battle (`rescue:<friend>`, the ledger's key), an arrival scene, and a hero with an ability.
  - The first is Dawnle: the Lamp House, and the ability First Light.
- **The Reaches' Frontier:** its second-ring cells are Frontier tiles gated on the Hollow Tree being restored.
- **Chapter 11, The Lamp Beyond.**
- **Events** (`constants/sanctuary-events.ts`): Wisp Rush (the time trial) and Mist Puzzles (the territory mode, the daily three). One Events button and sheet.
