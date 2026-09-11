import type { ConversationDefinition, ConversationSession, ConversationTraitId } from '@/types/companion-conversation';
import { conversationTraitTally } from './companion-conversation';

/**
 * Mossprout's theory of you. Not hundreds of tags: a handful of dimensions read
 * off the trait tally that the scenario questions build, plus the reward that
 * seems to matter most, the friction that comes up most, and the way Mossprout
 * should talk to this player. Every scenario answer nudges it; every "that's
 * very me / not really" is evidence too.
 */
export type TheoryDimension = 'starting' | 'progress' | 'difficulty' | 'risk' | 'selfExpectation' | 'social' | 'recovery';
export type TheoryReward = 'achievement' | 'connection' | 'calm' | 'novelty' | 'creativity';
export type TheoryFriction = 'starting' | 'consistency' | 'overwhelm' | 'focus' | 'energy' | 'completion';
export type MossproutStyle = 'gentle' | 'practical' | 'challenging' | 'humorous' | 'companion';

export type TheoryOfYou = {
  /** Scenario answers with trait tags, across every completed session. */
  evidence: number;
  /**
   * Each axis runs -1..1: starting deliberate→spontaneous, progress small-and-steady→bursts,
   * difficulty process-first→problem-solve, risk security→exploration,
   * selfExpectation perfectionistic→forgiving, social independent→collaborative,
   * recovery rest→activity. Zero until there is enough on both sides to say.
   */
  axes: Record<TheoryDimension, number>;
  reward: TheoryReward | null;
  friction: TheoryFriction | null;
  style: MossproutStyle;
  tally: Partial<Record<ConversationTraitId, number>>;
};

type Tally = Partial<Record<ConversationTraitId, number>>;
const at = (tally: Tally, ...traits: ConversationTraitId[]) => traits.reduce((sum, trait) => sum + (tally[trait] ?? 0), 0);
/** -1..1 from the weight on each side; needs at least three points between them to say anything. */
const axis = (positive: number, negative: number) => positive + negative >= 3 ? (positive - negative) / (positive + negative) : 0;

export function theoryOfYou(tally: Tally): TheoryOfYou {
  const evidence = Object.values(tally).reduce((sum, count) => sum + (count ?? 0), 0);
  const axes: Record<TheoryDimension, number> = {
    starting: axis(at(tally, 'spontaneity'), at(tally, 'planning')),
    progress: axis(at(tally, 'ambition', 'spontaneity'), at(tally, 'routine', 'planning')),
    difficulty: axis(at(tally, 'resilience', 'support_fix'), at(tally, 'overthinking', 'rest')),
    risk: axis(at(tally, 'novelty', 'curiosity', 'spontaneity'), at(tally, 'caution', 'routine')),
    selfExpectation: axis(at(tally, 'optimism', 'resilience'), at(tally, 'overthinking')),
    social: axis(at(tally, 'social', 'support_listen', 'support_cheer'), at(tally, 'solitude')),
    recovery: axis(at(tally, 'making', 'ambition'), at(tally, 'rest', 'solitude')),
  };
  const rewards: [TheoryReward, number][] = [
    ['achievement', at(tally, 'ambition')], ['connection', at(tally, 'social')], ['calm', at(tally, 'rest')],
    ['novelty', at(tally, 'novelty', 'curiosity')], ['creativity', at(tally, 'making')],
  ];
  const frictions: [TheoryFriction, number][] = [
    ['starting', at(tally, 'avoidance')], ['consistency', at(tally, 'spontaneity') - at(tally, 'routine')], ['overwhelm', at(tally, 'overthinking')],
    ['focus', at(tally, 'novelty')], ['energy', at(tally, 'rest')], ['completion', at(tally, 'ambition')],
  ];
  const lead = <T extends string>(entries: [T, number][], minimum: number): T | null => {
    const sorted = [...entries].sort((left, right) => right[1] - left[1]);
    const [first, second] = sorted;
    return first && first[1] >= minimum && (!second || first[1] > second[1]) ? first[0] : null;
  };
  const styles: [MossproutStyle, number][] = [
    ['gentle', at(tally, 'support_listen') + at(tally, 'rest') / 2], ['practical', at(tally, 'support_fix') + at(tally, 'planning') / 2],
    ['challenging', at(tally, 'ambition') / 2 + at(tally, 'resilience') / 2], ['humorous', at(tally, 'support_cheer')], ['companion', at(tally, 'support_stay')],
  ];
  return { evidence, axes, reward: lead(rewards, 3), friction: lead(frictions, 3), style: lead(styles, 2) ?? 'gentle', tally };
}

