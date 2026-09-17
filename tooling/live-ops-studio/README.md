# Live Ops Studio

## Create a Katchimera from a template

Open `/new-companion`, or **Create a Katchimera** from `/characters`.
This creates a new hatchable experience for a roster character without one,
such as Bedrotte. Candidates must have an authored Egg question profile.
It reuses the character's existing family, skins,
animations, merge chains and generator. It does not create an unknown species,
new mechanics or a new visual rig.

1. Choose the character, rescue cost, unoccupied hex coordinates and predecessor.
2. Edit the Mist mission, answer-based Egg, first conversation, parcel/merge
   lesson and daily moment. IDs and flow connections are generated. The lesson
   must grow and serve one tier-two item from its generator's tier-one drops.
3. Add Journey episodes and waits. They follow the first-day flow and each other
   in order. The template supplies introductory copy; author the character's
   final narrative before release.
4. Upload tile art and a character cutout, or use the selected character's existing art.
   Still PNG/WebP/JPEG inputs up to 1.8 MB and 4096×4096 pixels are normalized
   into a transparent-padded 1024×1024 WebP. Visible bounds (alpha >=16), sizes
   and hashes are generated. The cutout serves the lesson finale; existing
   roster portraits and animations remain unchanged.
5. Enter the real HTTPS asset hosting folder, then validate and export. Validation
   includes the actual content-pack, flow and mission validators. Draft source
   fingerprints prevent silent reapplication after the template changes.
6. Upload the ZIP's `assets/` files to that folder, keeping filenames unchanged.
   Import `manifest.json` through **Developer Tools → Content Packs** on a test
   profile and restart. No registry editing is required. The app must contain
   the candidate-hatchable validation fix delivered with this editor; build that
   app version once before testing these packs. Content/art installation needs
   connectivity; installed content uses the existing offline pack cache.

Export neither hosts files nor activates production content. Its URLs are intended
destinations, not proof that files exist there. Validate against other planned
releases before promotion. Check rescue gating, mission completion, Egg answers,
hatching, first-day parcel, lesson rewards, Journey progression, daily moment,
restart/resume and offline play on device. Existing installed versions are
immutable; save published IDs and use the release/migration workflow for changes.

Draft versions live under `drafts/new-companions/`, images under its `assets/`
subdirectory. Copy both when moving workstations. Browser autosave is a convenience;
use **Save draft** for a durable version. Starting a fresh template, switching
characters and loading a version first save the current draft.

`tests/new-companion-authoring.test.ts` verifies template validation and an
isolated game boot using Bedrotte's generated pack and offline art references.
That integration test is not a device gameplay test.

## Existing character editor

Open `/characters` or choose **Characters** in Studio. The editor reads the
actual bundled definitions for all five current experiences:

| Character | Editable content |
| --- | --- |
| Mossprout | Journey episodes and linked dialogue, orders, rewards, reflection timing, daily interactions and Old Grove tile copy/art |
| Steppling | Journey, discovery tile and guides, Mist board, Egg requirements, first day, merge tutorial, daily interactions and home tile art |
| Petalimp | Restoration chapters, choice outcomes, orders, board seeds and delivery cells, upgrade costs and five restoration-stage images |
| Baristabbit | Discovery tile and guides, Mist board, Egg requirements, first day, merge tutorial, daily interactions and home tile art |
| Feastle | Seven Journey episodes and orders, discovery tile, Mist board, Egg questions, first day, merge tutorial, food-photo and daily interactions, and hearth tile art |

Select a section, search its fields, and edit copy, item references or numeric
values. Journey dialogue uses the game's compiler; restoration and first-day
choices show their authored outcomes. Validate checks source revision, allowed
paths, item references, numeric bounds, images and board occupancy. It does not
prove puzzle solvability or economy balance. IDs, branching structure, episode
order, mechanics and progression predicates remain protected.

Each character has a separate browser autosave. **Save character draft** stores
versioned files under `drafts/characters/`; loading/resetting first saves the
current workspace. Shared uploaded images are under `drafts/journeys/assets/`.

**Export review bundle** creates a ZIP containing the draft, materialized
definitions, before/after field diff and assigned images. This is **not an
installable content pack**: edits to existing bundled IDs need reviewed source
integration, production art processing, a rebuild and game playtesting. Saving
or exporting never changes shipped gameplay or player saves. New additive arcs
remain available separately at `/arcs`; Mossprout's isolated native dialogue
walkthrough remains at `/journeys`. Character drafts are a separate format.

