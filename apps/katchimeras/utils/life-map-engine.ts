import type {
  DayMapViewport,
  HomeRarityTier,
  HomeVisualKey,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
} from '@/types/home';

// The Life Map — every day you've lived becomes a pin on one map, the creature
// you met standing where you met it. It fills in as depth over time. This pure
// module turns the stored days into pins + a viewport that frames them all; the
// react-native-maps screen just renders the result, so it's harness-verifiable.

export type LifeMapPin = {
  dayId: string;
  isoDate: string;
  dateLabel: string;
  latitude: number;
  longitude: number;
  hatched: boolean;
  creatureVisualKey: HomeVisualKey | null;
  creatureName: string | null;
  accentColor: string;
  rarity: HomeRarityTier | null;
};

export type LifeMapSummary = {
  pins: LifeMapPin[];
  viewport: DayMapViewport | null;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FALLBACK_ACCENT = '#A9B7E0';

export function buildLifeMap(days: StoredHomeDayRecord[]): LifeMapSummary {
  const pins: LifeMapPin[] = [];

  for (const day of days) {
    const coordinate = pickDayCoordinate(day.locations);
    if (!coordinate) {
      continue;
    }
    const creature = day.creature;
    pins.push({
      dayId: day.id,
      isoDate: day.isoDate,
      dateLabel: formatDateLabel(day.isoDate),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      hatched: Boolean(creature),
      creatureVisualKey: creature?.visualKey ?? null,
      creatureName: creature?.name ?? null,
      accentColor: creature?.accentColor ?? FALLBACK_ACCENT,
      rarity: creature?.rarity ?? null,
    });
  }

  pins.sort((left, right) => left.isoDate.localeCompare(right.isoDate));

  return { pins, viewport: buildViewport(pins) };
}

// A day's representative place: the first photographed spot (the one you cared
// to capture), else the centroid of where the day happened.
function pickDayCoordinate(
  locations: StoredHomeLocationPoint[]
): { latitude: number; longitude: number } | null {
  if (locations.length === 0) {
    return null;
  }

  const photoPoint = locations.find((point) => point.hasPhoto);
  if (photoPoint) {
    return { latitude: photoPoint.lat, longitude: photoPoint.lng };
  }

  const total = locations.length;
  const sum = locations.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { latitude: sum.lat / total, longitude: sum.lng / total };
}

function buildViewport(pins: LifeMapPin[]): DayMapViewport | null {
  if (pins.length === 0) {
    return null;
  }

  const latitudes = pins.map((pin) => pin.latitude);
  const longitudes = pins.map((pin) => pin.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.04),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.04),
  };
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}
