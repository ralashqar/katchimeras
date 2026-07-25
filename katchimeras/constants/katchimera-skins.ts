import type { HomeVisualKey } from '@/types/home';
import type {
  KatchimeraCompanionId,
  KatchimeraFamilyId,
  KatchimeraSkinId,
  LifeAspectId,
} from '@/types/katchimera';

export type KatchimeraSkinDefinition = {
  id: KatchimeraSkinId;
  displayName: string;
  aspectId: LifeAspectId;
  familyId: KatchimeraFamilyId;
  visualKey: HomeVisualKey | null;
  // Existing encounter identities may temporarily borrow another render while
  // their final art is still planned. The wardrobe can show these playable
  // forms without claiming that their dedicated art exists.
  placeholderVisualKey?: HomeVisualKey;
  status: 'live' | 'dormant' | 'planned';
};

// Temporary testing policy. Turning this off restores hatch-derived ownership
// without changing wardrobe persistence or the Kingdom UI.
export const ALL_KATCHIMERA_SKINS_UNLOCKED = true;

const live = (
  id: HomeVisualKey,
  displayName: string,
  aspectId: LifeAspectId,
  familyId: KatchimeraFamilyId = id
): KatchimeraSkinDefinition => ({ id, displayName, aspectId, familyId, visualKey: id, status: 'live' });

const dormant = (
  id: HomeVisualKey,
  displayName: string,
  aspectId: LifeAspectId,
  familyId: KatchimeraFamilyId = id
): KatchimeraSkinDefinition => ({ id, displayName, aspectId, familyId, visualKey: id, status: 'dormant' });

export const katchimeraSkins: readonly KatchimeraSkinDefinition[] = [
  live('baristabbit', 'Baristabbit', 'daily-ritual', 'coffee-ritual'),
  dormant('lattelet', 'Lattelet', 'daily-ritual', 'coffee-ritual'),
  dormant('hearthsip', 'Hearthsip', 'daily-ritual', 'coffee-ritual'),

  live('feastle', 'Feastle', 'food-cooking'),
  live('crumbun', 'Crumbun', 'food-cooking'),
  live('hayhorn', 'Hayhorn', 'food-cooking'),
  live('crustling', 'Crustling', 'food-cooking'),
  live('nigirimp', 'Nigirimp', 'food-cooking'),
  live('noodloo', 'Noodloo', 'food-cooking'),
  live('sundael', 'Sundael', 'food-cooking'),
  live('bobaloo', 'Bobaloo', 'food-cooking'),

  live('flexel', 'Flexel', 'movement-fitness'),
  live('sprintail', 'Sprintail', 'movement-fitness'),
  live('steppling', 'Steppling', 'movement-fitness'),
  live('hooplet', 'Hooplet', 'movement-fitness'),
  live('serveling', 'Serveling', 'movement-fitness'),
  dormant('voltstep', 'Voltstep', 'movement-fitness'),
  dormant('pulsepounce', 'Pulsepounce', 'movement-fitness'),

  live('bedrotte', 'Bedrotte', 'rest-sleep', 'sleep-rest'),
  live('snoozle', 'Snoozle', 'rest-sleep', 'sleep-rest'),
  live('vesperitt', 'Vesperitt', 'rest-sleep'),
  live('dawnle', 'Dawnle', 'rest-sleep'),
  live('mendle', 'Mendle', 'emotional-recovery'),
  live('gatherglow', 'Gatherglow', 'social-connection'),
  live('snuglet', 'Snuglet', 'parenting-caregiving'),
  live('waglet', 'Waglet', 'pet-companionship'),
  live('whiskit', 'Whiskit', 'pet-companionship'),
  live('tasklet', 'Tasklet', 'work-focus'),
  dormant('creamalume', 'Creamalume', 'work-focus', 'tasklet'),
  live('errandimp', 'Errandimp', 'life-admin'),
  live('pagelet', 'Pagelet', 'learning-culture'),
  live('relicoon', 'Relicoon', 'learning-culture'),
  live('museling', 'Museling', 'hobbies-creativity'),
  live('flickerbun', 'Flickerbun', 'hobbies-creativity'),
  live('pixooka', 'Pixooka', 'hobbies-creativity'),
  live('encora', 'Encora', 'hobbies-creativity'),
  dormant('glimmuse', 'Glimmuse', 'hobbies-creativity'),
  live('mossprout', 'Mossprout', 'nature-outdoors'),
  live('shellio', 'Shellio', 'nature-outdoors'),
  live('petalimp', 'Petalimp', 'nature-outdoors'),
  live('fernip', 'Fernip', 'nature-outdoors'),
  live('amberleaf', 'Amberleaf', 'nature-outdoors'),
  live('blossle', 'Blossle', 'nature-outdoors'),
  live('peakle', 'Peakle', 'nature-outdoors'),
  live('stillo', 'Stillo', 'nature-outdoors'),
  live('drizzlet', 'Drizzlet', 'weather-atmosphere'),
  live('driftkin', 'Driftkin', 'weather-atmosphere'),
  live('duskle', 'Duskle', 'weather-atmosphere'),
  live('twinklet', 'Twinklet', 'weather-atmosphere'),
  live('tempesto', 'Tempesto', 'weather-atmosphere'),
  live('mistle', 'Mistle', 'weather-atmosphere'),
  live('voyagle', 'Voyagle', 'travel-exploration'),
  live('ironette', 'Ironette', 'travel-exploration'),
  live('neonpoko', 'Neonpoko', 'travel-exploration'),
  live('skylo', 'Skylo', 'travel-exploration'),
  dormant('skysette', 'Skysette', 'travel-exploration'),
  live('cheerlet', 'Cheerlet', 'milestones-chapters'),
  live('quietome', 'Quietome', 'reflection-solitude'),

  { id: 'signalhop', displayName: 'Signalhop', aspectId: 'commute-routes', familyId: 'signalhop', visualKey: null, placeholderVisualKey: 'neonpoko', status: 'planned' },
  { id: 'nestkin', displayName: 'Nestkin', aspectId: 'parenting-caregiving', familyId: 'nestkin', visualKey: null, placeholderVisualKey: 'snuglet', status: 'planned' },
  { id: 'kindling', displayName: 'Kindling', aspectId: 'contribution-community', familyId: 'kindling', visualKey: null, status: 'planned' },
  { id: 'heartmote', displayName: 'Heartmote', aspectId: 'social-connection', familyId: 'heartmote', visualKey: null, status: 'planned' },
  { id: 'chapterling', displayName: 'Chapterling', aspectId: 'milestones-chapters', familyId: 'chapterling', visualKey: null, status: 'planned' },
  { id: 'homecraft', displayName: 'Homecraft', aspectId: 'life-admin', familyId: 'homecraft', visualKey: null, status: 'planned' },
] as const;

