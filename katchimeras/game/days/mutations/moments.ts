import type { HomeLocationType, HomeMoment, StoredHomeDayRecord, StoredHomeLocationPoint } from '@/types/home';
import { getDistanceMeters } from '../geo';

const MAX_STORED_DAY_LOCATIONS = 180;
const LOCATION_LINK_WINDOW_MS = 20 * 60 * 1000;

export function withAppendedMoment(day: StoredHomeDayRecord, moment: HomeMoment): StoredHomeDayRecord {
  return {
    ...day,
    moments: [...day.moments, moment],
    locations: appendPhotoMomentLocation(linkMomentToLatestLocation(day.locations, moment), moment),
  };
}

function linkMomentToLatestLocation(points: StoredHomeLocationPoint[], moment: HomeMoment) {
  if (points.length === 0) {
    return points;
  }

  const momentTime = new Date(moment.createdAt).getTime();
  const momentType = deriveLocationTypeFromMoment(moment);
  let linked = false;

  const nextPoints = points.map((point, index, collection) => {
    if (linked) {
      return point;
    }

    const pointTime = new Date(point.capturedAt).getTime();
    const isFresh = momentTime >= pointTime && momentTime - pointTime <= LOCATION_LINK_WINDOW_MS;
    const isLatest = index === collection.length - 1;

    if (!isFresh || !isLatest) {
      return point;
    }

    linked = true;
    return {
      ...point,
      hasPhoto: point.hasPhoto || moment.type === 'photo',
      momentId: moment.type === 'photo' || !point.momentId ? moment.id : point.momentId,
      thumbnailUri: moment.type === 'photo' ? moment.metadata?.thumbnailUri ?? point.thumbnailUri : point.thumbnailUri,
      type: momentType ?? point.type,
    };
  });

  return nextPoints;
}

function appendPhotoMomentLocation(points: StoredHomeLocationPoint[], moment: HomeMoment) {
  if (moment.type !== 'photo' || !moment.metadata?.latitude || !moment.metadata?.longitude) {
    return points;
  }

  const attachedPoint: StoredHomeLocationPoint = {
    id: `photo-location-${moment.id}`,
    lat: Number(moment.metadata.latitude.toFixed(6)),
    lng: Number(moment.metadata.longitude.toFixed(6)),
    capturedAt: moment.createdAt,
    type: moment.metadata.locationType ?? 'unknown',
    hasPhoto: true,
    source: 'photo_attachment',
    momentId: moment.id,
    thumbnailUri: moment.metadata.thumbnailUri,
  };

  const hasNearbyPoint = points.some((point) => {
    const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(moment.createdAt).getTime());
    const distance = getDistanceMeters(point.lat, point.lng, attachedPoint.lat, attachedPoint.lng);
    return timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 180;
  });

  if (hasNearbyPoint) {
    return points.map((point) => {
      const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(moment.createdAt).getTime());
      const distance = getDistanceMeters(point.lat, point.lng, attachedPoint.lat, attachedPoint.lng);

      if (timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 180) {
        return {
          ...point,
          hasPhoto: true,
          momentId: point.momentId ?? moment.id,
          thumbnailUri: moment.metadata?.thumbnailUri ?? point.thumbnailUri,
        };
      }

      return point;
    });
  }

  return [...points, attachedPoint].slice(-MAX_STORED_DAY_LOCATIONS);
}

function deriveLocationTypeFromMoment(moment: HomeMoment): HomeLocationType | null {
  if (moment.type === 'coffee') {
    return 'cafe';
  }

  if (moment.type === 'walk' || moment.type === 'new_place') {
    return 'park';
  }

  if (moment.type === 'calm' || moment.type === 'focus') {
    return 'home';
  }

  return null;
}
