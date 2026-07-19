import type { DayEvidenceProvider, JournalNoteClassification, JournalRouteProposal, StudioMediaType } from '@/types/home';
import { JOURNAL_CLASSIFICATION_CATALOG, journalCatalogEntry } from '@/utils/journal-classification-catalog';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';
import { detectStudioInText } from '@/utils/studio-detect';

export type FoundationAtomicRouteRead = {
  routeKey?: unknown;
  alternativeRouteKey?: unknown;
  routeConfidence?: unknown;
  alternativeRouteConfidence?: unknown;
  specific?: unknown;
  context?: unknown;
  journalFeeling?: unknown;
};

export function journalRouteForQuality(qualityId: string, confidence = 1, reason = 'Matched canonical journal category'): JournalRouteProposal | null {
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    const choice = flow.choices.find((item) => item.qualityIds?.includes(qualityId));
    if (choice) return proposal(flow.id, choice.id, choice.label, confidence, reason, choice.confirmedFacets ?? []);
  }
  return null;
}

export function journalRouteForAlias(value: string, confidence: number, reason: string): JournalRouteProposal | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, ' ');
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    const choice = flow.choices.find((item) => item.routeAliases?.some((alias) => alias.toLowerCase().replace(/_/g, ' ') === normalized));
    if (choice) return proposal(flow.id, choice.id, choice.label, confidence, reason, choice.confirmedFacets ?? []);
  }
  return null;
}

export function journalRouteForIds(flowId: string, categoryId: string, confidence = 0.95, reason = 'Apple Foundation classified this note'): JournalRouteProposal | null {
  const resolved = resolveJournalIds(flowId, categoryId);
  const flow = MANUAL_JOURNAL_FLOWS.find((item) => item.id === resolved?.flowId);
  const choice = flow?.choices.find((item) => item.id === resolved?.categoryId);
  return flow && choice ? proposal(flow.id, choice.id, choice.label, confidence, reason, choice.confirmedFacets ?? []) : null;
}

export function journalRouteForKey(routeKey: string, confidence = 0.95, reason = 'Apple Foundation classified this note'): JournalRouteProposal | null {
  const entry = journalCatalogEntry(routeKey);
  return entry ? journalRouteForIds(entry.flowId, entry.categoryId, confidence, reason) : null;
}

export function foundationAtomicRoutes(raw: FoundationAtomicRouteRead | null | undefined, reason = 'Apple Foundation classified this note'): JournalRouteProposal[] {
  if (!raw) return [];
  const primaryKey = cleanId(raw.routeKey);
  const alternativeKey = cleanId(raw.alternativeRouteKey);
  const primary = primaryKey && primaryKey !== 'ambiguous'
    ? journalRouteForKey(primaryKey, primaryKey === 'general.other' ? Math.min(0.68, confidence(raw.routeConfidence, 0.6)) : confidence(raw.routeConfidence, 0.5), reason)
    : null;
  const alternative = alternativeKey && alternativeKey !== 'ambiguous' && alternativeKey !== primaryKey
    ? journalRouteForKey(alternativeKey, confidence(raw.alternativeRouteConfidence, 0), `${reason} as an alternative`)
    : null;
  return rankJournalRoutes([primary, alternative]);
}

export function registryJournalRoutes(transcript: string): JournalRouteProposal[] {
  const text = normalizedPhrase(transcript);
  if (!text) return [];
  const consumedMedia = detectStudioInText(transcript);
  const consumedMediaRoute = consumedMedia.detected && consumedMedia.mediaType === 'other'
    ? journalRouteForKey('studio.other_media', 0.97, 'Detected explicit watched or listened media')
    : null;
  const candidates = JOURNAL_CLASSIFICATION_CATALOG.flatMap((entry) => {
    const genericDestination = entry.routeKey === 'general.other' || entry.categoryId.startsWith('other_') || entry.categoryId === 'milestone';
    const excluded = entry.exclusions.some((value) => phraseRelated(text, normalizedPhrase(value)));
    if (excluded) return [];
    const exactExample = entry.examples.some((value) => normalizedPhrase(value) === text);
    const relatedExample = entry.examples.some((value) => phraseRelated(text, normalizedPhrase(value)));
    const matchedAliases = (genericDestination ? [] : entry.aliases)
      .map(normalizedPhrase)
      .filter((value) => value.length >= 3 && containsPhrase(text, value));
    const bestAlias = matchedAliases.sort((left, right) => right.length - left.length)[0];
    const score = exactExample ? 0.98 : relatedExample ? 0.94 : bestAlias ? (bestAlias.includes(' ') ? 0.9 : 0.84) : 0;
    return score ? [journalRouteForKey(entry.routeKey, score, exactExample || relatedExample ? 'Matched a registry example' : `Matched journal signal “${bestAlias}”`)] : [];
  });
  return rankJournalRoutes([consumedMediaRoute, ...candidates], 3);
}

