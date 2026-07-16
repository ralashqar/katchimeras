# Shared game UI

Production overlays use one of two contextual surfaces:

- `parchment` for input, editing, choices, confirmations, and quest selection;
- `night` for archives, readers, collections, reveals, and immersive supporting chrome.

Use `KatchaSheet` for sheets and `KatchaDialog` for blocking decisions. `KatchaSheet` owns the portal, scrim, safe-area clearance, keyboard behavior, close affordance, scrolling, swipe/backdrop/hardware dismissal, and pinned footer. Feature code supplies structured content and handles `onRequestClose`.

Nested controls must consume `useKatchaSurface()` instead of importing feature colors. Prefer `KatchaButton`, `ActionTile`, `SheetActionRow`, `SegmentedControl`, `SheetEmptyState`, and the primitives in `katcha-sheet-primitives.tsx`. Art stays feature-owned.

Use `KatchaInlineNotice` for recoverable errors or permissions, `KatchaToast` for brief success, and `KatchaDialog` for destructive/blocking choices. Avoid production `Alert.alert` confirmations.

Today surfaces are routed through `TodaySurfaceState`. Open or replace one surface through the controller; do not add another popup boolean. Follow-ups can appear only when the active surface is null.

The development gallery is available at `/dev-ui-gallery`. Check both surfaces at narrow phone, standard phone, tablet, and enlarged text sizes. Validate keyboard avoidance, scroll/shadow clearance, Android back, all dismissal paths, reduced motion, 44px targets, roles, labels, and selected/disabled states.

`MeadowSheet` has been retired. Production sheets must use `KatchaSheet`; immersive reveals and ceremonies may keep feature-owned full-screen composition while consuming shared tokens, controls, notices, and dialogs.
