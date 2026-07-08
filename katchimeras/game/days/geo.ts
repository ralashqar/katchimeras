export function getDistanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number) {
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
