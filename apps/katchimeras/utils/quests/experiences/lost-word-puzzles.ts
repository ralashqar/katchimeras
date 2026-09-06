import { seededShuffle } from './trivia-packs';

export type LostWordCategory = 'books' | 'writing' | 'stories' | 'genres' | 'imagination';

export type LostWordPuzzle = {
  id: string;
  answer: string;
  clue: string;
  broadClue: string;
  category: LostWordCategory;
  difficulty: 1 | 2 | 3;
  explanation: string;
  contentVersion: 1;
};

type PuzzleSeed = readonly [answer: string, clue: string];

const SEEDS: Record<LostWordCategory, readonly PuzzleSeed[]> = {
  books: [
    ['novel', 'A long work of fiction'], ['pages', 'Leaves you turn while reading'], ['spine', 'The bound edge of a book'],
    ['cover', 'The protective face of a book'], ['title', 'The name printed on a work'], ['index', 'An alphabetical guide at the back'],
    ['prose', 'Writing without a regular poetic rhythm'], ['verse', 'A line or group of poetic lines'], ['story', 'A tale with characters and events'],
    ['shelf', 'Where books wait in a row'], ['print', 'Words made visible in ink'], ['folio', 'A leaf or page in a manuscript'],
    ['atlas', 'A bound collection of maps'], ['comic', 'A story told with sequential pictures'], ['essay', 'A short piece exploring an idea'],
    ['diary', 'A personal day-by-day record'], ['fable', 'A brief tale with a lesson'], ['genre', 'A category of creative work'],
    ['quote', 'Words repeated from another source'], ['paper', 'The material of a traditional page'], ['bound', 'Fastened together like a finished book'],
    ['tomes', 'Large or scholarly books'], ['texts', 'Written works considered together'], ['poems', 'Works arranged for sound and rhythm'],
    ['plays', 'Stories written for the stage'], ['rhyme', 'Matching sounds at the ends of words'], ['draft', 'An unfinished version of a work'],
    ['epics', 'Long tales of heroic deeds'], ['works', 'An author’s creations collectively'], ['words', 'The smallest treasures on Pagelet’s shelves'],
  ],
  writing: [
    ['write', 'To put language into visible form'], ['inked', 'Marked or illustrated with ink'], ['edits', 'Changes that improve a draft'],
    ['notes', 'Short written reminders or observations'], ['comma', 'A punctuation mark for a small pause'], ['colon', 'A mark that introduces what follows'],
    ['tense', 'Grammar that locates an action in time'], ['verbs', 'Words that express actions or states'], ['nouns', 'Words naming people, places, or things'],
    ['scene', 'A unit of action in a story'], ['voice', 'A writer’s distinctive way of speaking'], ['style', 'The characteristic manner of expression'],
    ['motif', 'An image or idea repeated through a work'], ['theme', 'A central idea explored by a work'], ['meter', 'The rhythmic pattern of poetic lines'],
    ['lines', 'Rows of written or printed words'], ['blank', 'A page before the first word arrives'], ['erase', 'To remove marks or writing'],
    ['typed', 'Entered using keys rather than a pen'], ['quill', 'An old writing tool made from a feather'], ['proof', 'A copy checked before publication'],
    ['spell', 'To arrange the letters of a word'], ['usage', 'The customary way language is used'], ['serif', 'A small finishing stroke on a letter'],
    ['fonts', 'Designed families of letter shapes'], ['glyph', 'A visible symbol representing a character'], ['space', 'The gap separating written words'],
    ['marks', 'Visible signs made on a page'], ['parse', 'To analyse the grammar of a sentence'], ['caret', 'An editing mark showing where to insert text'],
  ],
  stories: [
    ['quest', 'A journey made in pursuit of a goal'], ['magic', 'Power beyond the rules of ordinary nature'], ['crown', 'A royal object worn on the head'],
    ['sword', 'A long-bladed weapon in many adventures'], ['ghost', 'A spirit said to haunt the living'], ['dream', 'A story the mind makes during sleep'],
    ['world', 'The complete setting of an imagined tale'], ['realm', 'A kingdom or domain'], ['ocean', 'A vast sea crossed in many adventures'],
    ['woods', 'A place of trees where tales often wander'], ['tower', 'A tall structure used for prisons or lookouts'], ['beast', 'A creature, often wild or legendary'],
    ['witch', 'A magic-user common in folklore'], ['giant', 'A person or creature of enormous size'], ['dwarf', 'A small legendary being in folklore'],
    ['fairy', 'A tiny magical being from folklore'], ['trail', 'A path left or followed through a journey'], ['vault', 'A secure place where secrets may be hidden'],
    ['rival', 'A character competing for the same goal'], ['twist', 'An unexpected change in a plot'], ['clues', 'Details that help solve a mystery'],
    ['risks', 'Possible dangers faced during an adventure'], ['brave', 'Ready to face fear or difficulty'], ['chase', 'A pursuit where someone follows another'],
    ['storm', 'Violent weather that raises the stakes'], ['night', 'The dark hours when many tales begin'], ['light', 'What drives darkness away'],
    ['begin', 'To start the tale'], ['event', 'Something that happens in a plot'], ['final', 'Coming at the very end'],
  ],
  genres: [
    ['crime', 'A genre centred on wrongdoing and detection'], ['drama', 'A serious story driven by conflict'], ['myths', 'Traditional tales explaining a culture or world'],
    ['manga', 'Japanese comics and graphic narratives'], ['noirs', 'Dark crime stories with moral shadows'], ['lyric', 'Poetry expressing personal feeling'],
    ['poesy', 'An old-fashioned word for poetry'], ['tales', 'Stories, especially imaginative ones'], ['humor', 'Writing intended to amuse'],
    ['chill', 'The feeling a frightening story may give'], ['agent', 'An investigator or operative in a thriller'], ['eerie', 'Strangely frightening or uncanny'],
    ['funny', 'Likely to make a reader laugh'], ['stage', 'Where a dramatic script is performed'], ['acted', 'Performed as a character'],
    ['cases', 'Mysteries investigated by detectives'], ['blood', 'A frequent sign of danger in horror'], ['haunt', 'To visit repeatedly as a ghost'],
    ['alien', 'A being from somewhere beyond Earth'], ['robot', 'A machine that acts with some autonomy'], ['heart', 'A symbol often central to romance'],
    ['loves', 'Feels deep affection'], ['laugh', 'A sound comedy tries to inspire'], ['tears', 'Drops that emotional stories may bring'],
    ['dread', 'Fear of something that may happen'], ['spies', 'Secret agents at the centre of thrillers'], ['heist', 'A carefully planned robbery story'],
    ['query', 'A question that asks to be resolved'], ['canon', 'Works accepted as belonging to a story world'], ['sagas', 'Long stories following great events or families'],
  ],
  imagination: [
    ['ideas', 'Thoughts that might grow into stories'], ['image', 'A picture formed in the mind'], ['spark', 'A tiny beginning that ignites creativity'],
    ['think', 'To use the mind to form ideas'], ['fancy', 'Imagination, especially something playful'], ['vivid', 'So clear it seems almost real'],
    ['minds', 'Places where imagination happens'], ['shape', 'The form an idea begins to take'], ['color', 'A quality that makes imagined scenes bright'],
    ['sound', 'What an imagined world might let you hear'], ['inner', 'Existing within the mind or self'], ['awake', 'Alert and ready for a new idea'],
    ['cloud', 'A drifting shape often compared to dreams'], ['stars', 'Lights that inspire stories in the night sky'], ['moons', 'Natural satellites in real and imagined worlds'],
    ['wisps', 'Thin drifting traces, like half-formed ideas'], ['gleam', 'A small flash of light or inspiration'], ['bloom', 'To open or develop fully'],
    ['float', 'To move lightly without sinking'], ['wings', 'What lets an imagined creature fly'], ['build', 'To assemble an idea piece by piece'],
    ['craft', 'To make something with skill and care'], ['forms', 'Takes shape or comes into being'], ['drawn', 'Made with lines, or strongly attracted'],
    ['paint', 'To create an image using colour'], ['music', 'Organised sound that can suggest whole worlds'], ['dance', 'Movement arranged with rhythm'],
    ['smile', 'An expression a joyful idea may bring'], ['happy', 'Feeling pleasure or contentment'], ['peace', 'A quiet state without conflict'],
  ],
};

