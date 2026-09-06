import type { KatchimeraFamilyId } from '@/types/katchimera';
import { canonicalFamilyId } from '@/constants/katchimera-skins';

export type QuestJournalContextOption = {
  id: string;
  label: string;
};

export type QuestJournalCaptureMode = 'guided' | 'note' | 'voice';

export type QuestJournalTemplate = {
  id: string;
  flowId: string;
  initialChoiceId?: string | null;
  allowedChoiceIds?: readonly string[];
  promptTitle: string;
  promptBody: string;
  contextTitle?: string;
  contextOptions?: readonly QuestJournalContextOption[];
  reviewLabel: string;
};

type QuestJournalTemplateInput = {
  id: string;
  title: string;
  hint: string;
  familyId?: KatchimeraFamilyId;
  journalRouteFallbacks?: readonly string[];
};

type QuestJournalRoute = Pick<QuestJournalTemplate, 'flowId' | 'initialChoiceId' | 'allowedChoiceIds'>;

const PEOPLE_CHOICES = ['partner', 'my_child', 'family', 'friends', 'group', 'someone_new', 'someone_else'] as const;

const AUTHORED_TEMPLATES: Record<string, Omit<QuestJournalTemplate, 'promptTitle' | 'promptBody' | 'reviewLabel'>> = {
  'quest-gatherglow-reach-out': {
    id: 'gatherglow.reach-out.v1',
    flowId: 'people',
    initialChoiceId: 'someone_else',
    allowedChoiceIds: PEOPLE_CHOICES,
    contextTitle: 'How did you reach out?',
    contextOptions: [
      { id: 'message', label: 'Sent a message' },
      { id: 'call', label: 'Called them' },
      { id: 'invitation', label: 'Made a plan' },
      { id: 'check_in', label: 'Checked in' },
    ],
  },
  'quest-gatherglow-deeper-checkin': {
    id: 'gatherglow.deeper-check-in.v1',
    flowId: 'people',
    initialChoiceId: 'someone_else',
    allowedChoiceIds: PEOPLE_CHOICES,
    contextTitle: 'What helped it feel real?',
    contextOptions: [
      { id: 'asked_more', label: 'Asked one more question' },
      { id: 'listened', label: 'Listened without rushing' },
      { id: 'shared_honestly', label: 'Shared something honestly' },
      { id: 'made_space', label: 'Made time and space' },
    ],
  },
  'quest-gatherglow-weekly-review': {
    id: 'gatherglow.connection-review.v1',
    flowId: 'people',
    initialChoiceId: 'someone_else',
    allowedChoiceIds: PEOPLE_CHOICES,
    contextTitle: 'What do you want to tend?',
    contextOptions: [
      { id: 'mutual', label: 'A mutual connection' },
      { id: 'return', label: 'Someone to return to' },
      { id: 'rhythm', label: 'A social rhythm to keep' },
      { id: 'boundary', label: 'A boundary that helps' },
    ],
  },
};

