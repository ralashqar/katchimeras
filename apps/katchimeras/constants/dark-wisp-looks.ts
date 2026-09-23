import type { DarkWisp, WispIntentKind } from '@/types/mission-mechanic';

/**
 * What a Dark Wisp looks like (encounter v2): its own silhouette and one prop, so the kind reads at a glance. The
 * intent chip over it stays the truth of what it does next; the look says what it is. Generated from the corruption
 * wisp as reference (`scripts/generate-dark-wisp-looks.py`, sources in design/dark-wisp-looks-v1).
 */
export const DARK_WISP_LOOKS = ['snuffer', 'shrouder', 'nibbler', 'creeper', 'warden', 'mender', 'caller', 'mistling', 'keeper', 'thief', 'overgrowth'] as const;
export type DarkWispLook = (typeof DARK_WISP_LOOKS)[number];


/** The look a wisp wears when its data names none: a called one is a Mistling, else its first intent's kind. */
const LOOK_BY_INTENT: Readonly<Record<WispIntentKind, DarkWispLook>> = {
  surge: 'snuffer', snuff: 'snuffer', shroud: 'shrouder', devour: 'nibbler', root: 'creeper', ward: 'warden', mend: 'mender', call: 'caller', gather: 'keeper',
  burrow: 'creeper', spores: 'caller',
};

export const isDarkWispLook = (value: unknown): value is DarkWispLook => typeof value === 'string' && (DARK_WISP_LOOKS as readonly string[]).includes(value);

export function darkWispLook(wisp: Pick<DarkWisp, 'look' | 'hidden'>, firstIntent: WispIntentKind | null): DarkWispLook | null {
  if (isDarkWispLook(wisp.look)) return wisp.look;
  if (wisp.hidden) return 'mistling';
  return firstIntent ? LOOK_BY_INTENT[firstIntent] : null;
}
