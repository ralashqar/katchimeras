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

/** Territory: what the lose card says, by how the level was lost; Keep going pulls the Mist back. */
export const ENCOUNTER_LOSS_V2 = {
  overrun: { title: 'The Mist has taken over.', body: 'It held too much of the ground this time. Let\u2019s try another way.' },
  choked: { title: 'The Mist has closed in.', body: 'There was no room left to merge. Let\u2019s try another way.' },
  spent: { title: 'Nothing left to merge.', body: 'The pieces ran out before the wisps did. Let\u2019s try another way.' },
  breached: { title: 'A wisp got through.', body: 'It reached the bottom of the board. Line your pieces up under the wisps and merge them bigger.' },
  keepGoing: 'Keep going \u00b7 push the Mist back',
} as const;

/** Territory: an intent said in a few words, for the chip's label and the screen reader. */
export const INTENT_WORDS: Readonly<Record<import('@/types/mission-mechanic').WispIntentKind, string>> = {
  surge: 'spreads its Mist', snuff: 'spreads its Mist', shroud: 'lays thick Mist', root: 'roots a cell', devour: 'eats a small piece',
  ward: 'raises a ward', mend: 'mends', call: 'calls another wisp', gather: 'gathers a heavy surge',
  burrow: 'burrows deeper', spores: 'drops a spore',
  rain: 'lets Mist fall', bind: 'binds a piece', shield: 'shields another',
  rest: 'has nowhere to spread', corrupt: 'spreads its Mist', move: 'drifts through its Mist',
};

/** Territory: the friend's warning when a wisp is one turn from spreading (no exclamation near the Mist). */
export const THREAT_LINE = 'It is about to spread. Clear around it first.';
export const GATHER_LINE = 'It is gathering. Hit it hard now and it will lose its hold.';
/** Merge vs Mist: the first lines a friend says in a battle (`docs/encounter-tactics.md`). */
export const SPREAD_LINE = 'Every time we merge, it spreads too. We have to push it back.';
export const EXPOSED_WISP_LINE = 'It is open. Merge right beside it.';
/** Territory: said when a wisp's nest first has an open cell beside it. */
export const EXPOSED_LINE = 'It is open. Merge right beside it.';

/**
 * v2: what is said when a wisp acts, over the board, for a beat. The Mist's voice: no exclamation near the Mist,
 * the Mist always capitalised, the wisps never named here (a line is about what happened, not who).
 */
export const WISP_ACT_LINES: Readonly<Record<'drifted' | 'bound' | 'held' | 'rained' | 'shielded' | 'surged' | 'spore_bloomed' | 'split' | 'staggered' | 'called' | 'burrowed' | 'warded' | 'ate' | 'root_mist' | 'shrouded' | 'spored' | 'mended', string>> = {
  drifted: 'It slipped away through the Mist. Clear around it and it has nowhere to go.',
  bound: 'The Mist closed over a piece. Glow on it frees it.',
  held: 'It held its ground. The Mist could not take it.',
  rained: 'Mist falls from above.',
  shielded: 'It shields another from above.',
  surged: 'The Mist spreads. It wants the ground back.',
  spore_bloomed: 'A spore opened into Mist.',
  split: 'It broke in two. The small one hides in the Mist.',
  staggered: 'It lost its hold. The gathered Mist falls apart.',
  called: 'Another one drifts in out of the Mist.',
  burrowed: 'It sank deeper into the Mist.',
  warded: 'It pulls the Mist around itself like a shield.',
  ate: 'Something small was taken into the Mist.',
  root_mist: 'Roots creep over a bed.',
  shrouded: 'Thick Mist settles beside it.',
  spored: 'A spore drifts onto a free bed. Put a piece on it.',
  mended: 'It knits itself back together.',
};
/** Which act is said when several happen on one turn: the one that matters most to the player. */
export const WISP_ACT_ORDER: readonly (keyof typeof WISP_ACT_LINES)[] = ['drifted', 'bound', 'held', 'rained', 'shielded', 'surged', 'spore_bloomed', 'split', 'staggered', 'called', 'burrowed', 'warded', 'ate', 'root_mist', 'shrouded', 'spored', 'mended'];

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
  abilityReady: 'I can clear a path through the Mist. Point me at it.',
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