export function foundationAtomicNeedsRetry(
  transcript: string,
  raw: FoundationAtomicRouteRead | null | undefined,
  options: { includeRegistryEvidence?: boolean } = {}
): boolean {
  const routes = foundationAtomicRoutes(raw);
  const first = routes[0];
  const registry = options.includeRegistryEvidence === false ? null : registryJournalRoutes(transcript)[0];
  if (!first || cleanId(raw?.routeKey) === 'ambiguous' || first.id === 'general.other') return true;
  if (first.confidence < 0.82 || first.confidence - (routes[1]?.confidence ?? 0) < 0.15) return true;
  return !!registry && registry.id !== first.id && registry.confidence >= 0.9;
}

export function resolveFoundationRouteEvidence(
  transcript: string,
  first: FoundationAtomicRouteRead | null | undefined,
  retry: FoundationAtomicRouteRead | null | undefined,
  options: { includeRegistryEvidence?: boolean } = {}
): { routes: JournalRouteProposal[]; selected: JournalRouteProposal | null; decisionSource: JournalNoteClassification['decisionSource'] } {
  const registryEvidence = options.includeRegistryEvidence === false ? [] : registryJournalRoutes(transcript);
  const evidence = [
    ...foundationAtomicRoutes(first, 'Apple Foundation first pass').map((route) => ({ route, source: 'foundation' as const })),
    ...foundationAtomicRoutes(retry, 'Apple Foundation focused retry').map((route) => ({ route, source: 'foundationRetry' as const })),
    ...registryEvidence.map((route) => ({ route, source: 'registry' as const })),
  ];
  const grouped = new Map<string, typeof evidence>();
  for (const item of evidence) grouped.set(item.route.id, [...(grouped.get(item.route.id) ?? []), item]);
  const strongestSupport = Math.max(0, ...[...grouped.values()].map((items) => new Set(items.map((item) => item.source)).size));
  const merged = [...grouped.values()].map((items) => {
    const support = new Set(items.map((item) => item.source));
    const best = [...items].sort((left, right) => right.route.confidence - left.route.confidence)[0].route;
    let score = best.confidence;
    if (support.size >= 2) score = Math.min(1, score + 0.08);
    else if (strongestSupport >= 2) score *= 0.88;
    if (best.id === 'general.other') score = Math.min(score, 0.68);
    return { ...best, confidence: score, reasons: [...new Set(items.flatMap((item) => item.route.reasons))] };
  });
  const routes = rankJournalRoutes(merged, 3);
  const selected = journalNoteRouteNeedsConfirmation(routes) ? null : routes[0] ?? null;
  const selectedEvidence = selected ? grouped.get(selected.id) ?? [] : [];
  const sources = new Set(selectedEvidence.map((item) => item.source));
  const decisionSource: JournalNoteClassification['decisionSource'] = !selected
    ? 'generic'
    : sources.has('registry') && sources.size >= 2
      ? 'registryCorroborated'
      : sources.has('foundationRetry')
        ? 'foundationRetry'
        : 'foundation';
  return { routes, selected, decisionSource };
}