const FAMILY_DEFAULTS: Partial<Record<KatchimeraFamilyId, QuestJournalRoute>> = {
  flexel: { flowId: 'movement', initialChoiceId: 'workout', allowedChoiceIds: ['workout'] },
  sprintail: { flowId: 'movement', initialChoiceId: 'run', allowedChoiceIds: ['run'] },
  hooplet: { flowId: 'movement', initialChoiceId: 'sport', allowedChoiceIds: ['sport'] },
  serveling: { flowId: 'movement', initialChoiceId: 'sport', allowedChoiceIds: ['sport'] },
  snuglet: { flowId: 'people', initialChoiceId: 'someone_else', allowedChoiceIds: ['partner', 'my_child', 'family', 'someone_else'] },
  waglet: { flowId: 'people', initialChoiceId: 'pet', allowedChoiceIds: ['pet'] },
  whiskit: { flowId: 'people', initialChoiceId: 'pet', allowedChoiceIds: ['pet'] },
  flickerbun: { flowId: 'studio', initialChoiceId: 'film', allowedChoiceIds: ['film', 'show'] },
  relicoon: { flowId: 'went_somewhere', initialChoiceId: 'museum', allowedChoiceIds: ['museum'] },
  encora: { flowId: 'studio', initialChoiceId: 'music', allowedChoiceIds: ['music'] },
  gatherglow: { flowId: 'people', initialChoiceId: 'someone_else', allowedChoiceIds: PEOPLE_CHOICES },
  cheerlet: { flowId: 'big_event', initialChoiceId: 'achievement', allowedChoiceIds: ['achievement', 'milestone', 'firstTime'] },
  skylo: { flowId: 'went_somewhere', initialChoiceId: 'street', allowedChoiceIds: ['street', 'city', 'cafe', 'other_place'] },
  'coffee-ritual': { flowId: 'food', initialChoiceId: 'coffee', allowedChoiceIds: ['coffee', 'tea', 'drink'] },
  baristabbit: { flowId: 'food', initialChoiceId: 'coffee', allowedChoiceIds: ['coffee', 'tea', 'drink'] },
  tasklet: { flowId: 'work', initialChoiceId: 'planning', allowedChoiceIds: ['focus', 'planning', 'admin', 'progress'] },
  errandimp: { flowId: 'work', initialChoiceId: 'admin', allowedChoiceIds: ['admin', 'home_tasks'] },
  dawnle: { flowId: 'general', initialChoiceId: 'morning', allowedChoiceIds: ['morning'] },
  mendle: { flowId: 'general', initialChoiceId: 'difficult', allowedChoiceIds: ['difficult'] },
  quietome: { flowId: 'people', initialChoiceId: 'solo', allowedChoiceIds: ['solo'] },
  bedrotte: { flowId: 'general', initialChoiceId: 'rest', allowedChoiceIds: ['rest'] },
  'sleep-rest': { flowId: 'general', initialChoiceId: 'rest', allowedChoiceIds: ['rest'] },
  steppling: { flowId: 'movement', initialChoiceId: 'walk', allowedChoiceIds: ['walk'] },
  mossprout: { flowId: 'went_somewhere', initialChoiceId: 'park', allowedChoiceIds: ['park', 'garden', 'forest'] },
  feastle: { flowId: 'food', initialChoiceId: 'meal', allowedChoiceIds: ['meal', 'snack', 'dessert', 'cooking', 'other_food'] },
  pagelet: { flowId: 'studio', initialChoiceId: 'book', allowedChoiceIds: ['book'] },
  vesperitt: { flowId: 'general', initialChoiceId: 'rest', allowedChoiceIds: ['rest'] },
  shellio: { flowId: 'went_somewhere', initialChoiceId: 'beach', allowedChoiceIds: ['beach'] },
  heartmote: { flowId: 'people', initialChoiceId: 'partner', allowedChoiceIds: ['partner', 'family'] },
  kindling: { flowId: 'people', initialChoiceId: 'group', allowedChoiceIds: ['group'] },
  museling: { flowId: 'work', initialChoiceId: 'creative', allowedChoiceIds: ['creative'] },
  pixooka: { flowId: 'studio', initialChoiceId: 'game', allowedChoiceIds: ['game'] },
  voyagle: { flowId: 'went_somewhere', initialChoiceId: 'travel', allowedChoiceIds: ['travel', 'city', 'other_place'] },
};

/**
 * These Katchimera quests previously jumped to the generic Today journal.
 * They now use the same focused note/voice composer as reflection quests while
 * retaining a deterministic manual category on devices without Foundation.
 */
const JOURNAL_ENTRY_QUEST_IDS = new Set([
  'quest-coffee-ritual-pause',
  'quest-feastle-new-flavour',
  'quest-flickerbun-watch',
  'quest-read-book',
  'quest-relicoon-museum-visit',
  'quest-skylo-local-stop',
]);

