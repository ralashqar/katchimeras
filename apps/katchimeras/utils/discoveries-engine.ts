import type { DiscoveryContext, DiscoveryDef, DiscoveryRecord } from '@/types/discoveries';
import { DISCOVERY_CATALOG } from '@/utils/discoveries-catalog';

// The pure Discovery evaluator. No event bus: we DERIVE which defs currently pass
// from the context, diff against what's already unlocked, and report the new ones.
// Idempotent + monotonic — a Discovery can't double-fire or un-unlock. The hook
// stamps unlockedAt / sourcePatchId and persists; the engine only decides "what's
// newly true". See docs/discoveries-system-design.md §5.

function passes(def: DiscoveryDef, ctx: DiscoveryContext): boolean {
  try {
    return def.test(ctx);
  } catch {
    return false; // a bad/over-eager rule never crashes evaluation
  }
}

export function evaluateDiscoveries(
  ctx: DiscoveryContext,
  unlocked: Record<string, DiscoveryRecord>,
  catalog: DiscoveryDef[] = DISCOVERY_CATALOG
): { newlyUnlocked: DiscoveryDef[] } {
  const newlyUnlocked = catalog.filter((def) => !unlocked[def.id] && passes(def, ctx));
  return { newlyUnlocked };
}

// All currently-passing def ids regardless of unlock state — used for the one-time
// backfill over existing history and by the harness.
export function passingDiscoveryIds(
  ctx: DiscoveryContext,
  catalog: DiscoveryDef[] = DISCOVERY_CATALOG
): string[] {
  return catalog.filter((def) => passes(def, ctx)).map((def) => def.id);
}
