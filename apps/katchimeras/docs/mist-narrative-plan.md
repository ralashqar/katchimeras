# The Mist, told properly: a narrative plan

Status: built Sept 11, 2026, all four phases plus the phase-2 pass over the rest of the first session (sections 2.5 and 3.4) and the Petalimp and Fernip pass (section 4.1), with the recommended taste calls (Mistwisps named once per mission, sly not scary, Mossprout's hatch tied to the first clearing, the Kingdom's scope named once at the farewell). Section 1 is the lore bible every future line should come from; sections 2 to 4 record what each line was and what it became. The mechanics it leans on are: the Mist over every
tile, the docked mission boards that clear it, the corruption wisps that take the merges' Glow and fall one
by one, the Glow spend from the top bar, and the friends' island boards. The words the player reads still
come from before all that ("Two of the same, put together", "Something was left in there"), and they
under-sell what is on screen. This plan rewrites the first session (Mossprout, then Steppling) and sets
the frame the island friends will follow.

## 1. The lore bible (one page, the source of every line)

**The Mist.** A forgetting. It settles wherever nothing has been noticed for long enough: a garden nobody
looked at, a clearing nobody walked. It is not evil; it is absence. It is heavy, slow, and it holds.

**The wisps.** Where the Mist has held long enough it thickens into wisps: small, sly, greedy things with
hot eyes, the Mist given faces. They do not attack. They *keep*. They sit over a place and feed on its
silence, and they hate light because light means someone is looking. Three or four of them can hold a
whole tile. They flinch when Glow strikes them; they fall when they have taken all they can; the Mist over
that place lifts when the last one goes. Player-facing name, to decide (taste call, section 6):
**Mistwisps** (recommended), **Hushes**, or plain **wisps**.

**Glow.** Light made by noticing. Every merge makes some (two things brought together is an act of
attention); every honest answer makes some; every day lived and marked makes some. Glow is the only thing
the Mist cannot hold. On the board it flies at the wisps; on the map it buys a clearing.

**Friends.** They did not leave. They were forgotten, and the Mist closed over them. Each one is still
where they were: Mossprout in the garden, Steppling on the trail, Petalimp in the welcome garden, Fernip
under the ferns. Clearing a place does not summon a friend; it lets you see the one who was there all
along.

**The Kingdom.** A world being remembered back, one tile at a time. Mossprout's wish, once told, is the
spine: *every place we bring back brings a friend home*.

**The player.** The one who noticed. Not a hero, not a chosen one: the first person in a long while to
look. The verb of power in every line is *notice / look / see*; the enemy verb is *hold / keep / forget*.

**Voice rules.**
- Stakes without menace: wisps are greedy and sly, never frightening. A child can read every line.
- Second person, present tense, short. One image per line. No exclamation marks in the Mist's presence;
  save them for friends.
- The Mist is described by what it does to attention ("nobody has looked here in years"), never by
  weather words alone.
- Friends are warm and a little funny. Mossprout is gentle and precise; Steppling is eager and tender.
- Numbers only where the player acts on them ("three of them hold this clearing").

## 2. Mossprout's first session, beat by beat

Each row: the beat, what the player sees, the current line, the proposed line, and where it lives. IDs
are save data and never change; only the strings do.

### 2.1 The opening (world.mist_open, world.mist_clear, world.mist_lift)

| Beat | Current | Proposed |
| --- | --- | --- |
| Caption 1 (`openingNoticed`) | Nothing here has been noticed in a long while. | Nobody has looked at this place in a very long time. |
| Caption 2 (`openingArrived`) | Then you arrived. | The Mist came in behind them and stayed. Then you looked. |
| CTA (`lookCloser`) | Look closer | Look closer |
| Board eyebrow | Making light | Something is holding it |
| Board title (`mistClearTitle`) | Two of the same, put together. | Three of them have this garden. Make light and they'll flinch. |
| Board body (`mistClearBody`) | Drag one onto the other. | Two of the same, together: that's light. Drag one Seed onto the other. |
| Bar title (dock `barTitle` default) | Clear the Mist | Drive off the Mist |
| Action description (`world.clear_mist`) | Merge eight pairs. | Every merge strikes a wisp. Fell all three. |
| Lift (`mistThins`) | The Mist thins where someone is being noticed. | The last one goes, and the Mist has nothing left to hold with. |
| Egg (`eggHeardYou`) | And this one heard you. | And something under it heard you looking. |

