import type { CompanionNavigationIntent } from '@/types/companion-interaction';

let pending: CompanionNavigationIntent | null = null;

export function requestCompanionNavigationIntent(intent: CompanionNavigationIntent): void {
  pending = intent;
}

export function consumeCompanionNavigationIntent(): CompanionNavigationIntent | null {
  const value = pending;
  pending = null;
  return value;
}
