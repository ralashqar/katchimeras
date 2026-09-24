import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

import { LIFE_INPUT_ENABLED } from '@/constants/product-scope';

/**
 * A life-input route (Today, moment capture, photo essence, voice notes, streaks, day maps and cards) kept in the
 * codebase but out of the game (`constants/product-scope.ts`): reached anyway (a deep link, an old button), it sends
 * the player to the Sanctuary. The screen itself is untouched, ready for the companion product.
 */
export function lifeInputRoute<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function LifeInputRoute(props: P) {
    if (!LIFE_INPUT_ENABLED) return <Redirect href="/(tabs)/katchimeras" />;
    return <Screen {...props} />;
  }
  LifeInputRoute.displayName = `LifeInputRoute(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return LifeInputRoute;
}
