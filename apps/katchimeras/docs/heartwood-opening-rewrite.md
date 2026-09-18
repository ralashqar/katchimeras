> Superseded premise: Heartwood is now the central recoverable Tree. See [canonical design vision](heartwood-world-design-vision.md) and [current Part 1](heartwood-world-part-1.md). Historical implementation details below remain useful, but distant-destination copy and vector art are retired.

# Road to Heartwood: opening rewrite

## The player-facing promise

The Mist separated homes that once met at Heartwood. Wake the Garden, recover the first path with Steppling, prepare a welcoming hearth with Feastle, and raise a Lantern Post. Only the chapter finale receives a deliberate answer. Heartwood remains dormant beyond this first connection. The Heartwood Sanctuary is a structure restored at that destination, not a second unrelated place.

There is no added currency, purchase, real-world activity requirement, timer, or punishment for absence. Egg questions and merge recipes are unchanged. Personal choices have no wrong answer. The optional real-life activity IDs behind the first-meeting follow-up retain their meanings.

## Active opening beat sheet / before-and-after checklist

| Checkpoint | Before | Implemented presentation and handoff |
| --- | --- | --- |
| `world.mist_open` | General captions about a neglected Garden | Dormant Heartwood vista; “Once, every path led home. Then the lights went out.” The next caption identifies someone beneath the Mist. Look closer starts the existing merge board. |
| `world.mist_clear` | Make light to hit wisps | Free someone beneath the wisps. Existing seven merges and persistent finger; first spotlight only. |
| Egg questions and hatch | Two personal questions | Preserved; answers still clear the egg’s wisps. |
| `companion.first_meeting` / `hello` | Greeting, identity, generic replies | Hatch insight, Mossprout’s identity, and Heartwood by name. Three emoji choices ask what happened, whether it can be relit, or where to begin. Every reply establishes Heartwood and the Garden objective. |
| First meeting / `followup` | Generic personal-growth question | “Before we set off for Heartwood, this Garden will be our home. What would make it feel like yours?” Three intent-specific answers, individual replies, existing activity identities. No extra choice screen. |
| `companion.garden_intro` | Invisible automatically skipped handoff | Required Heartwood vista and two short paragraphs. “Plant our first seed” durably records the introduction before continuing. The first-meeting handler no longer skips this checkpoint. |
| Planting and first restoration | Personal seed and local improvement | The seed becomes the beginning of a home on the road. Existing planting, restoration price, receipts, and rewards remain authoritative. |
| `world.first_seed_grew` | Text mentioning a glint | Dedicated signal scene: light travels along a root to a broken three-notch marker. A permanent lit connection is also drawn between the Garden and trail in the world. Talk to Mossprout records the scene then uses the existing camera-return handoff. |
| Garden return | Speculation about an unseen glint | Three choices respond to the root-light, its interruption, or following the trail. Replies identify Steppling and the need for friends along the road. |
| First Bond scenario | Lost-friend welcome, recently rewritten | Retained with emojis, distinct replies, no skip, and exactly-once Bond reward. Introduction: “The light can show someone the way. We can give them a reason to stay.” |
| Rest and exit | Vague exploration prompt | Find Steppling at the broken marker toward Heartwood. Mossprout explicitly says not to wait for him. Existing rest timer does not gate the trail. |
| Steppling discovery and first Shoe | Independent unlock and equipment lesson | Reach the friend beside the lantern footing. Locker and Shoe equip him to recover the path. Day-one choices retain accessible movement/rest options. |
| Kingdom handoff | Late first mention of Heartwood | Team recap: living roots, recovered footing, missing hearth. Finishing the recap opens the shared signal plan directly. |
| Shared preparation and Feastle | Adjacent story orders | Plant and Shoe prepare the signal; their existing 60 Glow funds the hearth rescue. Feastle remembers travellers from Heartwood and prepares a place for the next arrival. |
| Signal-site board and finale | Text-only signal payoff | Existing isolated board raises the post. Semantic scenes send three flashes, receive three flashes, then identify the new direction. Distinct speakers contribute roots, route, and welcome. Lantern Routes open as before. |
| Petalimp chapter one | Standalone garden restoration | A former stop along the Heartwood paths. All three resolution branches connect its first restored patch to welcoming travellers. Existing choices, boards, costs, and chapter IDs remain. |

The Road to Heartwood strip shows the next shared task when the world is free of tutorial or mission UI. Its chapter sheet projects Garden → Trail → Hearth → First Signal from existing gameplay receipts and shows Heartwood beyond the chapter. It does not claim that the whole destination is a four-step percentage meter. Personal island trackers keep priority within their own active missions.

## State and compatibility

- The story is bundled and enabled in release as well as development. There is no `__DEV__` story gate.
- Optional `sharedAdventure.presentations` records `introduction`, `signal`, and `recap` timestamps through the serialized repository. These writes can happen before the post-Steppling gameplay gate; they grant no rewards and complete no orders.
- New saves acknowledge the introduction before planting. Older saves that passed it receive one recap at a safe world entry after Garden restoration. Active conversations, boards, and upgrades are not interrupted.
- All existing FTUE step/action IDs remain. The script is version 52; the first-meeting conversation is version 11. Saved conversation transcripts remain historical. The existing Garden handoff now has a visible presentation rather than requiring a new step migration.
- Shared scene definitions are version 2 and use semantic keys (`roots-awake`, `send-signal`, `receive-answer`, etc.). Every version-1 `line:N` maps to its equivalent semantic node; the panel also resolves that mapping before the next input so saved scenes remain visible.
- Scene saving precedes the navigation handoff. A storage error keeps the scene open with retry. A handoff failure can retry the same presentation receipt without awarding or skipping gameplay.
- Legacy-only FTUE nodes, such as old nickname, notice-spotlight, and energy lessons, retain their IDs for saved transitions. They do not add new screens to a fresh opening.

## Verification and remaining device acceptance

Verification results: TypeScript and ESLint for changed app TypeScript files pass. The 15 shared-adventure tests and 49 targeted opening/dialogue/guidance/Bond tests pass. The storyboard was visually inspected in the local Studio.

The shared-adventure suite includes release-independent availability, every greeting branch, early receipt save/reload/idempotence, progressed-save recap, complete-adventure preservation, semantic scene migration, actual component retries, and reduced-motion visuals. Existing full-arc, route, inventory, daily reward, SQLite transaction, and Petalimp-priority tests remain in the suite.

The opening narrative/guidance tests cover the seven merge cues, the real two-Seed → Sprout → sleeping Sprout → Plant lesson, first-meeting handoff, narrative pacing, and Bond reward behavior. The broader FTUE script suite has pre-existing failures documented in the preceding Part 1 verification; those are not claimed as passing.

Native recording is **not completed in this workspace**: no Android SDK/device is available, and the Expo web build is blocked by the existing native-only `react-native-maps` import in the day-map route. No native playback or small-phone layout acceptance is claimed. The Live Ops Studio `/shared-adventure` page provides a clearly labelled storyboard using the exact bundled opening art, scene copy, greetings, Bond options, and farewell; it is not a gameplay recording.

On device: play a fresh save through the post; verify the introduction actually pauses before planting, the signal precedes return dialogue, the objective strip reappears after tutorials, and the signal chapter opens after Steppling. Relaunch during both new scenes and the finale; repeat with reduced motion and large text. Check a mid-FTUE save and an active Petalimp save without resetting either. Record that fresh-save playthrough before calling native acceptance complete.
