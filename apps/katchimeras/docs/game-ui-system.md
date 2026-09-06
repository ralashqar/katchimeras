# Katchimeras game UI system

## Product rule

Katchimeras uses warm, tactile game chrome around feature-owned scenes and playfields. Parchment, carved wood, gold and dark-brown ink are the default language. Character art, merge boards and mini-game playfields may keep authored colors; navigation, currencies, panels, controls, feedback and overlays may not invent a separate visual dialect.

Each screen should have one protagonist, one primary action and no more persistent chrome than the player needs to make the next decision.

## Source of truth

`constants/game-ui.ts` owns semantic tokens, named layers, currency metadata and number formatting. Shared components consume these tokens rather than importing Today-, Merge- or companion-specific colors.

The hierarchy is:

1. Canvas or feature scene.
2. Content and playfield.
3. Shared top chrome and dock.
4. Inline notice.
5. Toast.
6. Sheet/dialog.
7. Major reward or hatch reveal.

Use the named `GameUI.layer` values instead of adding arbitrary z-index values to shared chrome.

## Surfaces and feedback

- Warm parchment is the default for screens, sheets, choices, readers and operational UI.
- Wood is reserved for compact HUD chrome and high-contrast controls over artwork.
- Cinematic night is exceptional: hatches, major discoveries and full-screen rewards.
- Toast: brief confirmation with no decision.
- Inline notice: persistent, recoverable state or error.
- Dialog: blocking or destructive decision.
- Full-screen presentation: meaningful progression payoff only.

## Ownership boundaries

Shared UI is presentational. It receives values and callbacks and never reads SQLite, storage or route state. `GameWalletProvider` is the read-only presentation boundary for Energy, Coins and Gems. Feature controllers continue to own mutations.

Gems are globally meaningful. Energy and Coins are contextual and should appear only where they help the current decision. Essence remains within customization/store surfaces.

## Accessibility and motion

- All controls have at least a 44dp target.
- Numeric values use tabular figures and compact formatting.
- Toasts and notices use polite live regions; dialogs own modal focus.
- Shared motion respects reduced-motion settings.
- Validate long localized labels, large balances and enlarged text in the gallery.
