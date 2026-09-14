import { isHatchableCompanion } from '@/constants/hatchable-companions/registry';

/**
 * Which friends have a companion page. Mossprout's page is his FTUE stage and
 * campaign; every hatchable friend's page is the journey stage with their
 * definition's cards. Every other family is a roster and Dex creature only:
 * no page, no conversation, no interaction of any kind. Nothing outside this
 * list may reach the interaction sheet.
 */
export function companionHasPage(familyId: string | null | undefined): boolean {
  return familyId === 'mossprout' || (familyId != null && isHatchableCompanion(familyId));
}

/** The one Garden every friend's request opens: Mossprout's Main Board. */
export const SHARED_GARDEN_CREATURE_ID = 'companion:mossprout';
