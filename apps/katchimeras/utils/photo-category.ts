import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayVisionSummary } from '@/types/home';

// What a snapped photo "was about", reduced to a small set of display
// categories with an icon + accent — used for the icon that orbits the egg
// after a capture. Driven by the same on-device vision concepts the hatch uses.
export type PhotoCategory = {
  id: string;
  label: string;
  icon: IconSymbolName;
  accent: string;
};

const CATEGORY_BY_ID: Record<string, PhotoCategory> = {
  drink: { id: 'drink', label: 'Drink', icon: 'cup.and.saucer.fill', accent: '#F3B788' },
  food: { id: 'food', label: 'Food', icon: 'fork.knife', accent: '#FFB4A2' },
  nature: { id: 'nature', label: 'Nature', icon: 'leaf.fill', accent: '#9DDCB8' },
  culture: { id: 'culture', label: 'Culture', icon: 'building.columns.fill', accent: '#D5B8FF' },
  water: { id: 'water', label: 'Water', icon: 'water.waves', accent: '#92D7FF' },
  mountains: { id: 'mountains', label: 'Heights', icon: 'building.columns.fill', accent: '#AEB6FF' },
  pet: { id: 'pet', label: 'Companion', icon: 'pawprint.fill', accent: '#F4BE8D' },
  people: { id: 'people', label: 'People', icon: 'person.2.fill', accent: '#F2C2A8' },
  landmark: { id: 'landmark', label: 'Landmark', icon: 'building.2.fill', accent: '#FFC36B' },
  active: { id: 'active', label: 'Movement', icon: 'figure.run', accent: '#93C7FF' },
  light: { id: 'light', label: 'Golden hour', icon: 'sun.max.fill', accent: '#FFC36B' },
  celebration: { id: 'celebration', label: 'Celebration', icon: 'party.popper.fill', accent: '#FFD66B' },
  creative: { id: 'creative', label: 'Making', icon: 'paintbrush.fill', accent: '#D5B8FF' },
  night: { id: 'night', label: 'Night', icon: 'moon.stars.fill', accent: '#B4BCFF' },
  moment: { id: 'moment', label: 'A moment', icon: 'sparkles', accent: '#F1D4B4' },
};

// Vision concept (utils/vision-signals.ts) → display category. First match on the
// day's most salient concept wins.
const CONCEPT_TO_CATEGORY: Record<string, string> = {
  coffee: 'drink',
  bubble_tea: 'drink',
  food: 'food',
  pizza: 'food',
  sushi: 'food',
  ramen: 'food',
  dessert: 'food',
  bakery: 'food',
  farm: 'food',
  park: 'nature',
  forest: 'nature',
  garden: 'nature',
  flowers: 'nature',
  blossom: 'nature',
  autumn: 'nature',
  museum: 'culture',
  cinema: 'culture',
  library: 'culture',
  bookstore: 'culture',
  beach: 'water',
  water: 'water',
  mountains: 'mountains',
  dog: 'pet',
  cat: 'pet',
  baby: 'people',
  city: 'landmark',
  travel: 'landmark',
  gym: 'active',
  basketball: 'active',
  tennis: 'active',
  sunset: 'light',
  snow: 'night',
  rain: 'night',
  stars: 'night',
  celebration: 'celebration',
  creative: 'creative',
};

// The single best category for a freshly analysed photo. People-in-frame wins
// when nothing more specific is present; otherwise the most salient concept maps
// through. Falls back to a generic "moment".
export function resolvePhotoCategory(vision: DayVisionSummary): PhotoCategory {
  for (const concept of vision.concepts) {
    const categoryId = CONCEPT_TO_CATEGORY[concept.name];
    if (categoryId && CATEGORY_BY_ID[categoryId]) {
      return CATEGORY_BY_ID[categoryId];
    }
  }
  if (vision.maxFaceCount >= 1) {
    return CATEGORY_BY_ID.people;
  }
  return CATEGORY_BY_ID.moment;
}