const QUEST_ROUTE_OVERRIDES: Record<string, QuestJournalRoute> = {
  'quest-celebrate-note': { flowId: 'big_event', initialChoiceId: 'achievement', allowedChoiceIds: ['achievement', 'milestone'] },
  'quest-flickerbun-watch': { flowId: 'studio', initialChoiceId: 'film', allowedChoiceIds: ['film'] },
  'quest-flickerbun-scene-note': { flowId: 'studio', initialChoiceId: 'film', allowedChoiceIds: ['film'] },
  'quest-flickerbun-new-perspective': { flowId: 'studio', initialChoiceId: 'film', allowedChoiceIds: ['film'] },
  'quest-flickerbun-weekly-review': { flowId: 'studio', initialChoiceId: 'film', allowedChoiceIds: ['film'] },
  'quest-snuglet-caregiver-pause': { flowId: 'people', initialChoiceId: 'solo', allowedChoiceIds: ['solo'] },
  'quest-tasklet-focus': { flowId: 'work', initialChoiceId: 'focus', allowedChoiceIds: ['focus'] },
  'quest-tasklet-clear-three': { flowId: 'work', initialChoiceId: 'admin', allowedChoiceIds: ['admin'] },
  'quest-tasklet-weekly-review': { flowId: 'work', initialChoiceId: 'progress', allowedChoiceIds: ['progress'] },
  'quest-goal-note': { flowId: 'work', initialChoiceId: 'progress', allowedChoiceIds: ['progress'] },
};

export function questUsesJournalEntrySystem(questId: string): boolean {
  return JOURNAL_ENTRY_QUEST_IDS.has(questId);
}

export function questJournalTemplate(input: QuestJournalTemplateInput): QuestJournalTemplate {
  const authored = AUTHORED_TEMPLATES[input.id];
  const family = familyRoute(input);
  const route = parseJournalRoutes(input.journalRouteFallbacks);
  const override = QUEST_ROUTE_OVERRIDES[input.id];
  const routed = override ?? route ?? family ?? { flowId: 'general', initialChoiceId: 'ordinary', allowedChoiceIds: ['ordinary'] };
  const inferred = family && routed.flowId === family.flowId
    ? { ...family, ...routed, allowedChoiceIds: routed.allowedChoiceIds ?? family.allowedChoiceIds }
    : routed;
  const base = authored ?? {
    id: `${input.id.replace(/^quest-/, '')}.journal.v1`,
    ...inferred,
  };
  return {
    ...base,
    promptTitle: input.title,
    promptBody: input.hint,
    reviewLabel: input.title,
  };
}

export function companionJournalRouteForFamily(familyId: KatchimeraFamilyId): QuestJournalRoute {
  const canonical = canonicalFamilyId(familyId);
  return FAMILY_DEFAULTS[familyId]
    ?? (canonical ? FAMILY_DEFAULTS[canonical] : null)
    ?? { flowId: 'general', initialChoiceId: 'ordinary', allowedChoiceIds: ['ordinary'] };
}

function familyRoute(input: QuestJournalTemplateInput): QuestJournalRoute | null {
  const id = input.id.toLowerCase();
  if (id.includes('book') || id.includes('read')) return { flowId: 'studio', initialChoiceId: 'book', allowedChoiceIds: ['book'] };
  if (id.includes('music') || id.includes('listen')) return { flowId: 'studio', initialChoiceId: 'music', allowedChoiceIds: ['music'] };
  if (id.includes('meal') || id.includes('food')) return { flowId: 'food', initialChoiceId: 'meal', allowedChoiceIds: ['meal', 'snack', 'dessert', 'cooking', 'other_food'] };
  if (id.includes('walk')) return { flowId: 'movement', initialChoiceId: 'walk', allowedChoiceIds: ['walk'] };
  if (id.includes('rest') || id.includes('recovery') || id.includes('night')) return { flowId: 'general', initialChoiceId: 'rest', allowedChoiceIds: ['rest'] };
  if (id.includes('progress') || id.includes('finish')) return { flowId: 'work', initialChoiceId: 'progress', allowedChoiceIds: ['progress'] };
  return input.familyId ? companionJournalRouteForFamily(input.familyId) : null;
}

function parseJournalRoutes(values?: readonly string[]): QuestJournalRoute | null {
  const parsed = (values ?? []).flatMap((value) => {
    if (!value.startsWith('journal.route:')) return [];
    const [flowId, initialChoiceId] = value.slice('journal.route:'.length).split('.');
    return flowId && initialChoiceId ? [{ flowId, initialChoiceId }] : [];
  });
  const first = parsed[0];
  if (!first) return null;
  return {
    ...first,
    allowedChoiceIds: [...new Set(parsed.filter((item) => item.flowId === first.flowId).map((item) => item.initialChoiceId))],
  };
}
