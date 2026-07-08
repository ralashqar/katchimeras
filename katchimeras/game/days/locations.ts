import type { HomeLocationType, HomeMoment, StoredHomeDayRecord, StoredHomeLocationPoint } from '@/types/home';
import { stableHash } from './hash';

const seedLocationPresets: Record<HomeMoment['type'], readonly { lat: number; lng: number; type: HomeLocationType }[]> = {
  photo: [
    { lat: 51.5084, lng: -0.1276, type: 'unknown' },
    { lat: 51.5106, lng: -0.1202, type: 'park' },
  ],
  inspiration: [
    { lat: 51.5145, lng: -0.1421, type: 'home' },
  ],
  coffee: [
    { lat: 51.5124, lng: -0.1363, type: 'home' },
    { lat: 51.5152, lng: -0.1416, type: 'cafe' },
  ],
  walk: [
    { lat: 51.5062, lng: -0.1165, type: 'park' },
    { lat: 51.5024, lng: -0.1199, type: 'park' },
    { lat: 51.4996, lng: -0.1248, type: 'park' },
  ],
  new_place: [
    { lat: 51.5111, lng: -0.1288, type: 'unknown' },
    { lat: 51.5194, lng: -0.1269, type: 'park' },
  ],
  social: [
    { lat: 51.5139, lng: -0.1352, type: 'cafe' },
    { lat: 51.5172, lng: -0.1317, type: 'unknown' },
  ],
  calm: [
    { lat: 51.5149, lng: -0.1428, type: 'home' },
  ],
  focus: [
    { lat: 51.5157, lng: -0.1412, type: 'home' },
  ],
};

export function createSeedLocations(
  momentType: HomeMoment['type'],
  date: Date,
  seedIndex: number,
  momentId: string
): StoredHomeLocationPoint[] {
  const presets = seedLocationPresets[momentType] ?? seedLocationPresets.focus;
  const baseDate = new Date(date);
  baseDate.setHours(9, 0, 0, 0);

  return presets.map((preset, index) => {
    const capturedAt = new Date(baseDate);
    capturedAt.setHours(baseDate.getHours() + index * 3);

    return {
      id: `seed-location-${seedIndex}-${index}`,
      lat: preset.lat,
      lng: preset.lng,
      capturedAt: capturedAt.toISOString(),
      type: preset.type,
      hasPhoto: momentType === 'photo',
      source: 'foreground',
      momentId: index === presets.length - 1 ? momentId : null,
      accuracyMeters: 80,
    };
  });
}

export function createFallbackLocationsForStoredDay(
  day: Pick<StoredHomeDayRecord, 'id' | 'isoDate' | 'moments' | 'creature'>
) {
  if (day.moments.length === 0) {
    return [];
  }

  const firstMoment = day.moments[0];
  const dayDate = new Date(`${day.isoDate}T12:00:00`);
  const seedIndex = stableHash(`${day.id}|${day.isoDate}`) % 1000;
  return createSeedLocations(firstMoment.type, dayDate, seedIndex, firstMoment.id);
}
