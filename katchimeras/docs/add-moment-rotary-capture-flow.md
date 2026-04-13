# Add Moment Rotary Capture Flow

This document defines the intended next-generation Add Moment interaction for Home. It replaces the idea of a standard sheet-first input flow with an egg-centered radial capture system.

Related references:

- `docs/katchimera-app-mvp-design.md`
- `docs/home-screen-ux-and-katchimera-design-system.md`
- `docs/mvp-implementation-plan.md`

## 1. Goal

Make adding a moment feel magical, fast, and native to the product world.

The egg should remain the emotional center of the interaction. Adding a moment should feel like feeding the egg, not filling out a form.

## 2. Product Summary

Instead of opening a standard menu or bottom sheet, the user taps the egg and the egg becomes the center of a circular action carousel.

Moment types orbit around the egg with a light radial bloom, slight rotational settling, and subtle depth.

Core interaction:

Tap the egg -> open radial moment carousel -> choose a moment type -> complete capture inside the same egg-centered flow -> animate the chosen moment into the egg

## 3. Core UX Flow

### 3.1 Open Capture Ring

Trigger:

- user taps the egg

Behavior:

- egg stays fixed in the center
- a circular ring of moment options expands around it
- the ring should feel like a small solar system opening around the egg

Example first-level options:

- Photo
- Note
- Voice
- Mood or energy
- Location or outing
- Other custom moment types

### 3.2 Photo Path

When the user taps `Photo`:

- request photo-library permission only at that moment if needed
- if granted, do not jump immediately to a jarring full-screen system picker
- instead, transition the radial ring into a photo-selection mode

### 3.3 Recent Photos Around The Egg

Once permission is available:

- fetch a small recent set, for example the last 10 image assets
- prefer real camera photos over screenshots
- if screenshot filtering is unavailable in the integration path, fall back to recent images
- replace the moment-type ring with recent photo thumbnails arranged around the egg

This preserves the interaction grammar. The user stays inside the same magical capture space.

### 3.4 Select A Photo

When the user taps a thumbnail:

- selected photo scales slightly
- it detaches from orbit
- it animates inward toward the egg
- the egg visually absorbs it
- the ring collapses
- the egg updates to reflect the added moment

## 4. Motion And Visual Direction

The egg is the anchor.

### Opening animation

- quick radial bloom
- slight overshoot
- gentle rotational settle

### Thumbnail transition

- moment options morph into photo thumbnails in place
- keep roughly the same orbital positions when possible

### Selection animation

- chosen item scales up briefly
- leaves its orbit
- flows into the egg along a curved inward path

### Closing animation

- remaining items fade and rotate away
- egg remains centered and updated

## 5. Why This Interaction Matters

This is stronger than a normal picker because it:

- keeps the interaction on-brand
- makes moment capture feel rewarding instead of clerical
- reinforces the egg as the living center of the product
- reduces context switching versus jumping straight into generic system UI

## 6. MVP Interpretation

This flow can be introduced in layers instead of waiting for the entire final system.

### MVP sub-slice

Ship the radial interaction first with:

- quick tags
- photo entry point shell
- local egg reaction

### Next layer

Add recent-photo ring after permission handling works reliably.

### Later layer

Add note, voice, mood, and richer custom moment types.

## 7. Engineering Architecture

The interaction should be modeled as a capture state machine, not as a loose collection of popups.

Recommended states:

- `closed`
- `moment_ring`
- `photo_permission_request`
- `photo_ring_loading`
- `photo_ring_ready`
- `capturing_note`
- `capturing_voice`
- `submitting`
- `absorbing`
- `completed`
- `error`

The egg remains mounted throughout. Only the orbiting layer changes.

## 8. Frontend Plan

### Phase 1. Refactor Add Moment Into A Radial Controller

Goal:

Replace the current sheet-first flow with an egg-centered controller.

Tasks:

- create a dedicated controller hook such as `use-add-moment-flow`
- move Add Moment state out of the current simple sheet toggle
- track:
  - ring open or closed
  - active capture mode
  - loading state
  - selected asset
  - absorption animation state

