import type {
  DayMapCoordinate,
  DayMapNode,
  DayMapSummary,
  HomeLocationType,
  HomeMoment,
  StoredHomeLocationPoint,
} from '@/types/home';

const CLUSTER_RADIUS_METERS = 150;
const MAX_DAY_MAP_NODES = 5;

type LocationCluster = {
  id: string;
  latitude: number;
  longitude: number;
  points: StoredHomeLocationPoint[];
};

export function deriveDayMapSummary(
  points: StoredHomeLocationPoint[],
  moments: HomeMoment[]
): DayMapSummary | null {
  if (points.length === 0) {
    return null;
  }

  const sortedPoints = [...points].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  );
  const clusters = clusterPoints(sortedPoints);
  const rankedNodes = clusters
    .map((cluster) => createNode(cluster))
    .sort((left, right) => {
      if (right.importance !== left.importance) {
        return right.importance - left.importance;
      }

      return new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime();
    })
    .slice(0, MAX_DAY_MAP_NODES);
  const nodes = [...rankedNodes].sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
  );

  if (nodes.length === 0) {
    return null;
  }

  return {
    nodes,
    path: nodes.length > 1 ? buildSmoothedPath(nodes) : [],
    primaryLocationId: pickPrimaryLocationId(nodes, moments),
    viewport: buildViewport(nodes),
    totalSamples: points.length,
  };
}

function clusterPoints(points: StoredHomeLocationPoint[]) {
  const clusters: LocationCluster[] = [];

  points.forEach((point) => {
    let nearestClusterIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    clusters.forEach((cluster, index) => {
      const distance = getDistanceMeters(point.lat, point.lng, cluster.latitude, cluster.longitude);
      if (distance <= CLUSTER_RADIUS_METERS && distance < nearestDistance) {
        nearestClusterIndex = index;
        nearestDistance = distance;
      }
    });

    if (nearestClusterIndex < 0) {
      clusters.push({
        id: `cluster-${point.id}`,
        latitude: point.lat,
        longitude: point.lng,
        points: [point],
      });
      return;
    }

    const nearestCluster = clusters[nearestClusterIndex];
    nearestCluster.points.push(point);
    const total = nearestCluster.points.length;
    nearestCluster.latitude = average(nearestCluster.points.map((entry) => entry.lat), total);
    nearestCluster.longitude = average(nearestCluster.points.map((entry) => entry.lng), total);
  });

  return clusters;
}

function createNode(cluster: LocationCluster): DayMapNode {
  const sortedPoints = [...cluster.points].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  );
  const startedAt = sortedPoints[0]?.capturedAt ?? new Date().toISOString();
  const endedAt = sortedPoints[sortedPoints.length - 1]?.capturedAt ?? startedAt;
  const hasPhoto = sortedPoints.some((point) => point.hasPhoto);
  const latestPhotoPoint = [...sortedPoints].reverse().find((point) => point.hasPhoto && point.thumbnailUri) ?? null;
  const linkedPoint =
    latestPhotoPoint ??
    [...sortedPoints].reverse().find((point) => point.hasPhoto && point.momentId) ??
    [...sortedPoints].reverse().find((point) => point.momentId) ??
    null;
  const durationMinutes = getDurationMinutes(startedAt, endedAt);
  const importance = clamp(
    0.32 +
      Math.min(durationMinutes / 90, 0.4) +
      Math.min(sortedPoints.length / 10, 0.18) +
      (hasPhoto ? 0.22 : 0) +
      (linkedPoint?.momentId ? 0.08 : 0)
  );

  return {
    id: cluster.id,
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    type: resolveClusterType(sortedPoints),
    importance,
    hasPhoto,
    linkedMomentId: linkedPoint?.momentId ?? null,
    photoThumbnailUri: latestPhotoPoint?.thumbnailUri ?? null,
    startedAt,
    endedAt,
    sampleCount: sortedPoints.length,
  };
}

function pickPrimaryLocationId(nodes: DayMapNode[], moments: HomeMoment[]) {
  const momentIndex = new Map(moments.map((moment) => [moment.id, moment]));
  const ranked = [...nodes].sort((left, right) => {
    const leftMoment = left.linkedMomentId ? momentIndex.get(left.linkedMomentId) : null;
    const rightMoment = right.linkedMomentId ? momentIndex.get(right.linkedMomentId) : null;
    const leftPhotoScore = left.hasPhoto || leftMoment?.type === 'photo' ? 1 : 0;
    const rightPhotoScore = right.hasPhoto || rightMoment?.type === 'photo' ? 1 : 0;

    if (rightPhotoScore !== leftPhotoScore) {
      return rightPhotoScore - leftPhotoScore;
    }

    const leftDuration = getDurationMinutes(left.startedAt, left.endedAt);
    const rightDuration = getDurationMinutes(right.startedAt, right.endedAt);
    if (rightDuration !== leftDuration) {
      return rightDuration - leftDuration;
    }

    return new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime();
  });

  return ranked[0]?.id ?? null;
}

function resolveClusterType(points: StoredHomeLocationPoint[]): HomeLocationType {
  const counts = points.reduce<Record<HomeLocationType, number>>(
    (result, point) => {
      result[point.type] += 1;
      return result;
    },
    {
      home: 0,
      cafe: 0,
      park: 0,
      unknown: 0,
    }
  );

  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] as HomeLocationType) ?? 'unknown';
}

function buildSmoothedPath(nodes: DayMapNode[]): DayMapCoordinate[] {
  if (nodes.length <= 1) {
    return [];
  }

  const coordinates = nodes.map((node) => ({
    latitude: node.latitude,
    longitude: node.longitude,
  }));
  const smoothed: DayMapCoordinate[] = [coordinates[0]];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const current = coordinates[index];
    const next = coordinates[index + 1];
    const control = {
      latitude: (current.latitude + next.latitude) / 2 + (next.longitude - current.longitude) * 0.08,
      longitude: (current.longitude + next.longitude) / 2 - (next.latitude - current.latitude) * 0.08,
    };

    for (let step = 1; step <= 6; step += 1) {
      const t = step / 6;
      smoothed.push(quadraticPoint(current, control, next, t));
    }
  }

  return smoothed;
}

function buildViewport(nodes: DayMapNode[]) {
  if (nodes.length === 0) {
    return null;
  }

  const latitudes = nodes.map((node) => node.latitude);
  const longitudes = nodes.map((node) => node.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.9, 0.015),
    longitudeDelta: Math.max((maxLng - minLng) * 1.9, 0.015),
  };
}

function quadraticPoint(start: DayMapCoordinate, control: DayMapCoordinate, end: DayMapCoordinate, t: number): DayMapCoordinate {
  const inverse = 1 - t;
  return {
    latitude: inverse * inverse * start.latitude + 2 * inverse * t * control.latitude + t * t * end.latitude,
    longitude: inverse * inverse * start.longitude + 2 * inverse * t * control.longitude + t * t * end.longitude,
  };
}

function average(values: number[], count: number) {
  if (count <= 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / count;
}

function getDurationMinutes(startedAt: string, endedAt: string) {
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  return Math.max((ended - started) / 60000, 10);
}

function clamp(value: number) {
  return Math.max(0.24, Math.min(1, Number(value.toFixed(3))));
}

function getDistanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number) {
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(rightLat - leftLat);
  const lngDelta = toRadians(rightLng - leftLng);
  const leftLatRadians = toRadians(leftLat);
  const rightLatRadians = toRadians(rightLat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLatRadians) * Math.cos(rightLatRadians) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
