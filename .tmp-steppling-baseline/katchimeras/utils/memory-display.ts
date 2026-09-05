import type {
  BigMoment,
  CuisineFamily,
  FoodMoment,
  StepsInterpretation,
  StudioMediaType,
  StudioMoment,
} from '@/types/home';
import { resolveStudioTitle } from '@/utils/studio-detect';

export type RichMemoryDisplay = {
  label: string;
  emoji: string;
  detail: string | null;
};

export const CUISINE_DISPLAY: Record<CuisineFamily, { label: string; emoji: string }> = {
  italian: { label: 'Italian', emoji: '🍝' },
  japanese: { label: 'Japanese', emoji: '🍣' },
  chinese: { label: 'Chinese', emoji: '🥟' },
  indian: { label: 'Indian', emoji: '🍛' },
  mexican: { label: 'Mexican', emoji: '🌮' },
  middle_eastern: { label: 'Middle Eastern', emoji: '🧆' },
  french: { label: 'French', emoji: '🥐' },
  greek: { label: 'Greek', emoji: '🥙' },
};

const GENERIC_FOOD_LABEL = /^(?:a |the )?(?:food|meal|dish|something|lunch|dinner|supper)$/i;

export function resolveFoodMomentDisplay(
  moment: Pick<FoodMoment, 'label' | 'emoji' | 'cuisine' | 'homeCooked' | 'detail'>
): RichMemoryDisplay {
  const original = moment.label.trim() || 'Food memory';
  const cuisine = moment.cuisine ? CUISINE_DISPLAY[moment.cuisine] : null;
  const generic = GENERIC_FOOD_LABEL.test(original);
  const label = generic && cuisine
    ? cuisine.label
    : generic && moment.homeCooked
      ? 'Home-made meal'
      : original;
  const emoji = generic && cuisine
    ? cuisine.emoji
    : generic && moment.homeCooked
      ? '🍲'
      : moment.emoji || '🍽️';
  const detail = uniqueText([
    cuisine && label !== cuisine.label ? cuisine.label : null,
    moment.homeCooked && label !== 'Home-made meal' ? 'Home-made' : null,
    moment.detail,
  ]);
  return { label, emoji, detail };
}

const STUDIO_KIND: Record<StudioMediaType, string> = {
  book: 'Book',
  film: 'Film',
  show: 'Show',
  game: 'Game',
  music: 'Music',
  art: 'Art',
  other: 'Inspiration',
};

export function resolveStudioMomentDisplay(
  moment: Pick<StudioMoment, 'label' | 'emoji' | 'mediaType' | 'detail'>
): RichMemoryDisplay {
  const label = resolveStudioTitle(moment.label, moment.detail);
  const kind = STUDIO_KIND[moment.mediaType] ?? 'Inspiration';
  return {
    label,
    emoji: moment.emoji || '✨',
    detail: uniqueText([label.toLowerCase() !== moment.label.toLowerCase() ? kind : null, moment.detail]),
  };
}

const MOVEMENT_SUBTYPE: Record<string, string> = {
  train: 'Train / Tube',
  bus: 'Bus',
  taxi: 'Taxi / car',
  flight_ferry: 'Flight / ferry',
  mostly_transit: 'Mostly transit',
  mostly_walking: 'Mostly walking',
  mostly_driving: 'Mostly driving',
  mixed: 'Mixed journey',
  leisure: 'Leisurely walk',
  dog_walk: 'Dog walk',
  walking_commute: 'Walking commute',
  exploring: 'Exploring on foot',
};

export function resolveMovementDisplay(
  movement: Pick<StepsInterpretation, 'label' | 'emoji' | 'subtype'>
): RichMemoryDisplay {
  const subtype = movement.subtype ? MOVEMENT_SUBTYPE[movement.subtype] : null;
  return {
    label: subtype ?? movement.label,
    emoji: movement.emoji,
    detail: subtype && subtype !== movement.label ? movement.label : null,
  };
}

export function resolveBigMomentDisplay(
  moment: Pick<BigMoment, 'label' | 'subject'>
): Pick<RichMemoryDisplay, 'label' | 'detail'> {
  return {
    label: moment.subject ? `${moment.label} · ${moment.subject}` : moment.label,
    detail: null,
  };
}

function uniqueText(values: (string | null | undefined)[]): string | null {
  const parts = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(parts)].join(' · ') || null;
}