export const katchimeraSkinById = new Map(katchimeraSkins.map((skin) => [skin.id, skin]));
export const katchimeraSkinByVisualKey = new Map(
  katchimeraSkins.flatMap((skin) => skin.visualKey ? [[skin.visualKey, skin] as const] : [])
);

export type KatchimeraFamilyDefinition = {
  id: KatchimeraFamilyId;
  displayName: string;
  aspectId: LifeAspectId;
  anchorSkinId: KatchimeraSkinId;
  anchorVisualKey: HomeVisualKey | null;
  skinIds: KatchimeraSkinId[];
};

export const katchimeraFamilies: readonly KatchimeraFamilyDefinition[] = [
  ...katchimeraSkins.reduce((families, skin) => {
    const existing = families.get(skin.familyId);
    if (existing) {
      existing.skinIds.push(skin.id);
      existing.anchorVisualKey ??= skin.visualKey ?? skin.placeholderVisualKey ?? null;
    } else {
      families.set(skin.familyId, {
        id: skin.familyId,
        displayName: skin.displayName,
        aspectId: skin.aspectId,
        anchorSkinId: skin.id,
        anchorVisualKey: skin.visualKey ?? skin.placeholderVisualKey ?? null,
        skinIds: [skin.id],
      });
    }
    return families;
  }, new Map<KatchimeraFamilyId, KatchimeraFamilyDefinition>()).values(),
];

export const katchimeraFamilyById = new Map(
  katchimeraFamilies.map((family) => [family.id, family])
);

export function companionIdForFamily(
  familyId: KatchimeraFamilyId
): KatchimeraCompanionId {
  return `companion:${familyId}`;
}

export function familyIdFromCompanionId(
  value: string | null | undefined
): KatchimeraFamilyId | null {
  if (!value?.startsWith('companion:')) return null;
  const id = value.slice('companion:'.length);
  return katchimeraFamilyById.has(id) ? id : null;
}