**New beats inside the board (reactive lines, section 5):** first strike ("It felt that."), first wisp
down ("One gone. Two still hold it."), second down ("One left, and it knows."), last ("Now look.").

### 2.2 Meeting Mossprout (companion.first_meeting, nickname, bond, garden_intro, order_preview)

| Key | Current | Proposed |
| --- | --- | --- |
| `seedOrigin` | What you told me is already something. Let's give it soil. | You looked, and the Mist let go of me. What you just told me is the first light I've felt in years. Let's give it soil. |
| `bond` | Every honest answer is a little light. I felt it. | Every honest answer is light. That's how I got out. |
| `planted` | There. Now it needs a little light around it. | There. It'll grow if we keep looking at it. Light, then. |
| `mergePurpose` | Come, I'll show you how we make some. | Come. I'll show you how we make more of it. |
| `growth` | Look. Your day is growing in my garden. That's how this works. | Look. Your day is growing here. The Mist can't hold a place someone is watching. |
| `nextRequest` | Every request makes a little light. Light wakes places, and places wake friends. | Every request makes light. Light pushes the Mist back. Behind the Mist there are more of us. |
| `farewell` | I need to rest… Someone's close. Look at the mist. | I need to rest; roots do. When I wake I'll show you the trail. Something in the Mist there moves when you do. |
| `meditationHelp` | The garden stays open. Something in the mist is still waiting. | The garden stays open. Past it, the Mist is still holding someone. |
| Greeting reply `garden` | My Garden. It's been quiet for a while… | My garden. The Mist had it for years. It's ours again now, mostly. |

The hatch replies (`mossprout-ftue-conversations.ts`, keyed by the day and help answers) keep their shape;
each gains one clause tying the answer to light. Example: *radiant* → "I felt a burst of sunshine through
the shell. The Mist hates that. I'm glad we get to share it."

### 2.3 The first restore (world.first_bloom_offer, world.first_bloom_restore)

| Key | Current | Proposed |
| --- | --- | --- |
| `world.open_first_bloom_upgrade` title | See the light | See what the light does |
| `world.restore_with_first_bloom` | Wake the garden / Spend the light on… | Wake the garden / Spend the light; the Mist gives ground where it's spent. |
| `world.complete_first_bloom_restore` | Garden awake | Garden awake |

The Glow spend now visibly leaves the top bar for the tile; the copy should say so once: "Glow spent here
stays here."

### 2.4 The Glow lesson (glow-discovery-flow.ts)

| Node | Current | Proposed |
| --- | --- | --- |
| `garden.open` | Someone's in there / Back to the board. / One more request should be enough light. | Someone's in there / Back to the board. / The trail past the garden is held too. One more request's light should be enough to reach it. |
| `lesson.single.spawn` | Let's make enough light to see them. / Tap the Basket twice. | Let's make enough light to see who it's holding. / Tap the Basket twice. |
| `lesson.single.seeds` | Making light / Put the two Seeds together. | Making light / Two of the same, together. |
| echo beats | There's a X stuck in the grey. Bring it its twin. | The Mist has a X. Its twin will pull it free. |
| `lesson.single.serve` | That's the one. Give it here. | That's the one. Give it here, and I'll turn it into light. |
| `gateway.ready` | Enough light / That should do it. / Let's see who's in there. | Enough light / That should reach. / Come and see who the trail was hiding. |
| `gateway.offer` | The mist / Tap the glowing bubble. / Something was left in there. | Held / Tap the glowing bubble. / Four of them have the trail. Spend the light and they'll show themselves. |
| `gateway.egg` | An Egg / So someone is being noticed again. / … | An Egg / So the trail was keeping someone. / You noticed something out in your world today. This is what that did. Go on. That's you. |

### 2.5 The rest of the first session (phase 2, Sept 11, 2026)

