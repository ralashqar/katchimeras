import type {
  ClassifiedMemory,
  DayVisionSummary,
  PhotoVisionResult,
} from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';
import { extractTitleFromVisionText } from '@/utils/studio-detect';

export type PhotoJournalFieldSuggestion = {
  value: string;
  confidence: number;
  provenance: 'ocr' | 'appleVision' | 'appleFoundation';
  prefill: boolean;
};

export type PhotoJournalRouteProposal = {
  id: string;
  flowId: string;
  choiceId: string;
  label: string;
  confidence: number;
  reasons: string[];
  confirmedFacets: Array<{ key: string; value: string; sensitive?: boolean }>;
  prefilledSpecific?: string;
};

const ROUTES: Array<{
  values: RegExp;
  flowId: string;
  choiceId: string;
  label: string;
  facet?: [string, string];
}> = [
  { values: /^(book|publication|paperback|hardcover|novel)$/, flowId: 'studio', choiceId: 'book', label: 'Book', facet: ['media_type', 'book'] },
  { values: /^(film|movie|cinema|movie poster)$/, flowId: 'studio', choiceId: 'film', label: 'Film', facet: ['media_type', 'film'] },
  { values: /^(show|television|broadcast)$/, flowId: 'studio', choiceId: 'show', label: 'TV show', facet: ['media_type', 'show'] },
  { values: /^(game|gaming|video game|gameplay)$/, flowId: 'studio', choiceId: 'game', label: 'Video game', facet: ['media_type', 'game'] },
  { values: /^(music|concert|album)$/, flowId: 'studio', choiceId: 'music', label: 'Music', facet: ['media_type', 'music'] },
  { values: /^(art|artwork|painting|sculpture)$/, flowId: 'studio', choiceId: 'art', label: 'Art', facet: ['media_type', 'art'] },
  { values: /^(coffee)$/, flowId: 'food', choiceId: 'coffee', label: 'Coffee', facet: ['food_item', 'coffee'] },
  { values: /^(tea)$/, flowId: 'food', choiceId: 'tea', label: 'Tea', facet: ['food_item', 'tea'] },
  { values: /^(drink|beverage|soft drink)$/, flowId: 'food', choiceId: 'drink', label: 'A drink', facet: ['food_item', 'drink'] },
  { values: /^(dessert|cake|pastry)$/, flowId: 'food', choiceId: 'dessert', label: 'Dessert', facet: ['food_item', 'dessert'] },
  { values: /^(food|meal|dish|pizza|sushi|ramen)$/, flowId: 'food', choiceId: 'meal', label: 'A meal', facet: ['food_item', 'meal'] },
  { values: /^(park)$/, flowId: 'went_somewhere', choiceId: 'park', label: 'Park or green space', facet: ['place_category', 'park'] },
  { values: /^(city|cityscape|skyline)$/, flowId: 'went_somewhere', choiceId: 'city', label: 'City or town', facet: ['place_category', 'city'] },
  { values: /^(beach|coast)$/, flowId: 'went_somewhere', choiceId: 'beach', label: 'Beach or coast', facet: ['place_category', 'beach'] },
  { values: /^(forest|woods|trail)$/, flowId: 'went_somewhere', choiceId: 'forest', label: 'Forest or trail', facet: ['place_category', 'forest'] },
  { values: /^(garden|flowers)$/, flowId: 'went_somewhere', choiceId: 'garden', label: 'Garden', facet: ['place_category', 'garden'] },
  { values: /^(museum|gallery)$/, flowId: 'went_somewhere', choiceId: 'museum', label: 'Museum or gallery', facet: ['place_category', 'museum'] },
  { values: /^(cafe|coffee shop)$/, flowId: 'went_somewhere', choiceId: 'cafe', label: 'Cafe', facet: ['place_category', 'cafe'] },
  { values: /^(restaurant)$/, flowId: 'went_somewhere', choiceId: 'restaurant', label: 'Restaurant', facet: ['place_category', 'restaurant'] },
  { values: /^(home|house|living room)$/, flowId: 'went_somewhere', choiceId: 'home', label: 'Home', facet: ['place_category', 'home'] },
  { values: /^(walk|walking)$/, flowId: 'movement', choiceId: 'walk', label: 'A walk', facet: ['movement_mode', 'walk'] },
  { values: /^(run|running)$/, flowId: 'movement', choiceId: 'run', label: 'A run', facet: ['movement_mode', 'run'] },
  { values: /^(cycle|cycling|bicycle)$/, flowId: 'movement', choiceId: 'cycle', label: 'Cycling', facet: ['movement_mode', 'cycle'] },
  { values: /^(workout|gym|exercise)$/, flowId: 'movement', choiceId: 'workout', label: 'Workout', facet: ['movement_mode', 'workout'] },
  { values: /^(sport|football|basketball|tennis)$/, flowId: 'movement', choiceId: 'sport', label: 'Sport', facet: ['movement_mode', 'sport'] },
  { values: /^(baby)$/, flowId: 'big_event', choiceId: 'baby', label: 'New baby', facet: ['life_event', 'baby'] },
  { values: /^(birthday)$/, flowId: 'big_event', choiceId: 'birthday', label: 'Birthday', facet: ['life_event', 'birthday'] },
  { values: /^(wedding)$/, flowId: 'big_event', choiceId: 'wedding', label: 'Wedding', facet: ['life_event', 'wedding'] },
  { values: /^(person|people|adult|child|group)$/, flowId: 'people', choiceId: 'someone_else', label: 'Someone' },
  { values: /^(dog|cat|pet)$/, flowId: 'people', choiceId: 'pet', label: 'A pet' },
];