Restart Studio after changing source definitions. Stale drafts remain saved but
cannot be exported against a different source revision. There is no automatic
rebase or live publishing. Mossprout's initial onboarding, arbitrary new branches,
creature portraits and outfits are outside this editor's current coverage.

Focused checks (from `apps/katchimeras`):
`npx tsx --test tests/character-editor.test.ts`.

Run `npm run live-ops:studio` from the repository root, then open
http://127.0.0.1:5181. This workstation tool is bound to loopback only.

Author event dates (UTC), Harmony eligibility, capped scoring rules and free
reward tiers. Add another event to the same release for overlapping schedules.
Playtest actions use the app's pure scoring engine. Validation uses the actual
game catalogue, including candidate merge chains and collectible references.
The preview assumes an eligible player; it is not server verification.

Save draft writes a versioned JSON file under `drafts/` (ignored by Git).
Refresh drafts and Load draft resume it. Export release downloads a validated
manifest. Release versions already installed by a player cannot be overwritten;
use new release and definition IDs for additive content.

Optional staging environment variables are `LIVE_OPS_SUPABASE_URL` and
`LIVE_OPS_SERVICE_ROLE_KEY`. Set these only to a staging project. The key stays
in the local Node process. Send to staging inserts a **disabled** content pack;
it also stages immutable event definitions through `stage_live_event_definition_v1`.
Event and content-pack database rows remain disabled. Staging freezes each
definition's gameplay flag as enabled inside the disabled release, so later
availability changes do not mutate installed content. Staging never enables a
database row. Repeating event staging is idempotent; conflicting IDs fail.
The server checks Host,
Origin and JSON content type on write requests. It is not a hosted multi-user
admin app and must not be exposed through a public tunnel.

The Moonlit Mist starting document is a disabled scoring/reward draft. It does
not include a playable seasonal Journey, incursion renderer, premium entitlement,
or premium entitlement. Verified server claims now support Gem/Wisp bundles;
the command-replay verifier and other reward deliveries remain dependencies.

## Journey authoring — first slice

Open `/journeys` (or choose **Journey authoring** from the event editor).
This reads the actual bundled Mossprout **Growing Again** chapter: 32 episodes,
inline dialogue, linked catalog conversations, existing unlocks and merge orders.
It is a local designer workspace, not a deployed CMS.

1. Select an episode; edit dialogue, choices, timing, item requirements or rewards.
2. Choose an existing hex image or upload PNG/WebP/JPEG (maximum 1.8 MB) for
   the linked Old Grove tile. Images stay on this workstation.
3. **Validate** checks editable paths, item references, numeric bounds, asset
   availability and source revision. IDs and graph connections are immutable.
4. **Walk through dialogue** uses the game's Journey compiler for inline beats
   and the catalog definition for linked conversations. It previews base copy;
   conditional personalisation, profile games and gameplay effects are not simulated.
5. **Save draft** creates an immutable local version under `drafts/journeys/`.
   Browser autosave retains the current workspace; use saved versions for durable
   checkpoints. Load a saved version using the dropdown. Copy the entire drafts
   directory, including its assets subdirectory, when moving workstations.
6. **Export game preview** downloads JSON with the assigned image embedded.
   Copy its JSON into **Developer Tools → Content Packs → Journey draft preview**
   in a current development/preview app build. Browse episodes and dialogue there
   offline. This screen never writes player progression or installs a content pack.

The Studio and app must use the same source revision. A mismatched revision is
rejected rather than applying edits to different episode indexes. Saved drafts
remain on disk; there is no automatic rebase yet. Restart Studio after changing
bundled chapter/catalog code, then rebuild the app before previewing that source.

This slice edits existing Mossprout content and one linked story tile; it does
not create/reorder episodes, author arbitrary hex layouts, generate alpha bounds,
replace bundled runtime definitions, or publish drafts. The existing additive
content-pack release flow is separate. Full gameplay preview, multi-character
creation, reviewed source integration and migration-safe publishing are next.

Verification: `npm run build --workspace=@incubator/live-ops-studio`,
`npm run typecheck --workspace=katchimeras`, and from `apps/katchimeras`:
`npx tsx --test tests/journey-authoring.test.ts`.

## New arc builder

