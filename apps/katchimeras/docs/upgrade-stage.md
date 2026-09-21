# Upgrade stage

One layout for everything that is upgraded in the Kingdom: the subject is framed
in the top of the screen and a full-width panel docks over the bottom. Tile
upgrades, the Wisp Lantern, a resident's Haven details and a hidden friend's
tile use it today. The reference is Whiteout Survival's building
upgrade screen: the building as the hero above, level, gains, requirements with
a way to go and meet them, and one pinned action below.

## Layout

`features/upgrade-stage/upgrade-stage-layout.ts` decides the split before
anything mounts: `upgradeStageLayout(viewport, insets)` returns the panel's
height (about 54% of the screen, 60% on phones shorter than 700 points, clamped
to 360–600) and width (edge to edge, a 600-point column on tablets), and the
band left above it under the HUD (`stageTop`, `stageHeight`, `stageCenterY`).
Because the height is known up front, the camera is sent to its final target
while the panel is still sliding in. Nothing measures itself and nothing waits
for the camera to settle.

## Camera

The canvas frames the selected tile into the band with
`camera.focusFrame(frame, { fitHeight, screenCenterY, unbounded })`.
`fitHeight` fits the frame to the band instead of the whole viewport, and
`unbounded` keeps an edge tile where it was asked to be instead of letting the
scene bounds pull it back under the panel. The camera it left is restored on
close unless the purchase committed.

When FTUE already owns the close-up (`preserveUpgradeCamera`), its zoom is kept
and no return snapshot is saved. The tile is only lifted into the band, and put
back where FTUE framed it when the panel closes or the purchase commits.

An upgrade offer is framed from its own `visualTarget`. Anything else on the
stage is passed to the canvas as `upgradeStageSubject` (`{ id, target }`) and
framed by the same effect: the Haven details and the hidden-friend notice both
use `{ kind: 'haven_tile', familyId }`. The Haven subject shares its id with the
tile's offer (`haven:<family>`), so Restore hands over to the upgrade panel
without the camera moving.

When a purchase is confirmed the panel leaves and the whole screen is the tile's
again. The reveal that follows (mist lifting, an island growing) assumes a
close-up (`cameraAlreadyFocused`), so the canvas zooms the framed tile to the
full screen at that moment, before the mist clears; the band above the panel had
framed it far smaller. A tutorial-owned close-up is lowered back instead.

The Lantern is an adornment on the `front-right` garden plot, so the screen
frames it with a camera directive whose `anchorY` comes from the same layout.

## Panel

The panel's structure follows Whiteout Survival's building panel, in the game's
own palette. From top to bottom, in `components/katchadeck/upgrade/`:

