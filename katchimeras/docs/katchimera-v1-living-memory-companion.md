# Katchimera V1: Living Memory Companion

## Product Definition

Katchimera is a World-first consumer AI app where everyday life becomes a persistent, explorable memory world.

The V1 promise is simple: build a world from your life. Every day leaves behind a handcrafted village patch shaped by real experiences. Photos become Memory Vaults. Places become landmarks. Walks become trails. Reflections become Sanctuaries. Calendar events become Chronicle stories. Each day hatches a Katchimera that represents the spirit of that day.

Katchimera is not a habit tracker, journal, camera roll, or chatbot. The gameplay happens in real life. Users progress by living, noticing, capturing, and returning.

## V1 Pillars

1. **The world is home**
   - The World tab is the launch surface and primary experience.
   - The Today tab supports the hatch ritual, reflection, postcard, and comic.
   - Collection and Life Map are archive surfaces for revisiting days.

2. **Every day becomes a patch**
   - Forming days grow live as signals arrive.
   - Hatched days freeze into stable, revisit-friendly patches.
   - Empty and quiet days still count; they become gentle, restful places.

3. **Memory objects are the interface**
   - Memory Vault: photos, notes, voice memories, and captured meanings.
   - Observatory / Places: where the day happened.
   - Steps Path / Journey: how the user moved.
   - Sanctuary: how the day felt.
   - Home / Chronicle: what the day was about.
   - Food Pavilion: what the user savoured.
   - Study: books, films, shows, games, and inspiration.
   - Quest Board: optional prompts that help the current patch grow.

4. **AI is the intelligence layer, not the product surface**
   - AI classifies memories, enriches context, writes day reflections, shapes Chronicle copy, and creates optional comic/story outputs.
   - V1 does not include an AI chat companion.
   - If AI is unavailable, the app remains useful through local fallback copy and local-first state.

5. **Progression rewards real life**
   - Discoveries unlock from meaningful real-life patterns.
   - Essence is earned from captured memories, milestones, discoveries, and care.
   - Cosmetics are expressive only. They must not turn the product into a grind.

## Core User Journeys

### New User

1. Onboarding explains: "your life becomes a world."
2. The user chooses a tone/profile, sees how memories become world objects, and completes permissions in context.
3. Optional Hatch Your Past reconstructs recent days.
4. The app lands in World, not Today.

### Daily Use

1. The user opens World and sees the current forming patch.
2. Passive signals and captures grow objects.
3. The Quest Board offers optional real-life prompts.
4. The egg becomes ready and hatches into the day's Katchimera.
5. The patch finalizes and becomes part of the archive.

### Revisit

1. The user selects a past day from World, Collection, or Life Map.
2. Tapping objects opens the memories behind them.
3. Chronicle explains what shaped the day.
4. Discoveries and cosmetics give long-term continuity.

## Data And Privacy Contract

Katchimera is local-first.

Local state owns the memory record: day signals, photos selected by the user, notes, places, Health routes, world patches, discoveries, essence, cosmetics, and day archive.

Remote AI calls are optional enrichment. Default reflection payloads should avoid raw coordinates, photo URIs, IDs, place names, and freeform user text. They may include abstract labels, categories, counts, weather labels, creature metadata, prominent photo tags, and short object descriptions. Richer OCR/photo detail should be reserved for explicit story or comic generation.

Permission denial is a first-class path. If Photos, Location, Motion/Health, Calendar, Notifications, Microphone, or Camera access is denied, the app should keep working with manual capture and local fallback copy.

## V1 Interface Contract

- World is the initial route.
- Today remains available for hatch detail, postcard, and comic.
- Calendar events feed Chronicle only after device permission is granted.
- Chronicle is a story layer, not a calendar viewer.
- Discoveries, Essence, Quests, and Cosmetics stay cosmetic/progression layers; they must not own memory data.
- World objects visualize existing day fields; they must not become separate data owners.

## Out Of Scope For V1

- AI chat companion.
- Accounts, cloud sync, or multi-device restore.
- Subscription or paid cosmetics.
- Public App Store launch readiness.
- Full social graph or multiplayer world visits.
- Large-scale asset expansion before the current object set is coherent and tested.

## V1 Acceptance Criteria

- A fresh user can onboard and land in World.
- A quiet day, manual-only day, photo day, place day, movement day, reflection day, and rich mixed day all produce coherent patches.
- A ready day can hatch in World and finalize into a stable patch.
- Past days can be revisited through World, Collection, and Life Map.
- Memory Vault, Places, Journey, Sanctuary, Chronicle, Food, Study, Quest Board, Discoveries, and Cosmetics have clear reader or action behavior.
- Calendar permission can be granted or denied without breaking Chronicle.
- AI reflection failure does not block hatching.
- Missing Supabase configuration does not crash the app path.
- The verification harnesses match the current V1 object model.

## Superseded Direction

The older Home-first MVP direction in `katchimeras-core-mvp.md` and `mvp-implementation-plan.md` is now historical. Those docs are useful for the hatch ritual and daily emotional tone, but they no longer define the launch architecture. V1 is World-first.
