import type { HomeVisualKey } from '@/types/home';
import type { LifeAspectCategory, LifeAspectId } from '@/types/katchimera';

export type LifeAspectDefinition = {
  id: LifeAspectId;
  label: string;
  companionName: string;
  description: string;
  category: LifeAspectCategory;
  anchorVisualKey: HomeVisualKey | null;
  engagementArchetype: string;
  engagementSubtype: string;
  status: 'live' | 'planned';
};

export const lifeAspects: readonly LifeAspectDefinition[] = [
  { id: 'daily-ritual', label: 'Daily ritual', companionName: 'Baristabbit', description: 'Small rituals that give a day rhythm.', category: 'daily-life', anchorVisualKey: 'baristabbit', engagementArchetype: 'food', engagementSubtype: 'coffee_shop', status: 'live' },
  { id: 'food-cooking', label: 'Food & cooking', companionName: 'Feastle', description: 'Meals, cooking, treats, and shared tables.', category: 'daily-life', anchorVisualKey: 'feastle', engagementArchetype: 'food', engagementSubtype: 'food', status: 'live' },
  { id: 'movement-fitness', label: 'Movement & fitness', companionName: 'Flexel', description: 'Exercise, sport, walking, and physical momentum.', category: 'body', anchorVisualKey: 'flexel', engagementArchetype: 'journey', engagementSubtype: 'gym', status: 'live' },
  { id: 'rest-sleep', label: 'Rest & sleep', companionName: 'Bedrotte', description: 'Sleep, recovery, evenings, and body-clock rhythms.', category: 'body', anchorVisualKey: 'bedrotte', engagementArchetype: 'night', engagementSubtype: 'good_sleep', status: 'live' },
  { id: 'emotional-recovery', label: 'Emotional recovery', companionName: 'Mendle', description: 'Tender days, repair, resilience, and self-kindness.', category: 'inner-life', anchorVisualKey: 'mendle', engagementArchetype: 'memory', engagementSubtype: 'tender_day', status: 'live' },
  { id: 'social-connection', label: 'Social connection', companionName: 'Gatherglow', description: 'Friendship, gatherings, belonging, and time together.', category: 'relationships', anchorVisualKey: 'gatherglow', engagementArchetype: 'memory', engagementSubtype: 'social_gathering', status: 'live' },
  { id: 'parenting-caregiving', label: 'Parenting & caregiving', companionName: 'Nestkin', description: 'Caring for children, family, and people who rely on you.', category: 'relationships', anchorVisualKey: 'snuglet', engagementArchetype: 'memory', engagementSubtype: 'baby', status: 'live' },
  { id: 'pet-companionship', label: 'Pet companionship', companionName: 'Waglet', description: 'The routines and affection shared with animal companions.', category: 'relationships', anchorVisualKey: 'waglet', engagementArchetype: 'memory', engagementSubtype: 'dog', status: 'live' },
  { id: 'work-focus', label: 'Work & focus', companionName: 'Tasklet', description: 'Focused effort, goals, craft, and meaningful work.', category: 'purpose', anchorVisualKey: 'tasklet', engagementArchetype: 'craft', engagementSubtype: 'focus_work', status: 'live' },
  { id: 'life-admin', label: 'Life admin & household', companionName: 'Errandimp', description: 'Errands, chores, maintenance, and keeping life moving.', category: 'daily-life', anchorVisualKey: 'errandimp', engagementArchetype: 'craft', engagementSubtype: 'errand_loop', status: 'live' },
  { id: 'learning-culture', label: 'Learning & culture', companionName: 'Pagelet', description: 'Books, museums, ideas, and cultural discovery.', category: 'purpose', anchorVisualKey: 'pagelet', engagementArchetype: 'culture', engagementSubtype: 'bookstore', status: 'live' },
  { id: 'hobbies-creativity', label: 'Hobbies & creativity', companionName: 'Museling', description: 'Making, playing, music, games, and creative expression.', category: 'purpose', anchorVisualKey: 'museling', engagementArchetype: 'craft', engagementSubtype: 'creative', status: 'live' },
  { id: 'nature-outdoors', label: 'Nature & outdoors', companionName: 'Mossprout', description: 'Green spaces, water, wild places, and time outside.', category: 'world', anchorVisualKey: 'mossprout', engagementArchetype: 'places', engagementSubtype: 'park', status: 'live' },
  { id: 'weather-atmosphere', label: 'Weather & atmosphere', companionName: 'Drizzlet', description: 'Seasons, skies, weather, and the feel of the air.', category: 'world', anchorVisualKey: 'drizzlet', engagementArchetype: 'places', engagementSubtype: 'weather', status: 'live' },
  { id: 'travel-exploration', label: 'Travel & exploration', companionName: 'Voyagle', description: 'Journeys, unfamiliar places, landmarks, and discovery.', category: 'world', anchorVisualKey: 'voyagle', engagementArchetype: 'places', engagementSubtype: 'travel', status: 'live' },
  { id: 'commute-routes', label: 'Commute & daily routes', companionName: 'Signalhop', description: 'Regular routes, transit, and the spaces between destinations.', category: 'daily-life', anchorVisualKey: 'neonpoko', engagementArchetype: 'journey', engagementSubtype: 'commute', status: 'live' },
  { id: 'milestones-chapters', label: 'Milestones & chapters', companionName: 'Cheerlet', description: 'Celebrations, achievements, beginnings, and endings.', category: 'inner-life', anchorVisualKey: 'cheerlet', engagementArchetype: 'celebrate', engagementSubtype: 'celebration', status: 'live' },
  { id: 'reflection-solitude', label: 'Reflection & solitude', companionName: 'Quietome', description: 'Stillness, perspective, contemplation, and time alone.', category: 'inner-life', anchorVisualKey: 'quietome', engagementArchetype: 'memory', engagementSubtype: 'reflection', status: 'live' },
  { id: 'contribution-community', label: 'Contribution & community', companionName: 'Kindling', description: 'Helping, volunteering, mentoring, and giving something back.', category: 'relationships', anchorVisualKey: null, engagementArchetype: 'memory', engagementSubtype: 'community', status: 'planned' },
] as const;

export const lifeAspectById = new Map(lifeAspects.map((aspect) => [aspect.id, aspect]));
