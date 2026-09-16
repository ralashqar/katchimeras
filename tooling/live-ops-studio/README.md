# Live Ops Studio

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