export function classificationForResolvedRoute(
  route: JournalRouteProposal,
  raw: FoundationAtomicRouteRead,
  decisionSource: JournalNoteClassification['decisionSource']
): JournalNoteClassification | null {
  const parsed = parseFoundationJournalClassification({
    classificationKind: route.id === 'general.other' ? 'generic' : 'categorized',
    flowId: route.flowId,
    categoryId: route.choiceId,
    specific: raw.specific,
    context: raw.context,
    journalFeeling: raw.journalFeeling,
  });
  return parsed ? { ...parsed, confidence: route.confidence, decisionSource } : null;
}

export function foundationNoteRoute(input: {
  classification?: JournalNoteClassification | null;
  provider?: DayEvidenceProvider;
  llmClassified?: boolean;
  mediaType?: StudioMediaType | null;
}): JournalRouteProposal | null {
  const classification = input.classification;
  if (classification?.flowId && classification.categoryId && classification.kind !== 'ambiguous') {
    return journalRouteForIds(
      classification.flowId,
      classification.categoryId,
      classification.kind === 'generic' ? 1 : 0.95,
      classification.kind === 'generic' ? 'Apple Foundation identified a generic note' : 'Apple Foundation classified this note'
    );
  }
  if (input.provider !== 'appleFoundation' || !input.llmClassified || !input.mediaType) return null;
  const categoryId = input.mediaType === 'other' ? 'other_media' : input.mediaType;
  return journalRouteForIds('studio', categoryId, 0.92, 'Apple Foundation identified the media type');
}

export function parseFoundationJournalClassification(raw: {
  classificationKind?: unknown;
  flowId?: unknown;
  categoryId?: unknown;
  specific?: unknown;
  context?: unknown;
  journalFeeling?: unknown;
}): JournalNoteClassification | null {
  const requestedKind = normalizedToken(cleanId(raw.classificationKind));
  const inferredRoute = resolveJournalIds(cleanId(raw.flowId), cleanId(raw.categoryId));
  const kind = normalizeClassificationKind(requestedKind, !!inferredRoute);
  if (!kind) return null;
  if (kind === 'ambiguous') return emptyClassification('ambiguous');

  const resolved = kind === 'generic' ? { flowId: 'general', categoryId: 'other' } : inferredRoute;
  const flow = MANUAL_JOURNAL_FLOWS.find((item) => item.id === resolved?.flowId);
  const choice = flow?.choices.find((item) => item.id === resolved?.categoryId);
  if (!flow || !choice) return null;

  const contexts = choice.contextChoices ?? flow.contextChoices ?? [];
  const feelings = choice.feelings ?? flow.feelings;
  const contextId = resolveOptionId(contexts, cleanId(raw.context));
  const feelingId = resolveOptionId(feelings, cleanId(raw.journalFeeling));
  return {
    kind,
    flowId: flow.id,
    categoryId: choice.id,
    fields: {
      specific: cleanText(raw.specific, 120),
      context: contextId,
    },
    feeling: feelingId,
    provider: 'appleFoundation',
  };
}

export function rankJournalRoutes(routes: Array<JournalRouteProposal | null>, limit = 3): JournalRouteProposal[] {
  const byId = new Map<string, JournalRouteProposal>();
  for (const route of routes) {
    if (!route) continue;
    const prior = byId.get(route.id);
    if (!prior || route.confidence > prior.confidence) byId.set(route.id, route);
  }
  return [...byId.values()].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)).slice(0, limit);
}

export function journalRouteNeedsConfirmation(routes: JournalRouteProposal[]): boolean {
  const first = routes[0];
  return !first || first.confidence < 0.72 || first.confidence - (routes[1]?.confidence ?? 0) < 0.15;
}

export function journalNoteRouteNeedsConfirmation(routes: JournalRouteProposal[]): boolean {
  // Note routes are already constrained to the generated journal taxonomy and
  // checked for a meaningful lead over the next candidate. Requiring 0.82 here
  // caused valid, single-route Foundation decisions to be discarded after the
  // model had already resolved them, which reopened the top-level picker and
  // also prevented the model-generated detail from being seeded into the form.
  return journalRouteNeedsConfirmation(routes);
}

