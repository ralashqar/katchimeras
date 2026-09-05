import type { ClassifiedMemory } from '@/types/home';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';

export type MossproutLifeActivity = 'photo' | 'notice';
export type NaturePhotoMatch = 'ready' | 'possible' | 'unavailable' | 'no_match';
export const MOSSPROUT_LIFE_TITLES = { photo: 'Show Mossprout something growing', notice: 'Notice one small thing' } as const;
export const NATURE_PHOTO_CHOICES = [
  { id: 'colour', label: 'Its colour', reply: 'A little colour can make a familiar corner worth another look.' },
  { id: 'shape', label: 'Its shape', reply: 'Leaves and branches have such different ways of reaching out.' },
  { id: 'place', label: 'Where it’s growing', reply: 'I like finding a little life in an unexpected place. Thank you for showing me.' },
] as const;
export const MOSSPROUT_NOTICE_PROMPTS = [
  { id: 'light', prompt: 'Find a patch of sunlight. What do you notice there?', choices: [
    { id: 'warmth', label: 'A little warmth', reply: 'A warm patch, just sitting there. I’m glad you found it.' },
    { id: 'shadow', label: 'An interesting shadow', reply: 'Even a familiar leaf can draw a new shape in the light.' },
    { id: 'soft-light', label: 'Soft light through clouds', reply: 'Clouds have their own way of sharing the light.' },
  ] },
  { id: 'sound', prompt: 'Pause and listen for a natural sound. What can you hear?', choices: [
    { id: 'birds', label: 'A bird or another animal', reply: 'A little neighbour carrying on with their day. We got to listen in.' },
    { id: 'wind', label: 'Wind or rustling leaves', reply: 'A sound that changes as you listen. Leaves never quite repeat themselves.' },
    { id: 'water', label: 'Rain or moving water', reply: 'A few drops can give a whole place its own rhythm.' },
  ] },
  { id: 'change', prompt: 'Look for a small sign of change. What caught your attention?', choices: [
    { id: 'growth', label: 'Something growing', reply: 'A new leaf, a longer stem—small changes still count as growing.' },
    { id: 'weather', label: 'Different light or weather', reply: 'The same view can feel quite different when the sky changes.' },
    { id: 'seasons', label: 'A sign of the season', reply: 'A little clue to where we are in the year. Let’s keep that one.' },
  ] },
] as const;
export function mossproutNoticePrompt(dayId: string) {
  const day = Math.floor(Date.parse(`${dayId}T12:00:00Z`) / 86400000);
  return MOSSPROUT_NOTICE_PROMPTS[(Number.isFinite(day) ? day : 0) % MOSSPROUT_NOTICE_PROMPTS.length];
}
export function naturePhotoMatch(memory: ClassifiedMemory, visionAvailable: boolean): NaturePhotoMatch {
  const representation = memory.photoAnalysis?.hierarchy?.representation.kind ?? memory.photoAnalysis?.representation.kind;
  if (['screen_content', 'device_showing_content', 'native_digital_image', 'screenshot'].includes(representation ?? '')) return 'no_match';
  if (!visionAvailable) return 'unavailable';
  const candidates = memory.qualities.filter((quality) => ['nature.plants', 'nature.flowers', 'nature.blossom', 'place.garden', 'place.forest'].includes(quality.qualityId) && quality.status !== 'rejected');
  if (candidates.some((quality) => quality.centrality !== 'incidental' && quality.score >= qualityThresholds(quality.qualityId).ready)) return 'ready';
  if (candidates.some((quality) => quality.score >= qualityThresholds(quality.qualityId).review)) return 'possible';
  return 'no_match';
}
export const mossproutLifeActivityId = (dayId: string, kind: MossproutLifeActivity) => `mossprout:life:${dayId}:${kind}`;
