import type { CardFacet, DailyCreatureCard } from '@/types/home';

const EMPTY_VALUES = new Set(['not logged', 'not noted', 'unknown', 'none']);

const PLACE_ALIASES: Record<string, string> = {
  'out & about': 'Out',
  'park or green space': 'Park',
  'somewhere else': 'Out',
};

const HIGHLIGHT_PATTERNS: [RegExp, string][] = [
  [/cinema|movie|film/i, 'Cinema'],
  [/coffee|caf[eé]/i, 'Café'],
  [/park|walk|stroll/i, 'Park walk'],
  [/friend|family|together|social/i, 'Together'],
  [/work|focus|project|making|creative/i, 'Deep work'],
  [/rest|quiet|calm|slow/i, 'Quiet moment'],
  [/food|meal|dinner|lunch|picnic/i, 'Shared meal'],
];

const HIGHLIGHT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'around', 'at', 'by', 'day', 'for', 'from', 'in', 'is', 'it',
  'moment', 'moments', 'of', 'on', 'the', 'this', 'to', 'was', 'with', 'your',
]);

export function compactFacetValue(facet: CardFacet): string {
  const value = facet.value.trim();
  if (!value || EMPTY_VALUES.has(value.toLowerCase())) return '—';
  if (facet.key === 'place') {
    const alias = PLACE_ALIASES[value.toLowerCase()];
    if (alias) return alias;
  }
  if (value.length <= 16) return value;
  return value.split(/\s+/).slice(0, 2).join(' ');
}

export function compactHighlight(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Quiet moment';
  const matched = HIGHLIGHT_PATTERNS.find(([pattern]) => pattern.test(trimmed));
  if (matched) return matched[1];
  const words = trimmed
    .replace(/[^\p{L}\p{N}'’-]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word && !HIGHLIGHT_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3);
  if (words.length === 0) return 'Daily spark';
  const phrase = words.join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function compactStoryLine(card: DailyCreatureCard): string {
  const tone = card.state.tone.toLowerCase();
  const trait = card.dayFacts?.bonusTrait?.label ?? card.traits[0]?.label;
  if (trait) return `A ${tone} companion shaped by ${trait.toLowerCase()}.`;
  return `A ${tone} companion shaped by this day.`;
}

export function compactCardQuote(card: DailyCreatureCard): string {
  const memorySpark = card.memorySpark?.caption.trim();
  return memorySpark || compactStoryLine(card);
}

export function formatCardSteps(steps: number): string {
  const safeSteps = Math.max(0, Math.round(steps));
  if (safeSteps < 1000) return safeSteps.toLocaleString();
  const precision = safeSteps >= 10_000 || safeSteps % 1000 === 0 ? 0 : 1;
  return `${(safeSteps / 1000).toFixed(precision)}k`;
}
