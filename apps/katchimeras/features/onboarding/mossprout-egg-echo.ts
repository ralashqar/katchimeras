import type { FtueGuide, FtueRunState, FtueStepDefinition } from './ftue-types';

/**
 * The Egg answers each question with the answer, in Mossprout's voice, before
 * asking the next one. Reflecting the player's own words is the first proof
 * that something here is listening; a generic "your answer made it stir" is
 * not. Falls back to the authored guide for unknown or missing answers.
 */
const DAY_ECHOES: Readonly<Record<string, string>> = {
  radiant: 'That much light? Stand back.',
  light: 'A gentle day. It felt warm from in here.',
  meh: 'A quiet one. Those count too.',
  heavy: 'A heavy day. Then we start small.',
  stormy: 'Stormy. Come in out of it for a minute.',
};

const HELP_ECHOES: Readonly<Record<string, string>> = {
  progress: 'A little progress. Good, so do I.',
  calm: 'A little calm. We can make room for that.',
  unsure: 'Not sure yet. Neither am I. Let’s find out.',
};

export function mossproutEggGuide(
  step: Pick<FtueStepDefinition, 'id' | 'guide'> | null,
  run: Pick<FtueRunState, 'answers'> | null,
): FtueGuide | null {
  if (!step) return null;
  const echo = step.id === 'egg.context'
    ? DAY_ECHOES[run?.answers['egg.day_texture']?.optionId ?? '']
    : step.id === 'egg.ready'
      ? HELP_ECHOES[run?.answers['egg.desired_help']?.optionId ?? '']
      : undefined;
  return echo ? { ...step.guide, title: echo } : step.guide;
}
