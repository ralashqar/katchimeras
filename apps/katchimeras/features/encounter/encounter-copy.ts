import type { EncounterGrade } from '@/types/encounter';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * What the Mist board says, in the lore's voice: the Mist is never scary
 * and never shouts; losing is the Mist being thick, not the player being
 * wrong; a friend's line may have an exclamation mark, the Mist's never.
 */
export const KEEP_GOING_RESOLVE = 5;

export const ENCOUNTER_LOSS = {
  eyebrow: 'Not yet',
  title: 'The Mist is still too thick.',
  body: 'Let’s try another way.',
  retry: 'Try again',
  keepGoing: `Keep going · +${KEEP_GOING_RESOLVE} Resolve`,
  leave: 'Leave it for now',
} as const;

export const CACHE_FOUND_LINE = 'Wait! I think there’s something underneath here.';

export function gradeLabel(grade: EncounterGrade): string {
  return grade === 'perfect' ? 'Perfect clear' : grade === 'bright' ? 'Bright clear' : 'Cleared';
}

/** The outcome's one line, by grade and how it was reached. */
export function outcomeLine(grade: EncounterGrade, input: { continues: number; rescued: boolean }): string {
  if (input.continues > 0) return 'Cleared, eventually. It held on. So did you.';
  if (grade === 'perfect') return 'Clean. It never saw you look.';
  if (grade === 'bright') return 'Bright. The Mist thinned before it knew.';
  return input.rescued ? 'Cleared, with a little help from under the Mist.' : 'Cleared.';
}

export type EncounterLineEvent = 'enter' | 'lowResolve' | 'abilityReady' | 'cacheFound' | 'spawnerEmpty' | 'stuck';

export type EncounterLineFacts = { remaining: number; katchimera: MergeCharacterId | null; ability: string | null };

const MOSSPROUT_LINES: Readonly<Record<EncounterLineEvent, string>> = {
  enter: 'Every move you make, the Mist watches. Make them count.',
  lowResolve: '{{remaining}} left. Make them count.',
  abilityReady: 'The leaf on my head is ready. Point me at a plant.',
  cacheFound: CACHE_FOUND_LINE,
  spawnerEmpty: 'The Pod is empty. Merge, and it fills a little.',
  stuck: 'Nothing left to merge. Let me look.',
};

const STEPPLING_LINES: Readonly<Record<EncounterLineEvent, string>> = {
  enter: 'I know where it’s thin. Follow me.',
  lowResolve: '{{remaining}} left. Pick the sure ones.',
  abilityReady: 'I can show you where the Mist is thin.',
  cacheFound: CACHE_FOUND_LINE,
  spawnerEmpty: 'Locker’s empty. Merge, and it fills a little.',
  stuck: 'Nothing left to merge. Let me look.',
};

const BARISTABBIT_LINES: Readonly<Record<EncounterLineEvent, string>> = {
  enter: 'Steady pours. That’s all it takes.',
  lowResolve: '{{remaining}} left. Steady.',
  abilityReady: 'One spawner, tended properly. Choose it.',
  cacheFound: CACHE_FOUND_LINE,
  spawnerEmpty: 'Bar’s dry. Merge, and it fills a little.',
  stuck: 'Nothing left to merge. Let me look.',
};

const MIST_LINES: Readonly<Record<EncounterLineEvent, string>> = {
  enter: 'The Mist watches every move.',
  lowResolve: '{{remaining}} left.',
  abilityReady: '',
  cacheFound: 'Something was under the Mist.',
  spawnerEmpty: 'The spawner is empty.',
  stuck: 'Nothing left to merge.',
};

const TABLES: Partial<Record<MergeCharacterId, Readonly<Record<EncounterLineEvent, string>>>> = { mossprout: MOSSPROUT_LINES, steppling: STEPPLING_LINES, baristabbit: BARISTABBIT_LINES };

/** The line for an event, in the Katchimera's voice when they have one; empty means nothing is said. */
export function encounterLine(event: EncounterLineEvent, facts: EncounterLineFacts): string {
  const table = (facts.katchimera && TABLES[facts.katchimera]) || MIST_LINES;
  return table[event].replace('{{remaining}}', String(facts.remaining)).replace('{{ability}}', facts.ability ?? '');
}

/** Resolve at or under this speaks up. */
export const LOW_RESOLVE = 3;
