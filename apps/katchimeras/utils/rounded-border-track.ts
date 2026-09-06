/** Clockwise distance around a rounded rectangle, starting at its top-left tangent. */
export function roundedBorderPoint(width: number, height: number, radius: number, progress: number) {
  'worklet';
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const horizontal = Math.max(0, width - 2 * r);
  const vertical = Math.max(0, height - 2 * r);
  const corner = Math.PI * r / 2;
  const perimeter = 2 * horizontal + 2 * vertical + 4 * corner;
  let distance = ((progress % 1 + 1) % 1) * perimeter;
  if (distance < horizontal) return { x: r + distance, y: 0 };
  distance -= horizontal;
  if (distance < corner) {
    const angle = distance / r - Math.PI / 2;
    return { x: width - r + r * Math.cos(angle), y: r + r * Math.sin(angle) };
  }
  distance -= corner;
  if (distance < vertical) return { x: width, y: r + distance };
  distance -= vertical;
  if (distance < corner) {
    const angle = distance / r;
    return { x: width - r + r * Math.cos(angle), y: height - r + r * Math.sin(angle) };
  }
  distance -= corner;
  if (distance < horizontal) return { x: width - r - distance, y: height };
  distance -= horizontal;
  if (distance < corner) {
    const angle = distance / r + Math.PI / 2;
    return { x: r + r * Math.cos(angle), y: height - r + r * Math.sin(angle) };
  }
  distance -= corner;
  if (distance < vertical) return { x: 0, y: height - r - distance };
  distance -= vertical;
  const angle = r > 0 ? distance / r + Math.PI : Math.PI;
  return { x: r + r * Math.cos(angle), y: r + r * Math.sin(angle) };
}

/** Remap each gradient stop to arc length, so the bright head AND its falloff
 * move uniformly. A fixed angular sweep accelerates along a wide button. */
export function roundedBorderGradient(width: number, height: number, radius: number, progress: number, stops: readonly number[]) {
  'worklet';
  const origin = roundedBorderPoint(width, height, radius, progress);
  const rotation = Math.atan2(origin.y - height / 2, origin.x - width / 2);
  const turn = 2 * Math.PI;
  const positions = stops.map((stop) => {
    if (stop <= 0 || stop >= 1 || width <= 0 || height <= 0) return stop;
    const point = roundedBorderPoint(width, height, radius, progress + stop);
    const angle = Math.atan2(point.y - height / 2, point.x - width / 2);
    return ((angle - rotation + turn) % turn) / turn;
  });
  return { rotation, positions };
}