Everything after the first restore, in the same voice. The rule for this stretch: the Mist keeps
shapes it has not finished forgetting (that is what a Dream Echo is), a twin makes it let go, and
Energy is light the player already made by looking at their day.

| Step | Current | Now |
| --- | --- | --- |
| `companion.first_meeting` eyebrow | A friend | Out of the Mist |
| `companion.nickname` | A new friend / A nickname is optional and stays on this device. | A name to keep / The Mist takes names first. A nickname is optional and stays on this device. |
| `companion.bond_intro` | You are friends now / Bond grows when you spend time together. | Remembered / Bond is the part the Mist can't take. It grows when you spend time together. |
| `companion.order_preview` | Seed of your intention / Let's plant it before we fix anything. / The Garden is still neglected, but there is one patch of open soil. | Your Memory / Let's plant it before we do anything else. / The Mist still has most of the garden. There's one patch of soil it let go of. |
| `world.garden_arrival` | Here. The soil's still soft. | Here. The soil's still soft where the Mist lifted. |
| `world.garden_handoff` | Let's earn some Glow. / Complete requests in the Garden to help restore this place. | Let's make some light. / Every request you serve here is light. Light is what pushes the Mist back. |
| `merge.seed_drag` | Two of the same, put together. Go on. | Two of the same, together. You know this one. |
| `merge.first_bloom` | Now those two. Something bigger wants to happen. | Now those two. Something bigger is trying to come back. |
| `world.first_seed_grew` | Look. Your day is growing in my garden. / That's how this works. | Look. Your day is growing here. / The Mist can't hold a place someone is watching. |
| `merge.plant.spawn_echo` | Something in the mist / Mossprout can see something waiting nearby. | Something in the Mist / The Mist is keeping a shape near here. Mossprout can almost see it. |
| `merge.plant.clear_seed_echo` | Merge with its match in the mist. / The cell will wake… | The Mist has a Seed. Give it its twin. / Two of the same, and the Mist has to let go. The cell wakes, and the Seed keeps growing. |
| `merge.plant.clear_sprout_echo` | A half-remembered Plant / Dream Echoes hold shapes the garden remembers. | Half remembered / A Dream Echo is a shape the Mist hasn't finished forgetting. Match it with your Sprout and it comes back whole. |
| `merge.plant.serve_home_plant` | The first planting / Give the remembered Plant to Mossprout. | Brought back / Give Mossprout the Plant you pulled out of the Mist. |
| `merge.energy.spawn_pair` | One more sleeping cell / The last nearby Echo needs a Plant. | One more held cell / The last Echo near here is a Plant. The Mist won't give it up for less. |
| `merge.energy.low` | We're running low (mojibake in source) / Your day made this Energy before. | We're running low. / The Energy we've been spending came from your day. Tell me a little more of it. |
| `energy.capture` | One answer is enough. | One honest answer is enough. That's how light gets made. |
| `energy.reward` | Your memory became Energy / Your memories give us energy. | Noticed / You looked at your day, and it became something we can spend. |
| `energy.steps_offer` | Your movement can give Mossprout a little more. | Yesterday's steps were light too, even if nobody counted them. |
| `energy.return` | The garden is waiting for you. | The garden is waiting, and so is the last held cell. |
| `merge.energy.clear_plant_echo` | Your day reached the mist / The Plant will bloom as the cell opens. | Your day reached the Mist / Give the Mist its twin and it lets go. The Plant blooms as the cell opens. |
| `merge.energy.serve_plant` | You did it / Your memory woke this part of the garden. | Remembered / Your day did this. The Mist has no hold on this part of the garden now. |
| `merge.open_note` | The garden is ready. | The garden is awake. |
| `companion.chapter_zero_return` | The Grove changed. / See what you and Mossprout grew together. | The Grove remembers. / See what you and Mossprout brought back. |
| `companion.bond_spotlight` body | It grows through meaningful moments… Merge play cannot grind it. | It grows through real moments with Mossprout, across real days. The Mist can't take it, and Merge play can't grind it. |
| `companion.water_response` body | Mossprout responds before turning the moment into your first Seed. | Mossprout keeps what you noticed. That's one more thing the Mist doesn't get. |
| `companion.meditating` action | Look at the mist / Someone is close. | Look at the Mist / Someone's still in there. |
| `companion.resident_affinity` body | Your answers prepare a veiled parcel without giving away who is inside. | Your answers reach whoever the Mist is keeping nearest. A veiled parcel comes back, without giving away who sent it. |
| `companion.resident_parcel` body | Something small answered the First Bloom. | Something small answered the light. It came through the Mist to get here. |
| `merge.resident_parcel` body | There is a sealed card waiting inside. | There's a sealed card inside. The Mist couldn't read it. |
| `merge.reveal_resident` eyebrow | The Grove noticed a match | Two of the same |
| `merge.meet_resident` body | They have their own request for the garden. | They've been in the Mist a while. They have a request of their own. |
| `merge.resident.clear_seed_echo` | A Seed in the mist / Match the locked Seed. / …under the clouds. | A Seed in the Mist / The Mist has a Seed. Give it its twin. / …under the Mist. |
| `merge.resident.clear_sprout_echo` | A Sprout in the mist / Match the locked Sprout. | A Sprout in the Mist / And a Sprout. Same again. |
| `merge.resident.card` body | This resident is now part of Mossprout's garden set. | Remembered, and kept. This resident is part of Mossprout's garden set now. |
| `companion.resident_match_result` eyebrow | Petalimp found a home | Petalimp, remembered |
| `haven.open_mossprout_upgrade` body | Tap the garden marker to see what your Glow can restore. | Tap the garden marker to see what your light can bring back. |
| `haven.mossprout.restore` | Glow earned through Merge can permanently change this place. / Turn the forgotten clearing into… | Light you made in Merge, spent here. The Mist doesn't come back where it's been spent. / Bring the clearing back as Mossprout's first garden. |

