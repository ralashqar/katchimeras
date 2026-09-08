import type { ConversationOption, ConversationSession, ConversationTurn } from '@/types/companion-conversation';
import type { WispId } from '@/types/wisp';

export const MOSSPROUT_JOURNEY_WISP_IDS = ['sprout', 'bloom', 'heartlet', 'breeze', 'giggle'] as const satisfies readonly WispId[];

const SIGNALS: readonly [pattern: RegExp, wispId: WispId][] = [
  [/quiet|calm|rest|listen|wait|soft|shelter|still|peace|slow/, 'breeze'],
  [/care|help|together|welcome|share|friend|gift|hold|support/, 'heartlet'],
  [/colour|color|flower|bloom|beaut|bright|petal|express/, 'bloom'],
  [/surprise|wonder|play|fun|mud|knock|curious|wild|adventure/, 'giggle'],
  [/grow|progress|begin|start|plant|path|forward|try|make/, 'sprout'],
];

export function mossproutWispAffinity(optionId: string, label = ''): Partial<Record<WispId, number>> {
  const text = `${optionId} ${label}`.toLocaleLowerCase();
  const matches = SIGNALS.filter(([pattern]) => pattern.test(text)).map(([, id]) => id);
  const primary = matches[0] ?? 'sprout';
  const secondary = matches.find((id) => id !== primary);
  return { [primary]: 2, ...(secondary ? { [secondary]: 1 } : {}) };
}

export function conversationOptionWispAffinity(familyId: string, option: ConversationOption) {
  return option.wispAffinity ?? (familyId === 'mossprout' ? mossproutWispAffinity(option.id, option.label) : undefined);
}

export function resolveJourneyWisp(input: {
  candidateWispIds: readonly WispId[];
  fallbackWispId: WispId;
  sessions: readonly ConversationSession[];
  after: number;
  extraOptionIds?: readonly string[];
}) {
  const candidates = new Set(input.candidateWispIds);
  const scores = new Map<WispId, number>();
  const lastSignalAt = new Map<WispId, number>();
  const turns: ConversationTurn[] = input.sessions
    .filter((session) => session.familyId === 'mossprout' && !session.preview)
    .flatMap((session) => session.turns)
    .filter((turn) => turn.answeredAt > input.after)
    .sort((left, right) => left.answeredAt - right.answeredAt);
  const apply = (affinity: Partial<Record<WispId, number>>, at: number) => {
    for (const [id, weight] of Object.entries(affinity) as [WispId, number][]) {
      if (!candidates.has(id) || !Number.isFinite(weight) || weight <= 0) continue;
      scores.set(id, (scores.get(id) ?? 0) + weight);
      lastSignalAt.set(id, at);
    }
  };
  turns.forEach((turn) => apply(turn.wispAffinity ?? mossproutWispAffinity(turn.optionId), turn.answeredAt));
  input.extraOptionIds?.forEach((optionId, index) => apply(mossproutWispAffinity(optionId), input.after + index + 1));
  const ordered = [...input.candidateWispIds].sort((left, right) => (
    (scores.get(right) ?? 0) - (scores.get(left) ?? 0)
    || (lastSignalAt.get(right) ?? 0) - (lastSignalAt.get(left) ?? 0)
    || input.candidateWispIds.indexOf(left) - input.candidateWispIds.indexOf(right)
  ));
  const wispId = (scores.get(ordered[0]!) ?? 0) > 0 ? ordered[0]! : input.fallbackWispId;
  return { wispId, choiceIds: [...new Set([...turns.map((turn) => turn.optionId), ...(input.extraOptionIds ?? [])])], scores: Object.fromEntries(scores) };
}