/** One thing Mossprout might say he has figured out, and when it is true enough to say. */
export type TheoryObservation = {
  id: string;
  /** What the observation is about; a "not really" answer quiets others about the same thing for a while. */
  about: TheoryDimension | 'reward' | 'friction' | 'style';
  text: string;
  when: (theory: TheoryOfYou) => boolean;
};

export const MOSSPROUT_THEORY_OBSERVATIONS: readonly TheoryObservation[] = [
  { id: 'start-line', about: 'starting', when: (t) => t.axes.starting <= -0.3 && t.friction === 'starting',
    text: 'I think you’re better at keeping things going than getting them started. You seem to make the beginning feel bigger than it needs to be.' },
  { id: 'start-now', about: 'starting', when: (t) => t.axes.starting >= 0.4,
    text: 'You seem happiest when you can start immediately. Too much planning might actually drain your excitement.' },
  { id: 'think-to-begin', about: 'starting', when: (t) => t.axes.starting <= -0.3 && at(t.tally, 'overthinking') >= 3,
    text: 'You don’t seem short on motivation. You seem to have trouble crossing the line between thinking about something and actually beginning it.' },
  { id: 'tiny-progress', about: 'progress', when: (t) => t.axes.progress <= -0.3,
    text: 'Tiny visible progress seems to work better on you than distant rewards.' },
  { id: 'big-chase', about: 'progress', when: (t) => t.axes.progress >= 0.4 && t.reward === 'achievement',
    text: 'Small steps are fine, but I think you really come alive when there’s something big to chase.' },
  { id: 'unfinished-first', about: 'selfExpectation', when: (t) => t.axes.selfExpectation <= -0.3,
    text: 'You notice what’s unfinished before you notice how far you’ve come.' },
  { id: 'too-many-seeds', about: 'friction', when: (t) => t.friction === 'completion',
    text: 'I think you’re quite good at growing things. Your problem might be planting too many at once.' },
  { id: 'solve-fast', about: 'difficulty', when: (t) => t.axes.difficulty >= 0.4,
    text: 'When things go wrong, you usually want to solve them quickly. I’m not sure you always give yourself much time to be annoyed first.' },
  { id: 'energy-not-motivation', about: 'friction', when: (t) => t.friction === 'energy' && (t.reward === 'achievement' || at(t.tally, 'ambition') >= 3),
    text: 'You often talk like you need more motivation, but your answers make me wonder if you mostly need more energy.' },
  { id: 'help-not-managed', about: 'style', when: (t) => t.style === 'gentle' && at(t.tally, 'support_listen', 'support_stay') > at(t.tally, 'support_fix'),
    text: 'You seem to want help without feeling managed. Tiny suggestions work better on you than someone telling you exactly what to do.' },
  { id: 'help-one-way', about: 'social', when: (t) => at(t.tally, 'support_listen', 'support_fix', 'support_cheer', 'support_stay') >= 4 && at(t.tally, 'solitude') >= 2,
    text: 'You’re pretty willing to help other people. You seem less enthusiastic when the direction of help is reversed.' },
  { id: 'adventurous', about: 'risk', when: (t) => t.axes.risk >= 0.4,
    text: 'Missing an opportunity seems to bother you more than getting something wrong. I think you’re more adventurous than you give yourself credit for.' },
  { id: 'people-then-space', about: 'recovery', when: (t) => t.axes.social >= 0.2 && t.axes.recovery <= -0.3,
    text: 'People seem important to your good days, but when things get difficult you usually want space first.' },
  { id: 'novelty-fuel', about: 'reward', when: (t) => t.reward === 'novelty' || (at(t.tally, 'novelty') >= 3 && at(t.tally, 'routine') <= 1),
    text: 'New things give you energy. Keeping them interesting might matter more for you than trying to become more disciplined.' },
  { id: 'achievement-days', about: 'reward', when: (t) => t.reward === 'achievement' && at(t.tally, 'rest') >= 2,
    text: 'You seem to judge a good day mostly by what you accomplished, even when you say feeling good matters more.' },
  { id: 'organise-vs-less', about: 'recovery', when: (t) => at(t.tally, 'planning') >= 3 && t.reward === 'calm',
    text: 'When you’re overwhelmed, your instinct is usually to get more organised. But the answers where you feel best tend to involve doing less.' },
  { id: 'momentum-not-failure', about: 'friction', when: (t) => at(t.tally, 'caution') <= 1 && (t.friction === 'consistency' || t.friction === 'focus'),
    text: 'You don’t seem especially afraid of failure. You’re much more vulnerable to losing momentum.' },
  { id: 'safe-surprise', about: 'risk', when: (t) => t.axes.risk > -0.2 && t.axes.risk < 0.3 && at(t.tally, 'curiosity') >= 3,
    text: 'You like knowing enough to feel safe, but not enough to spoil the surprise.' },
];