Mossprout's conversation nodes (`constants/mossprout-ftue-conversations.ts`, `features/onboarding/mossprout-first-grow.ts`):

| Node | Current | Now |
| --- | --- | --- |
| `hello` | I'm Mossprout. I think I was the last one awake. | I'm Mossprout. I was the last one the Mist took, so I was the first one out. |
| opening `default` | Your answers found me in the dark. | Your answers found me in the Mist. |
| first-rest `seed-settles` reply | That was a lot of growing for one day. | That was a lot of growing for one day. A lot of remembering, too. |
| first-rest `roots` reply | When I wake up, tell me what you'd like us to grow next. | When I wake, tell me what you'd like us to grow next. And keep looking. It's what holds the Mist off. |
| first-rest `end` | I'll keep your Memory close. | I'll keep your Memory close. It won't be forgotten here. |
| `MOSSPROUT_GARDEN_RETURN.prompt` | …I was beginning to think this garden was made entirely of fog. | …I'd half forgotten it was there. That's what the Mist does. |
| garden-return replies | We did… / We keep finding little things… | We did. You brought one piece of your day, and the Mist had to make room for it. / We keep noticing little things. Every one is light, and there's room for all of it here. |
| first-notice replies | one clause each | light: An ordinary corner, looked at. The Mist never gets those. / sound: Listening counts as looking. / growing: Things grow better noticed. |

Left alone on purpose: the five Egg questions, the day-one action questions (`companion.day_one_action`), the reflection check (`companion.first_insight`), the Energy step counts, and Steppling's trail chats and walking-focus prompts. They are about the player's life, not the Mist, and the bible says the Mist is never mentioned where it would crowd that out.

## 3. Steppling, beat by beat

### 3.1 The clearing (steppling-mission.ts board steps)

| Beat | Current | Proposed |
| --- | --- | --- |
| Locker found | Left in the mist / A Journey Locker. / Tap it to make a Sock. | Left in the Mist / A Journey Locker, still packed. / Tap it. Whoever packed it isn't far. |
| First merge | Clear the Mist / Walking gear, put together. / Every merge thins the mist. The Locker makes more Socks. | Four of them hold the trail / Walking gear, put together. / Every merge strikes one. The Locker makes more Socks. |
| Free play | Clear the Mist / Keep merging. / Tap the Locker whenever you run short of Socks. | Keep striking / Keep merging. / Tap the Locker whenever you run short. |
| Bar title | Clear the Mist | Drive off the Mist |

