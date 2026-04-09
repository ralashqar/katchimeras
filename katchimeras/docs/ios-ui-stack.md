# iPhone UI and Onboarding Stack

This project now has a stronger frontend stack for polished iPhone-style UI, onboarding, and motion work.

## Installed libraries

- `react-native-reanimated`
  Base motion engine. Use for gestures, shared values, entering and exiting transitions, and scroll-linked effects.
- `moti`
  Higher-level animation primitives on top of Reanimated. Best for onboarding reveals, feature cards, and staged text or illustration entrances.
- `react-native-pager-view`
  Best fit for horizontal onboarding flows, paging, and snap-based product tours.
- `expo-blur`
  Native blur for glassy overlays, tab chrome, and translucent cards.
- `expo-linear-gradient`
  Simple gradients for heroes, CTA backgrounds, and subtle depth.
- `expo-mesh-gradient`
  Softer, more premium gradient backgrounds for onboarding and auth surfaces.
- `@gorhom/bottom-sheet`
  Polished interactive sheets for upsells, filters, pickers, and settings.
- `@shopify/react-native-skia`
  High-end graphics, shaders, particles, custom loaders, and dynamic backgrounds.
- `@shopify/flash-list`
  Better list performance for media-heavy or card-heavy feeds.
- `@rive-app/react-native`
  Best option for interactive motion graphics and state-machine-driven onboarding illustrations.
- `expo-dev-client`
  Required for a custom development build when using libraries that are not supported in Expo Go.

## Recommended usage by job

- Onboarding flow:
  `react-native-pager-view` + `moti` + `expo-mesh-gradient` + `expo-blur`
- Product transitions and delight:
  `react-native-reanimated` + `moti`
- Interactive illustrations and motion graphics:
  `@rive-app/react-native`
- Advanced visual systems:
  `@shopify/react-native-skia`
- Sheets and modal interactions:
  `@gorhom/bottom-sheet`

## Build mode guidance

- Usually fine in Expo Go:
  `react-native-reanimated`, `moti`, `react-native-pager-view`, `expo-blur`, `expo-linear-gradient`, `expo-mesh-gradient`, `@shopify/flash-list`
- Prefer a development build:
  `@rive-app/react-native`
- If you start using Rive, move your daily workflow to a dev client instead of Expo Go.

## Skills installed

- `building-native-ui`
  Use this when asking for polished Expo Router screens, tabs, onboarding, animation structure, and native-feeling flows.
- `expo-dev-client`
  Use this when setting up or debugging development builds for iOS and Android.

## Recommended next implementation steps

1. Build a dedicated onboarding route group like `app/(onboarding)/`.
2. Use `react-native-pager-view` for 3 to 5 slides with progress, skip, and CTA.
3. Animate copy and artwork with `moti`, and reserve lower-level `react-native-reanimated` work for gestures and shared transitions.
4. Use `expo-mesh-gradient` or Skia for one strong visual background system instead of stacking many effects.
5. Add one Rive animation only if it carries real product meaning, such as account creation, sync state, or personalization.
6. Switch to a dev build before shipping any Rive-based screen.

## Suggested design direction

- Keep the first-run experience visually sparse.
- Use one bold visual anchor per screen.
- Prefer large type, short copy, and obvious forward motion.
- Avoid card grids and cluttered dashboards during onboarding.
