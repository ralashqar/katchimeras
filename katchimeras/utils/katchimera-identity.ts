import {
  companionIdForFamily,
  familyIdFromCompanionId,
  katchimeraFamilyById,
  katchimeraSkinById,
  katchimeraSkinByVisualKey,
  type KatchimeraSkinDefinition,
} from '@/constants/katchimera-skins';
import type {
  EncounterHistoryEntry,
  EncounterHistoryMap,
  HomeVisualKey,
  LocalCreatureRecord,
  StoredHomeState,
} from '@/types/home';
import type {
  KatchimeraCompanionId,
  KatchimeraFamilyId,
  KatchimeraSkinId,
  LifeAspectId,
} from '@/types/katchimera';

const PROFILE_SKIN_OVERRIDES: Readonly<Record<string, KatchimeraSkinId>> = {
  activity_transit_commute_signalhop: 'signalhop',
  subject_parenting_care_nestkin: 'nestkin',
};

export type KatchimeraIdentity = {
  aspectId: LifeAspectId;
  familyId: KatchimeraFamilyId;
  skinId: KatchimeraSkinId;
  companionId: KatchimeraCompanionId;
};

export function identityForEncounter(
  profileId: string | null | undefined,
  visualKey: HomeVisualKey | null | undefined
): KatchimeraIdentity | null {
  const overriddenSkin = profileId ? PROFILE_SKIN_OVERRIDES[profileId] : null;
  const skin = overriddenSkin
    ? katchimeraSkinById.get(overriddenSkin)
    : visualKey
      ? katchimeraSkinByVisualKey.get(visualKey)
      : profileId
        ? [...katchimeraSkinById.values()].find((candidate) => profileId.endsWith(`_${candidate.id}`))
        : null;
  return skin ? identityForSkin(skin) : null;
}

export function identityForCreature(
  creature: Pick<LocalCreatureRecord, 'aspectId' | 'familyId' | 'skinId' | 'companionId' | 'encounterProfileId' | 'visualKey'>
): KatchimeraIdentity | null {
  const skin = creature.skinId ? katchimeraSkinById.get(creature.skinId) : null;
  if (skin) return identityForSkin(skin);
  const encounterIdentity = identityForEncounter(creature.encounterProfileId, creature.visualKey);
  if (encounterIdentity) return encounterIdentity;
  const familyId =
    creature.familyId && katchimeraFamilyById.has(creature.familyId)
      ? creature.familyId
      : familyIdFromCompanionId(creature.companionId);
  const family = familyId ? katchimeraFamilyById.get(familyId) : null;
  const anchorSkin = family ? katchimeraSkinById.get(family.anchorSkinId) : null;
  return anchorSkin ? identityForSkin(anchorSkin) : null;
}

export function withKatchimeraIdentity<T extends LocalCreatureRecord>(creature: T): T {
  const identity = identityForCreature(creature);
  return identity ? { ...creature, ...identity } : creature;
}

export function historyEntryForFamily(
  history: EncounterHistoryMap,
  familyId: KatchimeraFamilyId
): EncounterHistoryEntry | undefined {
  const direct = history[familyId] ?? history[companionIdForFamily(familyId)];
  if (direct) return direct;
  let count = 0;
  let lastSeenIsoDate = '';
  for (const [key, entry] of Object.entries(history)) {
    const identity = identityForEncounter(key, null);
    if (identity?.familyId !== familyId) continue;
    count += entry.count;
    if (entry.lastSeenIsoDate > lastSeenIsoDate) lastSeenIsoDate = entry.lastSeenIsoDate;
  }
  return count > 0 ? { count, lastSeenIsoDate } : undefined;
}

export function recordIdentityHatch(
  history: EncounterHistoryMap,
  identityKey: string,
  isoDate: string
): EncounterHistoryMap {
  const existing = history[identityKey];
  if (existing?.lastSeenIsoDate === isoDate) return history;
  return {
    ...history,
    [identityKey]: {
      count: (existing?.count ?? 0) + 1,
      lastSeenIsoDate: isoDate,
    },
  };
}

export function deriveIdentityHistories(
  legacyHistory: EncounterHistoryMap,
  creatures: readonly { creature: LocalCreatureRecord | null; isoDate: string }[]
): { aspectHistory: EncounterHistoryMap; skinHistory: EncounterHistoryMap } {
  let aspectHistory: EncounterHistoryMap = {};
  let skinHistory: EncounterHistoryMap = {};

  for (const [profileId, entry] of Object.entries(legacyHistory)) {
    const identity = identityForEncounter(profileId, null);
    if (!identity) continue;
    aspectHistory = mergeHistoryEntry(aspectHistory, identity.familyId, entry);
    skinHistory = mergeHistoryEntry(skinHistory, identity.skinId, entry);
  }

  for (const day of creatures) {
    if (!day.creature) continue;
    const identity = identityForCreature(day.creature);
    if (!identity) continue;
    aspectHistory = ensureHistoryDate(aspectHistory, identity.familyId, day.isoDate);
    skinHistory = ensureHistoryDate(skinHistory, identity.skinId, day.isoDate);
  }

  return { aspectHistory, skinHistory };
}

export function companionIdResolverForHomeState(
  state: Pick<StoredHomeState, 'archivedDays' | 'today' | 'tomorrow'> | null | undefined
): (value: string) => string {
  const byLegacyId = new Map<string, string>();
  for (const day of state ? [...state.archivedDays, state.today, ...(state.tomorrow ? [state.tomorrow] : [])] : []) {
    if (!day.creature) continue;
    const identity = identityForCreature(day.creature);
    if (!identity) continue;
    byLegacyId.set(day.creature.id, identity.companionId);
    if (day.creature.encounterProfileId) byLegacyId.set(day.creature.encounterProfileId, identity.companionId);
    // v17 briefly keyed companion systems by broad life aspect. The last
    // matching hatch is the best available owner for that legacy state.
    byLegacyId.set(`companion:${identity.aspectId}`, identity.companionId);
  }
  return (value: string) => {
    if (familyIdFromCompanionId(value)) return value;
    const mapped = byLegacyId.get(value);
    if (mapped) return mapped;
    const identity = identityForEncounter(value, null);
    return identity?.companionId ?? value;
  };
}

function identityForSkin(skin: KatchimeraSkinDefinition): KatchimeraIdentity {
  return {
    aspectId: skin.aspectId,
    familyId: skin.familyId,
    skinId: skin.id,
    companionId: companionIdForFamily(skin.familyId),
  };
}

function mergeHistoryEntry(
  history: EncounterHistoryMap,
  key: string,
  entry: EncounterHistoryEntry
): EncounterHistoryMap {
  const existing = history[key];
  return {
    ...history,
    [key]: {
      count: (existing?.count ?? 0) + entry.count,
      lastSeenIsoDate:
        existing && existing.lastSeenIsoDate > entry.lastSeenIsoDate
          ? existing.lastSeenIsoDate
          : entry.lastSeenIsoDate,
    },
  };
}

function ensureHistoryDate(
  history: EncounterHistoryMap,
  key: string,
  isoDate: string
): EncounterHistoryMap {
  const existing = history[key];
  if (!existing) return recordIdentityHatch(history, key, isoDate);
  return {
    ...history,
    [key]: {
      count: existing.count,
      lastSeenIsoDate: existing.lastSeenIsoDate > isoDate ? existing.lastSeenIsoDate : isoDate,
    },
  };
}