Suggested new component areas:

- `components/katchadeck/home/add-moment-radial.tsx`
- `components/katchadeck/home/add-moment-orbit.tsx`
- `components/katchadeck/home/photo-orbit-ring.tsx`
- `components/katchadeck/home/moment-absorption-overlay.tsx`

Deliverable:

- egg tap opens a radial quick-action carousel around the hero egg

### Phase 2. Keep Quick Tags Inside The Ring

Goal:

Preserve current quick-tag speed while upgrading the presentation.

Tasks:

- move current quick tags into radial action items
- keep one-tap instant creation
- on selection:
  - create the moment immediately
  - animate the icon or chip into the egg
  - collapse the ring

Deliverable:

- quick tags remain the fastest path, but inside the new interaction system

### Phase 3. Add Photo Permission + Recent Asset Mode

Goal:

Support photo moments without breaking the product mood.

Tasks:

- request permission only when `Photo` is tapped
- add a recent-photo loader service
- fetch a small image-only recent set
- prefer non-screenshot camera photos where available
- morph action nodes into recent-photo thumbnails

Implementation note:

The exact native integration may differ by Expo capability and target build setup. The product requirement is the interaction model first:

- radial photo preview around egg
- graceful fallback to recent images
- only fall back to generic picker when the native path is unavailable

Deliverable:

- selecting `Photo` keeps the user in the egg-centered flow whenever technically possible

### Phase 4. Add Absorption Animation

Goal:

Make the selected moment feel fed into the egg.

Tasks:

- build a dedicated shared animation for:
  - tags
  - thumbnails
  - later note or voice markers
- update egg glow, swirl, and pulse at the end of absorption
- ensure the resulting moment chip appears in the context area after completion

Deliverable:

- the handoff from capture to stored moment feels intentional and rewarding

### Phase 5. Add Secondary Capture Types

Goal:

Broaden capture without breaking the same interaction grammar.

Tasks:

- Note:
  - radial selection leads to a lightweight inline composer, not a heavy screen
- Voice:
  - radial selection leads to a simple short-record state
- Mood or energy:
  - radial selection opens a tiny expressive selector in the same area
- Location or outing:
  - radial selection becomes a semantic tag or lightweight place action

Deliverable:

- all moment types feel like variations of one system, not different products

## 9. Data Model Impact

This design expands moment payload needs.

Recommended shape:

```json
{
  "id": "string",
  "type": "photo",
  "timestamp": "ISO-8601",
  "source": "manual",
  "metadata": {
    "asset_id": "string",
    "thumbnail_uri": "string",
    "caption": "string",
    "mood": "string",
    "duration_ms": 0
  }
}
```

Notes:

- photo moments need asset metadata and thumbnail references
- note moments need text payload
- voice moments need duration and recording reference
- quick tags remain the lightest schema path

## 10. Current Repo Fit

Current state in the repo:

- Home currently uses `AddMomentSheet`
- quick tags are local-only
- the egg already reacts visually to new inputs

Recommended transition:

1. keep the existing local quick-tag mutation behavior
2. replace the sheet shell with a radial shell
3. add photo mode behind the same controller
4. only then add persistence for richer payload types

## 11. Risks And Constraints

- radial interactions can become cluttered if too many options appear at once
- photo mode should not require a heavy permission prompt before the user expresses intent
- fallback paths must exist if native recent-photo access is unavailable
- the animation should remain fast; this is not a long cinematic each time
- the egg must stay readable and tappable while the ring is open

## 12. Recommended Immediate Next Build Steps

1. Refactor the current Add Moment flow into an egg-centered radial action ring for quick tags only.
2. Add a small capture-state controller hook for radial states and absorption animation.
3. Introduce a `Photo` radial node that currently routes to a placeholder recent-photo mode.
4. Add recent-photo loading only after the ring interaction feels correct.
5. Keep generic system picker usage as fallback, not the primary design path.