**Reactive beats:** first wisp down ("One gone. The trail's already brighter."), last ("The last one falls.
Look what it was sitting on.").

### 3.2 The Egg and the hatch (steppling-egg-policy.ts)

| Key | Current | Proposed |
| --- | --- | --- |
| `intent` | A new Egg / This one moves when you do. | Under the Mist / This one moves when you do. |
| `steps` | Yesterday's steps / Your steps are light too. Feed them in. | Yesterday's steps / Every step you took today was light the Mist never got. Feed them in. |
| `movement` | Your own rhythm / Steps are one way. Not the only one. | Your own rhythm / Steps are one way to make light. Not the only one. |
| `ready` | Awake / That woke someone. | Awake / The Mist is off it. Someone's waking. |

### 3.3 Day one and the garden lesson (steppling-day-one-copy.ts, steppling-garden-lesson.ts)

| Key | Current | Proposed |
| --- | --- | --- |
| `STEPPLING_DAY_ONE_OPENING` | I packed for a journey. Mostly snacks. What would feel good today? | I packed for a journey, then the Mist packed me. Mostly snacks survived. What would feel good today? |
| handoff `walk` | Your pace, then. Today's steps count here. I brought a parcel for our Garden—shall we take a look? | Your pace, then. Every step is light the Mist doesn't get. I brought a parcel for the garden. Shall we look? |
| handoff `adapted` / `rest` | … | same shape, each with one Mist clause |
| parcel guide | A parcel from Steppling! / Tap to see what he brought. | A parcel from Steppling! / He kept it through the whole Mist. Tap to open it. |
| locker guide | Steppling's Journey Locker. / Tap it to make walking gear. | Steppling's Journey Locker. / Yours now. Tap it to make walking gear. |
| serve guide | Steppling needs a Shoe. / Serve his request to earn Glow. | Steppling needs a Shoe. / Serve it, and the light is yours to spend. |
| `STEPPLING_GARDEN_CLOSING` | A Shoe, some Glow, and our first little adventure… | A Shoe, some light, and the first stretch of trail the Mist doesn't own. We can keep going, at your pace. |

### 3.4 After the lesson (phase 2)

| Key | Current | Now |
| --- | --- | --- |
| garden lesson `summary` | Your world grows with you | Your world grows where you look |
| day-one conversation `end` | A little parcel is waiting in our Garden. | A little parcel is waiting in our Garden. I carried it the whole way through. |
| legacy `discovery.steppling.parcel` body | Something inside matches the object beneath the clouds. | Something inside matches the object the Mist is holding. |

## 4. The Kingdom frame and the island friends

Set once the first session is over, so Petalimp and Fernip inherit it.

- **Mossprout's wish** (engine message `Every place we bring back brings a friend home.` and the wish
  guide): "Look at how much of it is still grey. Every place we bring back brings a friend home. Start with
  the one that's closest."
- **Progress tracker** (`kingdom-progress.ts`): "The next friend is deeper in the Mist. Keep making light."
  becomes "The Mist still holds the next one. Keep making light."
- **Mist offers** (`world-upgrade-offers.ts`): "Clear the mist and discover who is waiting here." becomes
  "Spend light here and see who the Mist was keeping."
- **Petalimp / Fernip campaign copy** (`mistNextName`, `mistDescription`, `discoveryDialogue`,
  `revealReactionLine`, `speech`): each friend's mist copy names the wisps' hold without naming the friend:
  Petalimp: "A forgotten garden / Something in there is still arranging flowers for nobody, and something
  else is making sure nobody looks." Fernip: "A tangled grove / Someone's resting under there. Something
  heavier is resting on them."
- **Restoration board bar** (`barTitle={`Restore ${islandName}`}`): "Drive the Mist from Bloom Garden".
- **Panel state labels** `board_open: 'Clearing the mist'` → "Driving off the Mist";
  `delivery_requested` speech: "This patch has given all it had. What the Mist still holds is waiting on
  your board." (already close; keep).