const DEVICE_ROUTES: Record<string, Omit<PhotoJournalRouteProposal, 'id' | 'confidence' | 'reasons'>> = {
  working: route('work', 'focus', 'Focused work', ['device_activity', 'working']),
  studying: route('work', 'learning', 'Studying or learning', ['device_activity', 'studying']),
  creating: route('work', 'creative', 'Creative project', ['device_activity', 'creating']),
  gaming: route('studio', 'game', 'Video game', ['media_type', 'game']),
  browsing: route('general', 'ordinary', 'Browsing or scrolling', ['device_activity', 'browsing']),
};

export function photoJournalRouteProposals(memory: ClassifiedMemory): PhotoJournalRouteProposal[] {
  const proposals = new Map<string, PhotoJournalRouteProposal>();
  const confirmed = (key: string) => memory.facets.find((item) => item.key === key && item.confirmed)?.value;
  const activity = confirmed('device_activity');
  if (activity && DEVICE_ROUTES[activity]) add(proposals, { ...DEVICE_ROUTES[activity], id: `${DEVICE_ROUTES[activity].flowId}.${DEVICE_ROUTES[activity].choiceId}`, confidence: 1, reasons: ['User confirmed device activity'] });
  const mediaType = confirmed('media_type');
  if (mediaType) {
    const choiceId = mediaType === 'live_sport' || mediaType === 'online_video' || mediaType === 'news' || mediaType === 'other_screen' ? 'other_media' : mediaType;
    if (['book', 'film', 'show', 'game', 'music', 'art', 'other_media'].includes(choiceId)) {
      add(proposals, { ...route('studio', choiceId, labelFor(choiceId), ['media_type', mediaType]), id: `studio.${choiceId}`, confidence: 1, reasons: ['User confirmed media type'] });
    }
  }
  const screenKind = confirmed('screen_kind');
  if (screenKind) add(proposals, { ...route('general', 'ordinary', labelFor(screenKind), ['screen_kind', screenKind]), id: `general.${screenKind}`, confidence: 1, reasons: ['User confirmed reading type'] });

  for (const observation of memory.observations.filter((item) => item.provider === 'appleVision')) {
    const value = observation.value.toLowerCase();
    const match = ROUTES.find((candidate) => candidate.values.test(value));
    if (!match) continue;
    const confirmedFacets = match.facet ? [{ key: match.facet[0], value: match.facet[1] }] : [];
    add(proposals, {
      id: `${match.flowId}.${match.choiceId}`, flowId: match.flowId, choiceId: match.choiceId,
      label: match.label, confidence: round2(observation.confidence),
      reasons: [`Apple Vision detected ${observation.raw ?? observation.value}`], confirmedFacets,
    });
  }
  return [...proposals.values()].sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id)).slice(0, 3);
}

