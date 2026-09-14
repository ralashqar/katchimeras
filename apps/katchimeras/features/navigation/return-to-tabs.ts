import type { Href, Router } from 'expo-router';

/**
 * Leaves a page pushed over the tabs on the root stack (Developer Tools, a
 * preview) for a tab. The stack is popped back to the tabs first: replacing
 * the page with `/(tabs)` mounted a second tab navigator on top of the one
 * still beneath it, and every visit stacked another whole Haven, Today and
 * Merge provider behind the last, each still subscribed to the stores. From
 * a tab itself this is an ordinary jump.
 */
export function returnToTabs(router: Router, href: Href = '/(tabs)/katchimeras'): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href);
}

/** Restarts onboarding from a pushed dev page with nothing left mounted beneath it. */
export function restartOnboarding(router: Router, href: Href = '/onboarding'): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