- **Petalimp's checkpoint hint** (the one FTUE beat on a friend's board): "This patch has given all it had.
  Serve Petalimp's request on the Merge board and bring back what the Mist is keeping."

### 4.1 Petalimp and Fernip, line by line (Sept 11, 2026)

Both campaigns now speak the bible. The personal question in every chapter is untouched; the Mist is
in the situation around it. Each chapter names the Mistwisps once, in the prompt or in the line that
hands off to the board, with the count the board actually shows (three over a short bar, four over a
long one). Every return line says the same mechanical thing in the friend's voice: set the delivery
down and the Mist lets go. Lowercase "mist" as weather is gone from both files, and a test in each
campaign's suite keeps it that way (no "!" in a line that names the Mist, the wisps named at most once
before the board, no lowercase mist).

**Petalimp** (`constants/island-campaigns/petalimp-bloom.ts`), the Welcome Garden the Mist kept while
Petalimp tidied it for nobody:

| Beat | Current | Now |
| --- | --- | --- |
| Discovery | I followed one stubborn glimmer through the mist. It led me to a Welcome Garden that has forgotten how to bloom. | You looked this way, and the Mist let go of me. This was a Welcome Garden once. It forgot what it was for, and so did I, nearly. Will you help me remind it? |
| Reveal | The mist lifts from a quiet, bare garden. | The Mist lifts from a bare garden. The beds are tidy. Someone has been here all along. |
| Ch1 prompt | This used to be a Welcome Garden. Right now it is just soil and one hopeful gardener. | This was a Welcome Garden. The Mist took the welcome first, then the garden, and left me the tidying. Right now it is soil, one hopeful gardener, and three Mistwisps sitting on the beds. |
| Ch1 hand-offs | Let's make it together in Merge. / …permission to see what happens. / That sounds like a beginning we can share. | Make a little light on the beds and watch what the Mist does. / …see what the Mist does when something new happens under it. / …the Mist has two people looking at it, which it has never liked. |
| Ch1 returns | The soil is ready, and the first restoration is my gift. | Set it in the bed and the Mist lets go. This first patch is my gift. (each style keeps its own line) |
| Ch1 resolutions | …not waiting alone anymore. / …remembering how to surprise us. / Perhaps I only needed company. | …it isn't forgotten anymore. Nor am I. / (kept) / Perhaps I only needed someone to look. |
| Ch2 prompt | I have been arranging the next beds in perfectly matching rows… | The Mist moved off it and settled on the next beds instead, so I arranged them in perfectly matching rows underneath it… |
| Ch2 hand-offs | one familiar corner / beds, not boundaries / a corner hoping for a visit | each adds: Three Mistwisps have the colour beds. Make light and they'll give ground. / …they do not like change. Let's give them some. / Between the two of us, that is not enough of them. |
| Ch3 prompt | The butterflies ignore it completely… | The Mist sat down on the rest of it, four Mistwisps thick, and the butterflies ignore all of us. |
| Ch3 hand-offs | Merge can help us mark the first. / …one worth arriving at. / Let's shape its first turn. | Make light on the path and the Mist gives up the next bend, and only the next. / …somewhere the Mist has been sitting. / The Mist has the first turn. Let's go and be two people looking at it. |
| Ch4 prompt | Some flowers have appeared far outside their beds. | …right at the edge of what the Mist still holds. |
| Ch4 hand-offs | honouring every small thing / not my tidy first draft / together | Four Mistwisps have the last patch. They are about to see a great deal of light. / Four Mistwisps are holding the old plan. They can keep it. / Four Mistwisps have the last patch, and we have each other. |
| Ch4 returns | When the Glow comes… / The final bloom is only waiting on us. / We have everything except the last of the Glow… | Set them down and let the whole garden remember how far it has come. / Set it down and the Mist can keep my first draft, for all I care. / Set it down together. I know now that asking for that help is part of growing, and the Mist never learned it. |
| Panel (short of Glow) | The mist can wait a little. | The beds will keep until there is light enough. |
| Fallback return / resolution | The garden can grow whenever we have the Glow. / We restored more than a garden; we made a welcome. | Set it down and the Mist has to let go. / Every bloom found room. The Mist has nothing left here to keep. |
| Wake hand-off | Then you noticed one. Someone else is resting in the Wildgrowth… | Then you noticed one, and the Mist couldn't keep me. Past the beds, the Wildgrowth is still under it. Someone is resting in there. |
| Sleeping hint | Someone is resting in this garden. | The Mist is keeping someone in this garden. They will wake once the friend before them is home. |
| Wisp captions (new `copy.wispLines`) | shared island lines | Oh. It felt that. / One gone. It was sitting on my beds. / Another gone. Look, the soil. / One left, and it knows. / The last one goes. Look at the beds. |