Open `/arcs` or choose **New arc**. This builds a separate additive content pack
for a continuation after Mossprout or Steppling's bundled chapter. It does not
replace existing definitions. Each episode currently has one dialogue line,
an optional tile reveal, and an optional single-item merge order. The following
episode waits for that order to be served. Add, remove and reorder episodes;
links are compiled from their current order while their IDs remain stable.
The first episode opens when the predecessor is complete and must have zero wait.

Add story tiles using axial q/r coordinates. The diagram includes occupied home,
hatchable and story tiles. Collisions, dangling reveals, duplicate IDs, invalid
quantities and an order on the final episode block export. Every tile must be
revealed by an episode. Coordinates do not simulate camera framing or gameplay.

Tile release art requires an HTTPS image URL and measured alpha bounds in pixels.
Use the existing `tooling/art-pipeline/scripts/generate-hex-tile-bounds.py --json`
workflow to measure images. The builder validates metadata; it does not download,
measure, upload or verify availability of hosted images. Uploaded preview images
from `/journeys` are not automatically published. Use immutable hosted asset URLs.

**Save arc draft** stores versions under `drafts/arcs/`. Loading another version
or starting another arc first saves the current workspace. Browser autosave also
retains ongoing edits. **Validate arc** displays the generated content pack for
review, including episode gates, order IDs and tile references. **Export content
pack** downloads the same validated document. Install through the app's Developer
Tools → Content Packs on a test profile and restart to exercise actual gameplay.
This installation changes that profile's available content; it is different from
the isolated `/journeys` walkthrough.

Release validation uses bundled content plus the candidate pack. It cannot know
other independently installed or deployed releases; the existing combined-release
and activation checks remain necessary. Use new IDs for independent content and
never rename IDs after publication. The builder currently continues bundled arcs
only, not other downloaded chapters. It does not publish or enable server rows.
Art hosting, device acceptance, branching dialogue creation, additional companion
templates and release promotion remain separate work.

Run `npx tsx --test tests/arc-builder.test.ts tests/journey-authoring.test.ts tests/journey-continuations.test.ts`
from `apps/katchimeras` for the focused regression suite.

## Uploaded art and portable release bundles

The arc builder now accepts local PNG/WebP/JPEG uploads, up to 1.8 MB, exactly
1024 × 1024 pixels. It decodes the image and measures visible bounds using alpha
>= 16, matching the game's tile pipeline. Fully transparent, corrupt, oversized
and animated files are rejected. JPEGs naturally measure as a fully opaque canvas.
The tile inspector previews the uploaded image and displays its measured bounds.

Set **Asset hosting folder** to the intended HTTPS folder for the images.
Validation and export re-read each uploaded file, verify its content-addressed
filename and remeasure bounds; client-edited bounds are ignored for local art.
The manifest includes byte size and MD5 for the game's download checks.
**Export release bundle** downloads a ZIP with manifest.json, draft.json, assets/
and handoff instructions. Upload the contents of assets/ into that exact hosting
folder without renaming files, then test the manifest in the game. External image
references remain external and are listed in README.txt; they are not fetched.

Local images remain under drafts/arcs/assets/. To move a draft to another Studio,
copy its assets there and save draft.json as arc-<name>.json under drafts/arcs/.
No hosting, staging or live publishing happens during upload or export.
This supersedes the manual-measurement requirement above for local uploads;
external URL assignments still require manually supplied measured bounds.

Asset checks: `node --test tooling/live-ops-studio/arc-assets.test.cjs` from the root.

## Free offline world events

Choose **New offline events** on the event editor for Moonlit Mist and Restoration
Week. Both use schema 3, local-only rewards and disabled-by-default availability.
The editor includes Harmony awards/unlocks, encounter copy and sequence, merge
requirements, board seeds, keepsakes and scoring simulation. Use new occurrence
IDs for each scheduled run; enrolled players retain the original definition.

See `apps/katchimeras/docs/local-world-events.md` for the device pilot, authority
boundary and release acceptance checks. No paid or verified rewards are enabled
by exporting a local event.

World event encounters now use hosted tile dialogue, ordinary Merge orders, persistent action cards and the existing mission dock. The editor exposes companion, tile and action-title fields; these exports require schema 4. A regular hatchable in the same release may use `availability: { kind: "event_joined", eventId: "..." }` to permanently introduce its normal rescue arc through an event. The event overview is for schedules/rewards only.
