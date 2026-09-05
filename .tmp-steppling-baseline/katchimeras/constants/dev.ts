// Preview builds are release-mode binaries (`__DEV__ === false`), so internal
// testers need an explicit build-profile flag. Production deliberately omits
// that flag and therefore cannot expose or activate these tools.
export const DEV_TOOLS_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true';

export const DEV_DEBUG_NAV_ENABLED = DEV_TOOLS_ENABLED;
export const ENABLE_KINGDOM_DEX_SCALE = false;