**Fernip** (`constants/island-campaigns/fernip-wildgrowth.ts`), the grove held down while Fernip
rested under it. Fernip's arc already had the right idea ("Resting is not the same as being forgotten");
the pass capitalises the Mist throughout, gives the wisps a name once per chapter, and stops the Mist
from being right about anything:

| Beat | Current | Now |
| --- | --- | --- |
| Discovery | I was resting under the ferns and the mist just… thinned. | I was resting under the ferns, and then someone looked this way and the Mist went thin. |
| Reveal | The mist drifts off a tangled, sleeping grove. | The Mist drifts off a tangled grove. Something under the ferns stretches. |
| Ch1 prompt | Then the mist came down over it, and the moss stopped, mid-wander. | …Three Mistwisps are sitting on it now, being very still, as if that counts as resting. |
| Ch1 hand-offs | The mist can come off this patch slowly. / Let's clear it a patch to lean in. / The mist can keep the rest for now. | …Make a little light and watch it flinch. / The Mist has no idea what to do with that. / (capitalised) |
| Ch1 resolution (unhurried) | That is the only pace it knows, and it seems to work. | The Mist never got the hang of that pace. It seems to work. |
| Ch2 hand-offs | Let's see how far the mist will move. / The mist is hiding at least three mushrooms… / Let's start where the mist is thinnest. | Four Mistwisps have the log. They are the wrong kind of quiet. / Four Mistwisps are sitting on at least three mushrooms I have not counted. / Four Mistwisps have the door. Let's start where they are thinnest. |
| Ch3 prompt | …the mist came back over the mess as if to say: leave it. Honestly they were both right. | …the Mist settled back over the mess, four Mistwisps deep, as if to say: leave it. The vines were right. The Mist was not, but it does a very good impression. |
| Ch3 hand-offs | The mist can decide what stays tangled. / …what the mist has been hiding. / The mist only needs to hear it once. | The vines can decide what stays tangled. The Mist does not get a vote. / …what the Mist has been keeping in there. / (capitalised) |
| Ch4 prompt | …the last of the mist glows back at them. | …the last of the Mist flinches every time they do. |
| Ch4 hand-offs | The last of the mist is in no hurry either. / …what the mist has been giggling about. / The mist has kept that corner for last. | Four Mistwisps have the last corner, and they are in no hurry either. We will see who is more patient. / Four Mistwisps are sitting on the last corner, being serious at it. Let's ruin that. / Four Mistwisps have kept that corner for last. They would. |
| Ch4 returns | …the last of the mist can glow itself away / finish being ridiculous / let the grove be what it is. | …go the way the rest went / leave the ridiculous to us / (capitalised) |
| Payoff closing | The grove will keep glowing whether we look or not. That is what rest is for. | The grove will keep glowing. Once a place has been looked at properly, the Mist cannot get it back. Rest is like that too. |
| Panel (available) | The moss is under there somewhere. | The moss is under the Mist somewhere. |
| Fallback resolution (4) | The whole wild corner is glowing. I did not tidy a single thing. | …glowing, and the Mist has nothing left to hold. I did not tidy a single thing. |
| Wake hand-off | Resting is not the same as being forgotten. I had confused the two. | …The Mist would like you to confuse the two. I did, for a while. |
| Sleeping hint | Someone is resting under the ferns. | …and the Mist is resting on them. |
| Wisp captions (new `copy.wispLines`) | shared island lines | It felt that. Good. / One gone. The moss noticed. / Another gone. No hurry. / One left, and it looks tired. / The last one goes. Look what was resting under it. |

