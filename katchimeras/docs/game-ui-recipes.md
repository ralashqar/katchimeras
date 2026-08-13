# Adding UI to Katchimeras

Start at `/dev-ui-gallery` and reuse the closest existing composition.

## New screen

1. Keep the route thin; orchestration belongs in `features/<area>`.
2. Use shared top chrome and `GamePanel` for operational surfaces.
3. Give the screen one feature-owned scene/playfield and one primary action.
4. Use `GameUI` tokens for generic layout, type, elevation and layers.

## Currency

Render `GameCurrencyHud` with `GameCurrencyBalance[]`. Read global balances through `useGameWallet()` in a controller/composition component, not inside the HUD. Show Gems globally; add Energy/Coins only when actionable in that mode.

## Hero

Use `GameHeroStage` with feature-owned artwork. Supply a short eyebrow, one-line title and at most one supporting paragraph or progress treatment. Do not place another large panel over the artwork.

## Sheet or dialog

Use `KatchaSheet` for browse/edit/choice flows and `KatchaDialog` for blocking decisions. Default to parchment. A feature supplies content and callbacks; the primitive owns safe areas, dismissal and keyboard behavior.

## Feedback

- `useGameFeedback().show(...)` for brief confirmations.
- `KatchaInlineNotice` for recoverable errors, offline state and permissions.
- `KatchaDialog` for destructive or blocking choices.
- Major reward presentations are reserved for progression milestones.

Never create a local toast, generic modal card, currency pill or confirmation popup.

## Mini-game

Keep the playfield, items and gameplay VFX themed. Use shared chrome for back navigation, currencies, pause/settings, explanatory errors, confirmations and reward summaries. Gameplay VFX are not toasts.

## Review checklist

- Narrow phone, standard phone and tablet.
- Enlarged text and long values.
- Reduced motion.
- Safe areas, Android back and every dismissal path.
- Loading, empty, disabled, selected, success and error states.
- Run `npm run verify:game-ui` and the relevant feature tests.