export const MOSSPROUT_THEORY_PREFIX = 'mossprout:theory:';
export const theoryDefinitionId = (observationId: string) => `${MOSSPROUT_THEORY_PREFIX}${observationId}`;
export type TheoryAnswer = 'very_me' | 'sometimes' | 'not_really';

/** What the player said to each observation, with how much evidence had been gathered by then. */
export function theoryConfirmations(sessions: readonly ConversationSession[]): Map<string, { answer: TheoryAnswer; completedAt: number }> {
  const confirmations = new Map<string, { answer: TheoryAnswer; completedAt: number }>();
  for (const session of sessions) {
    if (session.preview || !session.definitionId.startsWith(MOSSPROUT_THEORY_PREFIX)) continue;
    const answer = session.turns.find((turn) => turn.nodeId === 'confirm')?.optionId as TheoryAnswer | undefined;
    if (answer) confirmations.set(session.definitionId.slice(MOSSPROUT_THEORY_PREFIX.length), { answer, completedAt: session.completedAt ?? session.updatedAt });
  }
  return confirmations;
}

/** How much evidence arrived after a moment: answers with traits in sessions completed later. */
function evidenceSince(sessions: readonly ConversationSession[], definitions: ReadonlyMap<string, ConversationDefinition>, since: number): number {
  return Object.values(conversationTraitTally(sessions.filter((session) => (session.completedAt ?? session.updatedAt) > since), definitions)).reduce((sum, count) => sum + (count ?? 0), 0);
}

/** Bond level from which Mossprout starts saying what he thinks, and how many tagged answers he wants first. */
export const THEORY_MIN_BOND = 2;
export const THEORY_MIN_EVIDENCE = 8;
const THEORY_RETRY_EVIDENCE = 6;

/**
 * The next thing Mossprout would say he has figured out, or null: not enough
 * bond or evidence yet, one already said today, nothing true enough to say, or
 * everything true already confirmed. A "not really" quiets other observations
 * about the same thing until a good deal more evidence has come in.
 */
export function nextMossproutTheory(input: {
  sessions: readonly ConversationSession[];
  definitions: ReadonlyMap<string, ConversationDefinition>;
  bondLevel: number;
  dayId: string;
}): { observation: TheoryObservation; definitionId: string; theory: TheoryOfYou } | null {
  if (input.bondLevel < THEORY_MIN_BOND) return null;
  const theory = theoryOfYou(conversationTraitTally(input.sessions, input.definitions));
  if (theory.evidence < THEORY_MIN_EVIDENCE) return null;
  if (input.sessions.some((session) => !session.preview && session.definitionId.startsWith(MOSSPROUT_THEORY_PREFIX) && session.servedDayId === input.dayId)) return null;
  const confirmations = theoryConfirmations(input.sessions);
  const quiet = new Set<TheoryObservation['about']>();
  for (const [id, confirmation] of confirmations) {
    const observation = MOSSPROUT_THEORY_OBSERVATIONS.find((candidate) => candidate.id === id);
    if (observation && confirmation.answer === 'not_really' && evidenceSince(input.sessions, input.definitions, confirmation.completedAt) < THEORY_RETRY_EVIDENCE) quiet.add(observation.about);
  }
  const observation = MOSSPROUT_THEORY_OBSERVATIONS.find((candidate) => !confirmations.has(candidate.id) && !quiet.has(candidate.about) && candidate.when(theory));
  return observation ? { observation, definitionId: theoryDefinitionId(observation.id), theory } : null;
}

/**
 * How Mossprout should put a nudge to this player, once he has a theory. The
 * profile is not a report; it is how he talks. Callers pass what they would
 * have said plainly and get it in the style the answers earned.
 */
export function mossproutNudge(theory: TheoryOfYou, plain: string): string {
  if (theory.evidence < THEORY_MIN_EVIDENCE) return plain;
  if (theory.friction === 'completion') return `No. One seed. ${plain}`;
  switch (theory.style) {
    case 'gentle': return `I have an idea. You’re allowed to ignore it. ${plain}`;
    case 'practical': return `I’m not giving you three things. Pick one. ${plain}`;
    case 'challenging': return `I don’t think you’ll actually do this one. ${plain}`;
    case 'humorous': return `The frog bet me you wouldn’t. ${plain}`;
    case 'companion': return `No project. Just this, and me nearby. ${plain}`;
  }
}