export function fallbackPhotoJournalRoute(): PhotoJournalRouteProposal {
  return { id: 'general.ordinary', flowId: 'general', choiceId: 'ordinary', label: 'An ordinary moment', confidence: 1, reasons: ['User chose another kind of memory'], confirmedFacets: [] };
}

export function photoJournalRouteForConfirmation(key: string, value: string): PhotoJournalRouteProposal | null {
  if (key === 'primary_subject' && value === 'drink') return proposal('food', 'drink', 'A drink', 'food_item', 'drink');
  if (key === 'primary_subject' && ['person', 'people', 'social', 'group'].includes(value)) return proposal('people', 'someone_else', 'Me / the person', 'relationship', 'someone_else');
  if (key === 'device_activity' && DEVICE_ROUTES[value]) return { ...DEVICE_ROUTES[value], id: `${DEVICE_ROUTES[value].flowId}.${DEVICE_ROUTES[value].choiceId}`, confidence: 1, reasons: ['User confirmed device activity'] };
  const normalized = key === 'media_type' ? ({ live_sport: 'other_media', online_video: 'other_media', news: 'other_media', other_screen: 'other_media' } as Record<string, string>)[value] ?? value : value;
  if (key === 'media_type' && ['book', 'film', 'show', 'game', 'music', 'art', 'other_media'].includes(normalized)) return proposal('studio', normalized, labelFor(normalized), key, value);
  if (key === 'food_kind' || key === 'food_item') {
    const choice = ({ drink: 'drink', coffee: 'coffee', tea: 'tea', dessert: 'dessert', snack: 'snack', cooking: 'cooking' } as Record<string, string>)[value] ?? 'meal';
    return proposal('food', choice, labelFor(choice), key, value);
  }
  if (key === 'place_category') return proposal('went_somewhere', value === 'other' ? 'other_place' : value, labelFor(value), key, value);
  if (key === 'movement_mode' || key === 'activity_kind') return proposal('movement', value === 'sport' ? 'sport' : value, labelFor(value), key, value);
  if (key === 'work_kind') return proposal('work', ({ learning: 'learning', planning: 'planning', admin: 'admin', making: 'creative' } as Record<string, string>)[value] ?? 'focus', labelFor(value), key, value);
  if (key === 'life_event') return proposal('big_event', ({ new_home: 'newHome', new_job: 'newJob', other: 'milestone' } as Record<string, string>)[value] ?? value, labelFor(value), key, value);
  if (key === 'relationship') {
    const choiceId = ({ self: 'solo', partner: 'partner', my_child: 'my_child', family: 'family', friends: 'friends', my_pet: 'pet' } as Record<string, string>)[value] ?? 'someone_else';
    return { ...proposal('people', choiceId, value === 'self' ? 'Me' : labelFor(value), key, value), prefilledSpecific: value === 'self' ? 'Me' : undefined };
  }
  if (key === 'screen_kind') return proposal('general', 'ordinary', labelFor(value), key, value);
  return null;
}

export function photoJournalQuestion(proposals: PhotoJournalRouteProposal[]): string {
  const first = proposals[0];
  const lead = first && first.confidence - (proposals[1]?.confidence ?? 0);
  return first && first.confidence >= 0.72 && lead >= 0.15
    ? `This looks like ${withArticle(first.label)}. What should this remember?`
    : 'What is this photo mainly about?';
}