const CATEGORY_CLUES: Record<LostWordCategory, string> = {
  books: 'Something found in or around books',
  writing: 'Something from the craft of writing',
  stories: 'Something that belongs in a story',
  genres: 'A word connected to a kind of story',
  imagination: 'Something connected to imagination',
};

export const LOST_WORD_PUZZLES: LostWordPuzzle[] = (Object.entries(SEEDS) as [LostWordCategory, readonly PuzzleSeed[]][])
  .flatMap(([category, seeds]) => seeds.map(([answer, clue], index) => ({
    id: `lost-word:${category}:${answer}`,
    answer,
    clue,
    broadClue: CATEGORY_CLUES[category],
    category,
    difficulty: (Math.min(3, Math.floor(index / 10) + 1)) as 1 | 2 | 3,
    explanation: `${answer.toUpperCase()} — ${clue}.`,
    contentVersion: 1 as const,
  })));

export function selectLostWordPuzzle(seed: string, recentPuzzleIds: string[] = []): LostWordPuzzle {
  const recent = new Set(recentPuzzleIds);
  const fresh = LOST_WORD_PUZZLES.filter((puzzle) => !recent.has(puzzle.id));
  const source = fresh.length ? fresh : LOST_WORD_PUZZLES;
  return seededShuffle(source, seed)[0];
}

export function lostWordPuzzleById(id: string): LostWordPuzzle | null {
  return LOST_WORD_PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function validateLostWordPuzzles(puzzles: LostWordPuzzle[] = LOST_WORD_PUZZLES): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const answers = new Set<string>();
  for (const puzzle of puzzles) {
    if (ids.has(puzzle.id)) errors.push(`Duplicate puzzle id: ${puzzle.id}`);
    if (answers.has(puzzle.answer)) errors.push(`Duplicate puzzle answer: ${puzzle.answer}`);
    if (!/^[a-z]{5}$/.test(puzzle.answer)) errors.push(`${puzzle.id} must use a five-letter A-Z answer`);
    if (!puzzle.clue.trim() || !puzzle.broadClue.trim()) errors.push(`${puzzle.id} is missing a clue`);
    ids.add(puzzle.id);
    answers.add(puzzle.answer);
  }
  return errors;
}
