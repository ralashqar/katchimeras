# The Last Clearing: the cozy 4X first session

Status: **steps 1 to 5 built Sept 24 2026** (the whole first session, cold open to home). Step 1: story graph v57, the cold open, the guardian, and Mossprout from the first frame. Step 2: the first battle is a scripted Lanes level that cannot be lost (`constants/last-clearing-battle.ts`, `forgiving` lanes push a breaching wisp back). Mossprout speaks lines over the board, and the story moves on the `battle_won` event. First battle, reworked (Sept 24 2026, per the user) into a dense Steppling-style chain:
- **Start:** five Seeds on the bottom row, one Seed asleep under half Mist above them, and the rest under full Mist. Seeds sit on row four, Sprouts on row three, and two Plants on row two.
- **Waking:** each wake (a twin onto a sleeper) makes the piece one tier up and opens the full Mist beside it. The finger guides every wake (`firstBattleGuide`).
- **Seeds:** new Seeds land only in the bottom two rows (`seeds.area`).
- **Wisps:** 13 in waves across every lane: the first down the middle, then a pair, then a spitter and its partner, then three, then all five lanes together.

Step 3 (graph v58):
- The veil lift is the Mist's retreat, with the lines "We did it" / "We actually did it".
- `world.heart_tree` pushes the camera in on the Heartwood, and Mossprout's two lines bring **Restore the Heart Tree**.
- The first light flies from the counter, `restoreHeartTree` is written (once, idempotent), and the Heartwood crossblends from dormant to stirring under the field of light.
- A **Sanctuary Founded** title card follows.

Deferred from beat 9: the little structures appearing, which come with Sanctuary buildings.

Step 4 (graph v59 / script v57):
- `world.frontier`: a slow `fit_targets` pull-out, with the minimum zoom lowered to 0.16 for this beat, and a top-placed **The First Grove** card with Mossprout's two lines.
- `world.lost_tracks`: the camera drifts to the Lost Trail. Mossprout's lines are followed by **Look closer**, then the ordinary finger and spotlight on the trail tile, which is tapped.
- `world.lost_trail_mission`: the **Follow the Lost Trail** card.

The new art went through the shared-world hex pipeline (`art-source/katchimeras/shared-world-discovery-v2`: `lost-trail-tracks`, `lost-trail`, `hollow-tree`):
- The Lost Trail is a story tile (`constants/story-tiles/lost-trail.ts`). While misted, it keeps its own tracks art (`mistedAlphaBoundsKey`), with Steppling's silhouette breathing in its Mist (`lostSkinId`, drawn at runtime).
- The Hollow Tree is a landmark layer at (0,-4), past the rings.

Step 5 (graph v60 / script v58):
- **The trail battles:** `world.trail_stone_1..3` are three forgiving Lanes battles docked under the Lost Trail tile (`LOST_TRAIL_BATTLES`). Each opens with its own card, and the Kingdom docks them through the same scripted-battle slot and finger as the first battle (`scriptedBattleGuide`):
  - The Trail In, with a quick wisp;
  - Mist Rows;
  - Someone's in There: a new `rescue` objective. Steppling sits under thick Mist on cell 17, drawn as a silhouette in the cell. The battle is won with every wisp down and that cell cleared, and the finger steers merges toward it.
- **`world.steppling_rescued`:** the Lost Trail crossblends from tracks to the cleared path.
- **`world.steppling_meets`:** Steppling's tile opens with him home (the new `rescueWorldFriend` command: free, no Egg). Then his card reveal (the existing modal) and his first words.
- **`effect.haven.steppling_joins`:** guarantees both writes.
- **`world.steppling_joined`:** a card.
- **`world.home`:** *"Welcome home, Wayfinder."* The first session ends here.