export function photoJournalSuggestions(input: {
  route: PhotoJournalRouteProposal;
  rawVision?: PhotoVisionResult | null;
  vision?: DayVisionSummary | null;
  scene?: SceneRead | null;
}): PhotoJournalFieldSuggestion[] {
  if (input.route.flowId === 'people') return [];
  const screen = input.vision?.representation?.kind === 'screen_content';
  const screenEligible = input.route.flowId === 'studio' || input.route.flowId === 'work' || input.route.flowId === 'general';
  if (screen && !screenEligible) return [];
  const candidates: PhotoJournalFieldSuggestion[] = [];
  if (input.route.flowId === 'studio') {
    const title = extractTitleFromVisionText(input.vision?.textTokens ?? input.rawVision?.text ?? []);
    if (title && textLooksSpecific(title)) {
      const confidence = titleConfidence(title, input.rawVision, input.vision);
      if (confidence >= 0.5) candidates.push(suggestion(title, confidence, 'ocr'));
    }
    for (const line of input.rawVision?.recognizedText ?? input.vision?.recognizedText ?? []) {
      if (line.confidence >= 0.5 && textLooksSpecific(line.text)) candidates.push(suggestion(line.text, line.confidence, 'ocr'));
    }
  }
  const sceneDetail = input.scene?.detail?.trim();
  if (sceneDetail && textLooksSpecific(sceneDetail) && !/^(digital content|a person|city|place|food|meal)$/i.test(sceneDetail)) {
    const confidence = input.scene?.source === 'llm' ? 0.72 : 0.58;
    candidates.push(suggestion(sceneDetail, confidence, input.scene?.source === 'llm' ? 'appleFoundation' : 'appleVision'));
  }
  if (input.route.flowId === 'food') {
    const food = input.scene?.food?.label?.trim();
    if (food && !/^food|meal|dish$/i.test(food)) candidates.push(suggestion(food, input.scene?.source === 'llm' ? 0.82 : 0.72, input.scene?.source === 'llm' ? 'appleFoundation' : 'appleVision'));
  }
  return dedupe(candidates).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

function route(flowId: string, choiceId: string, label: string, facet: [string, string]) {
  return { flowId, choiceId, label, confirmedFacets: [{ key: facet[0], value: facet[1] }] };
}
function proposal(flowId: string, choiceId: string, label: string, key: string, value: string): PhotoJournalRouteProposal {
  return { id: `${flowId}.${choiceId}`, flowId, choiceId, label, confidence: 1, reasons: ['User confirmed category'], confirmedFacets: [{ key, value }] };
}
function add(target: Map<string, PhotoJournalRouteProposal>, proposal: PhotoJournalRouteProposal) {
  const prior = target.get(proposal.id);
  if (!prior || proposal.confidence > prior.confidence) target.set(proposal.id, proposal);
}
function suggestion(value: string, confidence: number, provenance: PhotoJournalFieldSuggestion['provenance']): PhotoJournalFieldSuggestion {
  return { value: value.trim().slice(0, 80), confidence: round2(confidence), provenance, prefill: confidence >= 0.75 };
}
function titleConfidence(title: string, raw?: PhotoVisionResult | null, vision?: DayVisionSummary | null) {
  const recognized = raw?.recognizedText ?? vision?.recognizedText ?? [];
  const peak = Math.max(0, ...recognized.filter((item) => title.toLowerCase().includes(item.text.toLowerCase()) || item.text.toLowerCase().includes(title.toLowerCase())).map((item) => item.confidence));
  const structured = (vision?.documentCoverage ?? (raw?.documentDetected ? 1 : 0)) >= 0.5 && title.split(/\s+/).length <= 8;
  return Math.max(peak, structured ? 0.78 : 0.55);
}
function textLooksSpecific(value: string) {
  const text = value.trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (text.length < 3 || text.length > 80 || words.length > 10) return false;
  if (/^[^aeiouy]*$/i.test(text.replace(/\W/g, '')) || /(.)\1{3,}/i.test(text)) return false;
  if (/\b(for|to|of|the|a|and)\b.*\b\1\b/i.test(text) && words.length >= 5) return false;
  if (/\b(that|this|what|wanted|because|here|there|with|from)\b/i.test(text) && words.length >= 5) return false;
  return true;
}
function dedupe(items: PhotoJournalFieldSuggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => { const key = item.value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
function labelFor(value: string) {
  return ({ book: 'Book', film: 'Film', show: 'TV show', game: 'Video game', music: 'Music', art: 'Art', other_media: 'Other media', article: 'Article', document: 'Document', other_reading: 'Reading' } as Record<string, string>)[value] ?? value.replace(/_/g, ' ');
}
function withArticle(label: string) { return /^[aeiou]/i.test(label) ? `an ${label.toLowerCase()}` : `a ${label.toLowerCase()}`; }
function round2(value: number) { return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100; }