function proposal(flowId: string, choiceId: string, label: string, confidence: number, reason: string, confirmedFacets: JournalRouteProposal['confirmedFacets']): JournalRouteProposal {
  return { id: `${flowId}.${choiceId}`, flowId, choiceId, label, confidence: Math.max(0, Math.min(1, confidence)), reasons: [reason], confirmedFacets };
}

function emptyClassification(kind: 'ambiguous'): JournalNoteClassification {
  return { kind, flowId: null, categoryId: null, fields: { specific: null, context: null }, feeling: null, provider: 'appleFoundation' };
}

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function confidence(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function normalizedPhrase(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  return !!phrase && (` ${text} `).includes(` ${phrase} `);
}

function phraseRelated(text: string, phrase: string): boolean {
  return !!phrase && (text === phrase || (phrase.length >= 8 && (text.includes(phrase) || phrase.includes(text))));
}

function normalizedToken(value: string | null): string | null {
  return value
    ?.trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || null;
}

function normalizeFlowId(value: string | null): string | null {
  const token = normalizedToken(value);
  if (!token) return null;
  const canonical = MANUAL_JOURNAL_FLOWS.find((flow) => normalizedToken(flow.id) === token);
  return canonical?.id ?? FLOW_ALIASES[token] ?? null;
}

function normalizeCategoryId(flowId: string, value: string | null): string | null {
  const token = normalizedToken(value);
  if (!token) return null;
  const flow = MANUAL_JOURNAL_FLOWS.find((item) => item.id === flowId);
  const canonical = flow?.choices.find((choice) => [choice.id, choice.label, ...(choice.routeAliases ?? [])].some((alias) => normalizedToken(alias) === token));
  return canonical?.id ?? CATEGORY_ALIASES[flowId]?.[token] ?? null;
}

function resolveJournalIds(flowValue: string | null, categoryValue: string | null): { flowId: string; categoryId: string } | null {
  const flowId = normalizeFlowId(flowValue);
  if (flowId) {
    const categoryId = normalizeCategoryId(flowId, categoryValue);
    if (categoryId) return { flowId, categoryId };
  }
  const matches = MANUAL_JOURNAL_FLOWS.flatMap((flow) => {
    const categoryId = normalizeCategoryId(flow.id, categoryValue);
    return categoryId ? [{ flowId: flow.id, categoryId }] : [];
  });
  return matches.length === 1 ? matches[0] : null;
}

function resolveOptionId(options: ReadonlyArray<{ id: string; label: string }>, value: string | null): string | null {
  const token = normalizedToken(value);
  return options.find((option) => normalizedToken(option.id) === token || normalizedToken(option.label) === token)?.id ?? null;
}

function normalizeClassificationKind(value: string | null, hasRoute: boolean): JournalNoteClassification['kind'] | null {
  if (!value && hasRoute) return 'categorized';
  if (value === 'categorized' || value === 'classified' || value === 'clear' || value === 'specific') return 'categorized';
  if (value === 'generic' || value === 'uncategorized' || value === 'general' || value === 'other') return 'generic';
  if (value === 'ambiguous' || value === 'uncertain' || value === 'unknown' || value === 'needs_review') return 'ambiguous';
  return null;
}

const FLOW_ALIASES: Record<string, string> = {
  place: 'went_somewhere', places: 'went_somewhere', location: 'went_somewhere', locations: 'went_somewhere', outing: 'went_somewhere', destination: 'went_somewhere', visited: 'went_somewhere',
  meal: 'food', meals: 'food', eating: 'food', dining: 'food', food_and_drink: 'food', drink: 'food', drinks: 'food',
  media: 'studio', entertainment: 'studio', culture: 'studio', watched: 'studio', watching: 'studio', reading: 'studio', listening: 'studio', movie: 'studio', movies: 'studio',
  activity: 'movement', exercise: 'movement', fitness: 'movement', moved: 'movement', sport: 'movement', sports: 'movement',
  person: 'people', relationship: 'people', relationships: 'people', social: 'people', company: 'people',
  job: 'work', productivity: 'work', learning: 'work', project: 'work', study: 'work',
  event: 'big_event', life_event: 'big_event', milestone: 'big_event', celebration: 'big_event', special_event: 'big_event',
  note: 'general', notes: 'general', reflection: 'general', moment: 'general', other: 'general', uncategorized: 'general',
};

const CATEGORY_ALIASES: Record<string, Record<string, string>> = {
  went_somewhere: {
    green_space: 'park', playground: 'park', town: 'city', downtown: 'city', coast: 'beach', seaside: 'beach', woods: 'forest', trail: 'forest', botanical_garden: 'garden',
    gallery: 'museum', exhibition: 'museum', history_museum: 'museum', natural_history_museum: 'museum', national_history_museum: 'museum', coffee_shop: 'cafe', coffee_house: 'cafe', diner: 'restaurant', neighbourhood: 'street', neighborhood: 'street', house: 'home', day_trip: 'travel', outing: 'travel', trip: 'travel', somewhere_else: 'other_place', other: 'other_place',
  },
  food: {
    breakfast: 'meal', lunch: 'meal', dinner: 'meal', brunch: 'meal', dish: 'meal', sweets: 'dessert', cake: 'dessert', pudding: 'dessert', beverage: 'drink', cocktail: 'drink', beer: 'drink', wine: 'drink', baking: 'cooking', cooked: 'cooking', homemade: 'cooking', other: 'other_food',
  },
  studio: {
    audiobook: 'book', novel: 'book', movie: 'film', movies: 'film', cinema: 'film', motion_picture: 'film', tv: 'show', television: 'show', tv_show: 'show', series: 'show', episode: 'show', video_game: 'game', videogame: 'game', album: 'music', song: 'music', concert: 'music', exhibition: 'art', gallery: 'art', news: 'other_media', live_sport: 'other_media', sports_event: 'other_media', livestream: 'other_media', online_video: 'other_media', other: 'other_media',
  },
  movement: {
    walking: 'walk', stroll: 'walk', running: 'run', jog: 'run', jogging: 'run', cycling: 'cycle', bike: 'cycle', biking: 'cycle', gym: 'workout', exercise: 'workout', fitness: 'workout', sports: 'sport', hiking: 'hike', shopping: 'errands', chores: 'errands', transit: 'commute', commuting: 'commute', drive: 'commute', journey: 'travel', trip: 'travel', mixed_activity: 'mixed',
  },
  people: {
    spouse: 'partner', husband: 'partner', wife: 'partner', boyfriend: 'partner', girlfriend: 'partner', child: 'my_child', kid: 'my_child', son: 'my_child', daughter: 'my_child', relatives: 'family', friend: 'friends', gathering: 'group', crowd: 'group', new_person: 'someone_new', stranger: 'someone_new', dog: 'pet', cat: 'pet', animal: 'pet', alone: 'solo', myself: 'solo', me: 'solo', colleague: 'someone_else', coworker: 'someone_else', other: 'someone_else',
  },
  work: {
    deep_work: 'focus', productive_work: 'focus', workplace: 'office', workday: 'office', studying: 'learning', study: 'learning', course: 'learning', plan: 'planning', creative_project: 'creative', making: 'creative', paperwork: 'admin', chores: 'admin', accomplishment: 'progress', promotion: 'progress', other: 'other_work',
  },
  big_event: {
    first: 'firstTime', first_time: 'firstTime', vacation: 'holiday', festive_holiday: 'holiday', journey: 'trip', travel: 'trip', accomplishment: 'achievement', promotion: 'achievement', new_baby: 'baby', birth: 'baby', married: 'wedding', degree: 'graduation', new_home: 'newHome', moved_house: 'newHome', new_job: 'newJob', career_change: 'newJob', family_reunion: 'reunion', other: 'milestone',
  },
  general: {
    best_moment: 'highlight', hard_moment: 'difficult', challenge: 'difficult', grateful: 'gratitude', thankful: 'gratitude', something_new: 'new', recovery: 'rest', relaxing: 'rest', everyday: 'ordinary', normal: 'ordinary', generic: 'other', uncategorized: 'other', something_else: 'other',
  },
};
