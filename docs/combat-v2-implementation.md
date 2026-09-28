# Combat v2 implementation

Enabled by default in the dedicated battle scene. Set `EXPO_PUBLIC_COMBAT_V2=0` and restart Metro to author new battles with the legacy rules. Setting `EXPO_PUBLIC_BATTLE_SCENE=0` also selects legacy content. Saved attempts retain their rules and frozen loadout.

## Playing the update

- Open a frontier tile or a bundled friend-island mission. The preparation screen offers Garden plus one support generator, its role, and the recommended hero level. A teaching mission loans its suggested generator before the permanent unlock.
- Bulwark unlocks after Explorer’s Lodge, Dew after The Signal, Lantern after The Kitchen. Spark is available from the start of this combat progression.
- Expeditions open after The Signal. The existing event/level-track entry now contains three UTC daily battles. After the first Heart Tree defence, three difficulty choices for the weekly guardian appear in the same track. The guardian rotates every Monday UTC.
- Frontier first clears offer extra Timber or Glow in preparation. The existing completion receipt pays the choice once. Surges no longer remove held territory or its income; existing contested land is restored by normalization.

## Mechanics

Plants have hearts equal to their tier. A lethal hit downgrades one tier, restores that tier’s hearts, and grants 750 ms of grace. A seed is destroyed. Moving preserves identity and damage; merging heals and clears frost. Bomber binding retains identity through save/load and cleansing.

| Chain | Role |
| --- | --- |
| Garden | Long-range single-lane fire; each merge gives 110% of the combined sustained damage of its inputs. |
| Spark | Short-range attacks across lanes, jumps, and stun at high tiers; bypasses Mirror reflection. |
| Bulwark | A reusable explosive wall: contact damages a wisp, knocks survivors upward, and interrupts dashes. Still shields adjacent plants and regenerates shields. |
| Dew | Heals injured neighbours, cleanses from tier 3, and gives a non-stacking firing aura at tier 5. |
| Lantern | Pierces aligned targets; higher tiers hit more enemies. |

Combat merges send a short-range burst. Echo ground strengthens it. Sunny ground increases firing speed; puddles slow enemies and strengthen Spark; stone blocks planting; vents periodically freeze an exposed plant or mist an empty cell.

Gunner targets a fixed cell with a warning, Bomber marks a cross, Burrower marks its emergence point, and Mirror alternates reflection every four seconds. Moving out of marked cells dodges the attack. Enemy guardians reduce damage by 50%; overlapping guardians never create immunity.

The sanctuary has three hearts. Ordinary breaches cost one and bosses cost three. Explicit waves have a five-second preparation period with a Start Wave button. Combat time, passive production, healing, attacks, and ability use/charge pause during preparation; rearrangement and merging remain available. Grades depend on hearts lost and assistance, and results show duration and shielded hits.

## Progression

Hero attack scales by 8% per level above 1, capped at level 10. Building benefits are copied into the battle session, included in its identity, and retained when resuming. This also fixes the dedicated scene’s missing hero-building snapshot.

Existing buildings supply the progression: Nursery improves seeds; Cellar milestones add shield capacity and support pace; Dew Spring improves healing and grants an opening shield at level 9; Bloom House improves support production. Existing Fern slowdown and economic buildings remain relevant. Tree level 8 now permits level-10 buildings.

Lead passives add support: Mossprout improves shields at level 6, Drizzlet improves healing, Petalimp improves support pace, Fernip slows enemies, and Steppling extends warnings. Helper Resolve perks grant an opening shield, delay perks slow enemies, and charge/reward perks retain their benefits. Shellio’s combat Ripple grants shields; Rainfall also heals. Existing hero abilities remain usable.

## Content and art

`apps/katchimeras/constants/combat-campaign.ts` defines 24 lessons/remixes and three three-phase bosses: Bramble Sentinel, Stormglass Matron, and Hollow Heart. Frontier and bundled island missions use these definitions while keeping their progression IDs. Daily missions remix the catalogue by a stable date seed; weekly mission IDs include Monday and difficulty.

There are 24 new approved sprites: 15 plants, three generators, four enemies, and two bosses. Hollow Heart reuses its existing art. Runtime base textures total about 545 KB, with 128/256 enemy variants. Source images and generation metadata live in `art-source/katchimeras/combat-v2`; static Metro maps come from:

```powershell
python tooling/art-pipeline/scripts/build-combat-v2-art.py
python tooling/art-pipeline/scripts/build-combat-wisp-lods.py
```

Terrain, warnings, health, and shield markers use lightweight native UI; no additional raster atlases are required.

## Validation and tuning

The balance runner exercises the real encounter state, generator commands, merge settlement, wave clock, and building profile. It checks five representative lessons over 100 seeds with and without progression, plus the three bosses. The careful bot does not use hero abilities, so these are reproducible balance checks, not predictions of human win rates.

The late lesson at recommended level 9 measured **35/100 wins without upgrades and 100/100 with the recommended profile**. The upgraded run averages 114 seconds; failed untrained runs end sooner. The runner requires at least an 85% upgraded win rate and a 20-point upgrade advantage on this encounter.

Run from `apps/katchimeras`:

```powershell
node --import tsx scripts/combat-balance.ts 100
node --import tsx scripts/combat-balance.ts 100 late
node --import tsx --test tests/combat-v2.test.ts tests/battle-session.test.ts tests/battle-route.test.tsx tests/battle-persistence.test.ts tests/encounter-abilities.test.ts tests/encounter-rewards.test.ts tests/encounter-team.test.ts
node --import tsx --test tests/frontier.test.ts tests/daily-mist.test.ts tests/heart-tree.test.ts tests/hero-buildings.test.ts tests/encounter-lanes.test.ts tests/spark-chain.test.ts
```

Checks cover wave ordering/preparation, hearts/downgrades, shields, healing, reflection, warning dodges, support selection, UTC rotation, save identity, first-clear salvage, duplicate rewards, frontier income, and authored encounter fairness. TypeScript passes. The iOS JavaScript/assets export passes. Lint has no errors; existing large modules still produce warnings.

Physical-device checks remain: narrow-screen HUD/warning readability, rapid drag/merge input, background/resume during warnings, and prolonged combat frame time. Web export is currently blocked by the existing `react-native-maps` import in `components/dev/photo-place-lab.tsx`; no signed iOS build or deployment was performed.

### Bulwark contact bursts

Contact includes lane entry, a sideways weaver, crawler attacks, and placing a wall under a wisp. Frozen walls cannot burst. Each plant has its own saved recharge; the wall remains after exploding. Killed enemies are not knocked back, and splitter deaths still spawn their children.

| Tier | Base damage | Push (rows) | Brief hold | Recharge |
| --- | --- | --- | --- | --- |
| 1 | 0.5 | 0.25 | 250 ms | 6.1 s |
| 2 | 2 | 0.55 | 350 ms | 5.7 s |
| 3 | 4 | 0.85 | 450 ms | 5.3 s |
| 4 | 7 | 1.15 | 550 ms | 4.9 s |
| 5 | 11 | 1.45 | 650 ms | 4.5 s |

Hero damage upgrades also strengthen the impact. The plant grows, compresses, and settles while a mint/gold particle shockwave expands; higher tiers use more particles and a larger wave. Reduced motion uses a short flash. These finite effects run on the UI thread and clean up on unmount.

Regression coverage: `tests/bulwark-impact.test.ts`, `tests/wall-impact-burst.test.tsx`, and the impact assertions in `tests/retained-sprite-slots.test.tsx`.