Mechanic added for this: `IslandCampaignCopy.wispLines` (optional). The Kingdom uses a friend's own
lines over their board when authored and the shared `ISLAND_WISP_LINES` otherwise, so the four friends
without boards need nothing. Pinned labels kept as they were: "A forgotten garden", "Meet me at Bloom
Garden", "Back to the ferns", "Choose how this part of the garden should grow."

## 5. New mechanics the drama needs (small)

1. **Reactive wisp lines.** A short caption over the board on: first strike, each wisp's fall, the last
   fall. Source: the wisp hook already knows strikes and states; add `onWispFell(index, remaining)` and
   `onFirstStrike` to `useCorruptionWisps`, and a `MissionCaption` (reuse `KingdomOpeningCaption`'s
   presentation, one line, 1.6 s, no button) fed from an authored table per mission
   (`OPENING_WISP_LINES`, `STEPPLING_WISP_LINES`, a generic `ISLAND_WISP_LINES` keyed by friend).
2. **Counts in guides.** The board guide's title takes the wisp count from the spec (`OPENING_WISPS.length`)
   so the copy never drifts from the mechanic.
3. **The lift line.** `mistThins` shows only after the last wisp has fallen (it already waits for the
   landing; the wisp-fall delay is in). No change beyond copy.
4. **A name.** Decide the player-facing name for the wisps (section 6) and use it in at most one line per
   mission; everywhere else "them" / "one" is stronger.

Nothing here touches save ids, flows' node graphs, or receipts.

## 6. Decisions for you (taste calls)

1. **Wisp name:** Mistwisps / Hushes / wisps. Recommended: *Mistwisps* in the one naming line, "them"
   elsewhere.
2. **Tone ceiling:** the proposal keeps wisps sly, not scary. If you want a touch more threat, the lever is
   the wisps' hunger ("it's been feeding on this garden for years"), not their looks.
3. **Mossprout's origin:** proposed as "the Mist had me; you looked, so it let go" (ties the hatch to the
   first clearing). Alternative: keep the Egg mysterious and only imply it.
4. **How much the first session names the Kingdom's scope.** Proposed: one line at the farewell ("behind the
   Mist there are more of us"), nothing more until the wish.

## 7. Implementation map and order

Phase 1, Mossprout's opening and meeting (`mossprout-ftue-copy.ts`, the `world.mist_*` step actions in
`mossprout-ftue-script.ts`, `mossprout-ftue-conversations.ts`, dock `barTitle` default). Pins to update:
`tests/opening-mist-dock.test.ts` (bar title default), any test matching `Two of the same`. Story flows
untouched (graphs unchanged).

Phase 2, Steppling (`steppling-mission.ts` guides, `steppling-egg-policy.ts`, `steppling-day-one-copy.ts`,
`steppling-garden-lesson.ts`, `glow-discovery-flow.ts` scene guides). Pins: `tests/steppling-mission.test.ts`
and `tests/steppling-encounter.test.ts` if they match copy; `verify:story-flows` re-run (copy inside flow
nodes changes the flow's authored snapshot only if a test pins it).

Phase 3, the Kingdom frame and island friends (`kingdom-progress.ts`, `world-upgrade-offers.ts`, the wish
guide, `petalimp-bloom.ts` and `fernip-wildgrowth.ts` copy blocks, `island-restoration-dock.tsx` bar title,
the checkpoint hint in the Kingdom screen). Pins: `tests/petalimp-island-campaign.test.ts` (state labels),
`tests/fernip-island-campaign.test.ts` (return lines mention the mist: keep that rule), the registry test's
"mist copy never names the friend".

Phase 4, reactive wisp lines (section 5.1): the hook callbacks, the caption, the three line tables, tests
for the callback order (first strike once, one line per fall, the last line on the last fall).

Each phase is one commit and one device pass. Copy changes are Metro-reload changes, no native build.
