import { katchimeraLevel } from '@/constants/katchimera-progression';
import type { EncounterLoadoutChoice } from '@/components/katchadeck/upgrade/upgrade-mission-rows';
import type { EncounterLoadout } from '@/types/encounter';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * The battle team (cozy 4X): a lead hero, and from Chapter 3's reward a partner. Both bring their abilities, which charge
 * from the same merges and fire on their own buttons, and both take the battle's XP. Nothing else changes: the lead is
 * who the level is about (their lines, a level that asks for one friend), the partner is along to help.
 */
export const SECOND_HERO_CHAPTER_ID = 'the-signal';

/** How many heroes a battle takes: two once Chapter 3 is claimed. */
export const heroSlots = (world: Pick<MergeWorldState, 'chaptersClaimed'>): 1 | 2 => (world.chaptersClaimed?.includes(SECOND_HERO_CHAPTER_ID) ? 2 : 1);

/** The partner to suggest when none was chosen: the strongest other hero who can come. */
export function defaultPartner(world: Pick<MergeWorldState, 'katchimeraProgress'>, lead: MergeCharacterId, playable: readonly MergeCharacterId[]): MergeCharacterId | null {
  const others = playable.filter((id) => id !== lead);
  return others.reduce<MergeCharacterId | null>((best, id) => (best == null || katchimeraLevel(world, id) > katchimeraLevel(world, best) ? id : best), null);
}

/** A choice with its partner filled in (the remembered one, else the default), or cleared when the slot is closed. */
export function withPartner(world: Pick<MergeWorldState, 'katchimeraProgress' | 'chaptersClaimed'>, choice: EncounterLoadoutChoice, playable: readonly MergeCharacterId[]): EncounterLoadoutChoice {
  if (heroSlots(world) < 2) return { ...choice, partnerId: null };
  const kept = choice.partnerId && choice.partnerId !== choice.katchimeraId && playable.includes(choice.partnerId) ? choice.partnerId : null;
  return { ...choice, partnerId: kept ?? defaultPartner(world, choice.katchimeraId, playable) };
}

/** What a battle is played with: the lead at their level, the helper Wisp, and the partner at theirs when the slot is open. */
export function battleLoadout(world: Pick<MergeWorldState, 'katchimeraProgress' | 'chaptersClaimed'>, choice: EncounterLoadoutChoice): EncounterLoadout {
  const wispId = choice.helperWispId as EncounterLoadout['wispId'] | null;
  const partnerId = heroSlots(world) >= 2 && choice.partnerId && choice.partnerId !== choice.katchimeraId ? choice.partnerId : null;
  return {
    companionId: choice.katchimeraId, level: katchimeraLevel(world, choice.katchimeraId), ...(wispId ? { wispId } : {}),
    ...(partnerId ? { partner: { companionId: partnerId, level: katchimeraLevel(world, partnerId) } } : {}),
  };
}
