import type { Href, Router } from 'expo-router';

/**
 * Closes a pushed/modal route when history exists and otherwise returns to a
 * real app root. This avoids React Navigation's unhandled GO_BACK warning for
 * deep links, reloads, restored routes, and dev-client launches.
 */
export function safeGoBack(router: Router, fallback: Href = '/(tabs)'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

/** Dismisses a modal route through the stack's modal API when possible. */
export function safeDismissModal(router: Router, fallback: Href = '/(tabs)'): void {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  safeGoBack(router, fallback);
}