Deferred: the first Sanctuary goal (the Explorer's Lodge), which comes with Sanctuary buildings. Step 6, the test cleanup, is still to come. This is the first focus of the cozy 4X direction (`cozy-4x-direction` in memory; the full game spec was handed over the same day). It replaces the companion-life first session: the Egg and its questions, the hatch meeting, the Garden planting, the first rest and meditation, and the Glow-ticket Steppling discovery.

It ends with the player knowing four things:

- I have a home.
- The world is covered in Mist.
- I can push it back.
- There are more Katchimeras out there.

## 1. Lore bible v2 (one page; every line comes from here)

This keeps the Sept 11 bible's heart (`docs/mist-narrative-plan.md` §1) and changes who the player is.

- **The Mist.** A forgetting. *"The Mist doesn't destroy things. It makes the world forget what they were."*
  - It settles, spreads and holds.
  - It swallows paths first, so every place ends up alone.
  - Nobody knows where it came from; early lines never say.
  - It is purple, slow, magical and a little threatening, never horror.
- **Wisps.** The Mist given faces: small, sly, greedy, with hot eyes.
  - They do not rage; they *take*.
  - They come down on what is still bright, and they spit Mist on it.
  - Light is the one thing they cannot hold.
- **Glow.** Light made by living things brought together.
  - Merge two sprouts and they grow into something that shines.
  - Plants that shine shoot Glow upward, and Glow is what the Mist cannot hold.
  - This is why Katchimeras, who are made of living light, can resist it.
- **The Sanctuaries.** Long ago, clearings joined by trails, rivers and old pathways. Each had a Heart Tree.
  - The Mist cut the paths, and the Sanctuaries went dark one by one.
  - The Last Clearing is the last one still lit, barely.
- **The Wayfinder.** The player.
  - Old stories say that when the paths are lost, a Wayfinder comes and walks them back into being.
  - Nobody believed it. Mossprout half did.
  - The Wayfinder does not fight like a soldier. They *restore*: plant, merge, rebuild, reconnect.
  - The verbs of power are *restore / reclaim / reconnect / grow*. The Mist's verbs are *take / hold / forget*.
- **Katchimeras.** Heroes, not pets.
  - Each is from a real place in the world, and each was cut off when the Mist came.
  - They join the Sanctuary because it is the first place in a long time that is fighting back.
- **Voice rules** (kept from v1, plus stakes):
  - Short lines, one image each, and a child can read every one.
  - Friends may use exclamation marks; the Mist's presence never does.
  - The stakes are real: the clearing *is* the last one, and Mossprout *is* tired.
  - It stays cozy: nobody is hurt on screen, and what the Mist takes can be brought back.
  - Mossprout is gentle, precise, brave while scared, a little dry. Steppling is eager, fast and big-hearted.

## 2. The script, beat by beat

| # | Beat | On screen | Lines | Player does |
|---|---|---|---|---|
| 1 | **Cold open** | Black. White text fades in and out, one line at a time. Then the camera sinks through a sea of rolling purple Mist, slowly, until one small lit clearing shows below: a dim Heart Tree, a few weeds. | *"Once, every path led somewhere."* · *"Then the Mist came, and the world began to forget."* · *"One clearing still remembers."* | Nothing (tap to hurry) |
| 2 | **The guardian** | The camera settles on the clearing. Mossprout stands at the Heart Tree's roots, facing the Mist, leaf drooping, clearly exhausted. It turns and sees you. | Mossprout: *"Oh! You're real."* · *"The old stories said a Wayfinder would come when the paths were lost."* · *"I didn't believe them either. Not really."* | Tap to continue |
| 3 | **They found us** | The Mist at the clearing's edge darkens and stirs. Two hot eyes open in it, then more. The Kingdom dims, the board rises: the clearing's soil. Two Seeds already sit in it. | Mossprout: *"They found us."* · *"Quick. The Heart Tree's seeds. Put two together, they grow into something that shines."* | Merge the two Seeds (hand guide) |
| 4 | **First light** | The Sprout pops up, squashes and stretches, and fires a Glow seed straight up. A wisp high over that column flinches, then bursts. | Mossprout: *"It works! They hate the light."* | Watch |
| 5 | **The Mist pushes** | Seeds keep arriving. A wisp high over another column spits Mist onto the board: a cell goes purple. The hand guide points at merging beside it; lightning strikes it open. | Mossprout: *"It's spitting Mist at us."* · *"Grow something right beside it. The light burns it off."* | Merge beside the Mist |
| 6 | **Last stand** | A wave of three at once, down different columns. A one-time prompt: two Sprouts cover two lanes, one Plant hits harder in one. | Mossprout: *"Three of them. Every lane."* · *"Two small ones cover more ground. One big one hits harder. Your call, Wayfinder."* | Play the wave out |
| 7 | **The Mist retreats** | The last wisp bursts. The board lowers. The Mist around the clearing *rolls back* one ring, and colour floods the ground. | Mossprout: *"We did it."* · *"We actually did it."* | Tap to continue |
| 8 | **The Heart Tree** | The camera pushes in on the Heart Tree, grey and cracked. The Glow you won is counted up in the corner. | Mossprout: *"This is the Heart Tree. Every Sanctuary had one."* · *"Ours is barely holding on. Your light could wake it."* | **Restore the Heart Tree** (spend Glow) |
| 9 | **The Sanctuary** | The full restoration sequence: roots light up, leaves burst out, a warm glow spreads, and a few little structures appear. A title card: **SANCTUARY FOUNDED**. | Mossprout: *"A Sanctuary again. The first one in… a very long time."* | Tap to continue |
| 10 | **The frontier** | The camera pulls out, and keeps pulling out. The lit clearing shrinks to a speck. Nearly everything is Mist. Far away, one enormous grey tree pokes above it. A title card: **THE FIRST GROVE**. | Mossprout: *"That's all Mist. All of it."* · *"And that… is the Hollow Tree. Nobody goes near it anymore."* | Tap to continue |
| 11 | **Tracks** | The camera drifts to the clearing's edge: a trail tile, half in the Mist. Small footprints lead in, and do not come out. A small silhouette, just visible, far inside. | Mossprout: *"Wait."* · *"Someone came through here. Recently."* · *"Someone's still in there."* | Tap the trail |
| 12 | **Follow the Lost Trail** | A mission card: **FOLLOW THE LOST TRAIL**. The trail's level track opens: three stones, the last one a rescue. | Mossprout: *"We can't leave them out there. Let's go."* | Enter the first stone |
| 13 | **The Lost Trail** | Three short battles down the trail, each teaching one thing: a faster wisp, Mist rows, then the rescue. On the last board a trapped cell sits under thick Mist, a silhouette inside; clear the wisps and the Mist around it. | Steppling (muffled, from the cell): *"Hello? Is someone out there?"* | Play three battles |
| 14 | **Steppling joins** | The Mist bursts off the cell. Steppling tumbles out. The hero reveal (existing celebration), then a banner: **STEPPLING HAS JOINED YOUR SANCTUARY**. | Steppling: *"You came for me? Nobody comes into the Mist!"* · *"That path used to go all the way to the sea."* · *"Guess we'll have to make it go there again."* | Continue |
| 15 | **Home** | Back at the Sanctuary: Steppling walks in, looks around, waves at Mossprout. The first Sanctuary goal appears (build the Explorer's Lodge). The first session is over. | Mossprout: *"Welcome home, Wayfinder."* | Free play |

**Drama tools,** all built from things the game already has:
- the Kingdom dim behind a board;
- the Mist canopy;
- the camera glide and pull-out;
- the island-lift restoration sequence;
- the friend reveal celebration;
- wisp spits and board lightning.

**New pieces:**
- black-screen lore lines;
- title cards (a big serif card that fades in and out);
- the pull-out to the whole map with the Hollow Tree silhouette;
- the trail tile's footprints and silhouette.

## 3. How it is built

- **Story graph.** The first session is a new `MOSSPROUT_FTUE_FLOW` manifest: version 57, fresh save, no migration. Its beats:
  - `world.cold_open` → `world.guardian` → `battle.first_light` (a task: win the scripted Lanes battle)
  - → `world.mist_retreat` → `world.heart_tree` (an effect: restore it, reusing the world-upgrade presentation)
  - → `world.sanctuary_founded` → `world.frontier` (camera pull-out) → `world.lost_tracks` → `mission.lost_trail` (effect: open the trail's track) → complete.
- **The first battle** is a Lanes level with a scripted opening, not a free level:
  - Two Seeds, then one wisp. Seeds arrive slowly at first.
  - A spit is forced on beat 5, and the three-wisp wave comes on beat 6.
  - The guidance uses the existing merge guide overlay (spotlight and finger) and the friend's speech bubble over the board.
  - It cannot be lost: a wisp reaching the bottom row is pushed back, and Mossprout says a line.
- **The Lost Trail** is a region campaign pack like Petalimp's: three levels on a level track, the last one a **rescue** objective. Rescue is new: a trapped cell under Thick Mist; the level is won when every wisp is down and its Mist is cleared.
  - Winning it runs the friend reveal (existing) and a join banner (new, from the discovery celebration).
- **Removed from the first session:**
  - the Egg and its questions;
  - `companion.first_meeting` / Bond / meditation;
  - the Garden planting;
  - the Glow ticket to Steppling's clearing;
  - the pedometer ask.

  Their code stays; the manifest no longer reaches it.
- **What stays the same:** the Kingdom screen, the camera system, the docked board, Lanes, and the upgrade and restoration presentations.

## 4. Build order

1. **Story graph and cold open:** the new manifest, the lore lines, the guardian conversation. Mossprout stands at the Heart Tree from the first frame (no egg).
2. **The first battle, scripted:** the opening Lanes level, its guided beats, and "cannot be lost".
3. **Retreat, Heart Tree and Sanctuary Founded:** the Mist ring rolling back, the Heart Tree restore, the title card.
4. **Frontier and tracks:** the pull-out, the Hollow Tree silhouette, the trail tile and the silhouette.
5. **The Lost Trail:** three levels, the rescue objective, Steppling's reveal and join banner, and the first Sanctuary goal.
6. **Tests:** the new manifest's validation, a bot playthrough of each battle, and the retired first-session tests removed.

Each step ends playable on device.
