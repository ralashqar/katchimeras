import type { ContentPack } from '@/types/content-pack';

/**
 * Whether a pack may be played by this app right now: its window is open
 * and the app is new enough. Pure and registry-free, so the module that
 * primes the stored pack before any registry is built can ask.
 */

/** `major.minor.patch` compared numerically; a version the app cannot parse satisfies nothing. */
export function appVersionSatisfies(minimum: string | undefined, current: string): boolean {
  if (!minimum) return true;
  const parse = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10));
  const need = parse(minimum);
  const have = parse(current);
  if (need.some(Number.isNaN) || have.some(Number.isNaN)) return false;
  for (let index = 0; index < Math.max(need.length, have.length); index += 1) {
    const a = have[index] ?? 0;
    const b = need[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/** Whether a pack's window is open now (a pack with no window always is). */
export function contentPackInWindow(pack: Pick<ContentPack, 'startsAt' | 'endsAt'>, now = Date.now()): boolean {
  if (pack.startsAt && Date.parse(pack.startsAt) > now) return false;
  if (pack.endsAt && Date.parse(pack.endsAt) <= now) return false;
  return true;
}
