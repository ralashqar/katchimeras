import type { IconSymbolName } from '@/components/ui/icon-symbol';

// A one-shot handoff from the Moment Capture screen back to Today: the captured
// photo + its category icon, so Today can fly it into the egg and start the
// icon orbiting once it regains focus. Transient (in-memory) on purpose — the
// persisted contribution already landed via applyCapturedMoment; this is only
// the celebratory animation.
export type PendingCaptureFeed = {
  photoUri: string;
  icon: IconSymbolName;
  accent: string;
};

let pending: PendingCaptureFeed | null = null;

export function queueCaptureFeed(feed: PendingCaptureFeed): void {
  pending = feed;
}

export function consumeCaptureFeed(): PendingCaptureFeed | null {
  const feed = pending;
  pending = null;
  return feed;
}