1. **Title** (`UpgradeDock`), on the wood frame: the subject's name, under it a
   green `Lv. N` pill and a quiet tagline (an island's theme), a progress gauge
   on the right (`62%` towards the next level, the same Glow percent the tile's
   marker shows; `2 / 5` for a board in progress; `MAX`; green when full), and
   close. It is the swipe handle. A tile still under the mist shows no level.
2. **Body card**: cream, rounded all the way round and set into the frame, so
   the wood shows on every side.
3. **Hero row** (`UpgradeHero`, pinned at the top of the card): the level's
   name, a leaf rule, its description, and the action at full width (the shared
   compact Glow CTA) with a short status pill under it (`Free`, `Reached`, an
   error). It carries no picture of the subject: the tile is framed right above
   the panel, and the height goes to the tile instead. Only something held or
   hidden gets a small picture (the friend resting there, the lock, the mist).
   A friend's chapter starts from a button that reads `Restore` with its Glow
   cost (or `Free`), not the friend's own sentence for it. The action never
   scrolls, so the tutorial coachmark needs no scrolling either.
4. **Strips** (`UpgradeBenefitRow`): one line per gain, a chip naming it and the
   stat as `3 +1`, or what is unlocked.
5. **Stages** (`UpgradeLevelSlots` in an `UpgradeSection` card): the subject's
   whole road as a chain of slots joined by dots, each with its level on a tag
   at its foot. The road starts at the stage the subject already stands on, so
   the current stage always has a slot: it is pictured there as the world is
   drawing it right now and wears a `Now` tag. Picking a slot shows that level
   in the hero row (it glows gold); only the next level carries the action.
   More than four stages scroll sideways, opened on the stage in play so the
   one before it and the one after it are always on screen. A level gained
   while the panel is up pops its tag with a success haptic.
6. **Requires** (`UpgradeRequirementRow` in a card): an icon well, the name and
   one plain line about it, and have / need in a pill (green with a tick when
   met, red while short). While short it grows a foot with the glossy bar and a
   "Go" that leads to where it can be met.
7. **Tab track** (`tabs` on `UpgradeDock`), only when the panel has more than
   one view: a sunk pill with the selected tab riding in it, each with an icon.
   A tile with dialogue or a friend's chapters gets `Upgrade` and `Story`.

### Header and tabs

The title bar is one line on every panel: the name, then its level pill beside it (a long name truncates before the
pill does). There is no description line; what a place is about is said in the body. On a tile with a story, the
pinned hero (name, description, action) belongs to the Upgrade tab only: the Story tab shows the story and nothing else.

### Levels on screen

A tile counts from 0 in the save (an unrestored tile is 0), but nobody reads a
place as "level 0". The model carries `levelOffset` (1 for tiles and Havens, 0
for the Lantern, which already counts from 1) and every level shown adds it:
the title's `Lv.`, the slot tags, `Reach Level N first`, the `2 / 5` pill.

### No spoilers

What a level will look like is for the world to reveal, not the panel.
`useUpgradeLevelPick` applies one rule everywhere: a reached level shows its own
picture in its slot (the current one as the world draws it now); the level being
bought and anything further on is a question mark, and a level further on reads
`? ? ?` in the hero row. `artFor` is never asked for a level that
has not been reached. A tile still under the mist is pictured as mist.

`useUpgradeDockMotion` owns the behaviour. The dock sits at `zIndex` 60 (not a
Modal, the world stays live above it), slides up, swipes down or closes on
Back, and runs an action only after its 140 ms exit (`leave`). A failed action
brings the retained panel back (`reopen`). `registerDismiss` lets a tap on the
band above close it through the same exit, and `locked` (a guided step) removes
the close button, the swipe and Back. It provides the parchment `KatchaSurface`,
so shared buttons inside it are themed.

Colours come from `constants/upgrade-panel.ts`, which derives them from `GameUI`
and `KatchaSurfacePalette`. Panels name no colours of their own. Level pictures
come from `features/upgrade-stage/upgrade-level-art.ts` (`tileLevelArt`,
`lanternLevelArt`): the world's own art at its smallest size.

### Finish

Everything raised is a `Face` (in `upgrade-rows.tsx`): a two-stop gradient inside
a rim, with a light stroke just inside that rim all the way round. There is no
highlight line along the top edge: a single line read as a scratch, the full
inner stroke reads as a bevelled edge. The frame, the body card, the gauge and
the selected tab carry the same inner stroke. Reached slots are pale sage, the
one being bought is gold, the rest desaturated. A met requirement turns sage.

Two rules keep the rims clean. Corners are plain circular arcs, never the
continuous curve, so a stroke inset by the rim's width stays concentric with
it. And every gradient fill carries its rim's inner radius: `overflow: hidden`
clips children to the rim's outer curve, so a square-cornered fill reaches that
curve at each corner and paints over the rim there.

Depth never comes from a drop shadow on the panel itself: it translates every
frame of its entrance, and the mini-board audit showed what an animated shadow
costs. Only small static children (the picture mount, the picked slot's glow)
carry a shadow.

## Content

`features/upgrade-stage/upgrade-panel-model.ts` is the only place a subject's
rules meet the panel. `tileUpgradeModel(offer, glow)` and
`lanternUpgradeModel(progress)` both return an `UpgradePanelModel`: title,
level, the progress pill's label, every level of the road (from the Haven and
nature-island catalogues; a mist tile is its own one-step road), benefits,
requirements, lock, completion and the primary action. A new
upgradeable subject adds a model function and a thin panel that renders the
rows, as `WorldUpgradePanel` and `WispLanternUpgradePanel` do. A friend's
campaign block (portrait, speech, Merge request, chapter log) is the tile
panel's own content inside the dock.

`HavenDetailPanel` (`components/katchadeck/world/haven-detail-panel.tsx`)
replaces the old night sheet for a resident without a page: the Haven's state,
its road of levels, the Glow requirement, Restore in the hero row (it opens the
tile's upgrade panel) and the story archives as secondary links. The legacy
guided restore locks it open. `UndiscoveredHavenPanel` is the hidden-friend
notice on the same dock. A hatchable Egg's encounter is not on the stage: it is
the Today page's own Egg question widgets, reused as they are.

Heartwood's four economy buildings (`docs/heartwood-buildings.md`) use the same
stage: `buildingUpgradeModel(world, id)` and `HeartwoodBuildingPanel`. Each
stands on its own garden plot, so the screen frames it with the same camera
directive as the Lantern, aimed at the building's plot.

The Lantern hub no longer has an upgrade page. Its Upgrade button closes the hub
and opens the stage, and closing the stage returns to the hub.

## Verification

```
npx tsx --test tests/world-upgrade-layout.test.tsx tests/world-upgrade-v2.test.tsx tests/wisp-lantern-hub.test.tsx tests/haven-detail-panel.test.tsx
npm run typecheck
```

`app/dev-ui-gallery.tsx` opens the docked panel in each state (short of Glow,
ready, held, Lantern milestones, fully grown) without the Kingdom. On a device
check: the tile sits in the band at several zoom levels and at the map edge, the
camera returns on close, both tutorial purchases (the lifted FTUE close-up and
the coachmark on the pinned action), insufficient Glow and its Go, a failed
purchase, a friend's campaign panel on a short phone, the Lantern round trip
from the hub, a pageless resident's Haven details into Restore (the camera must
not move between the two panels), and a hidden friend's tile.
