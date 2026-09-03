type Frame = { x: number; y: number; width: number; height: number };

export function roundedMultiCutoutSegments(
  frames: readonly Frame[],
  radius: number,
  screen: { height: number; width: number },
): Frame[] {
  // More samples keep multi-target holes visibly round at large phone-scale
  // radii while retaining the lightweight native band renderer.
  const stepsPerCorner = 12;
  const yStops = new Set<number>([0, screen.height]);
  frames.forEach((frame) => {
    const corner = Math.min(radius, frame.width / 2, frame.height / 2);
    yStops.add(clamp(frame.y, 0, screen.height));
    yStops.add(clamp(frame.y + frame.height, 0, screen.height));
    for (let step = 1; step <= stepsPerCorner; step += 1) {
      const offset = corner * step / stepsPerCorner;
      yStops.add(clamp(frame.y + offset, 0, screen.height));
      yStops.add(clamp(frame.y + frame.height - offset, 0, screen.height));
    }
  });

  const sortedStops = [...yStops].sort((a, b) => a - b);
  const segments: Frame[] = [];
  for (let index = 0; index < sortedStops.length - 1; index += 1) {
    const top = sortedStops[index];
    const bottom = sortedStops[index + 1];
    if (bottom - top <= 0.1) continue;
    const midY = top + (bottom - top) / 2;
    const openings = frames
      .flatMap((frame) => {
        const range = roundedFrameRangeAtY(frame, radius, midY);
        return range ? [range] : [];
      })
      .sort((a, b) => a.left - b.left);
    let cursor = 0;
    openings.forEach((opening) => {
      const left = clamp(opening.left, 0, screen.width);
      const right = clamp(opening.right, 0, screen.width);
      if (left > cursor) segments.push({ x: cursor, y: top, width: left - cursor, height: bottom - top });
      cursor = Math.max(cursor, right);
    });
    if (cursor < screen.width) segments.push({ x: cursor, y: top, width: screen.width - cursor, height: bottom - top });
  }
  return segments;
}

function roundedFrameRangeAtY(frame: Frame, radius: number, y: number) {
  if (y < frame.y || y > frame.y + frame.height) return null;
  const corner = Math.min(radius, frame.width / 2, frame.height / 2);
  if (corner <= 0) return { left: frame.x, right: frame.x + frame.width };
  const localY = y - frame.y;
  const distanceFromCornerCenter = localY < corner
    ? corner - localY
    : localY > frame.height - corner
      ? localY - (frame.height - corner)
      : 0;
  const inset = distanceFromCornerCenter > 0
    ? corner - Math.sqrt(Math.max(0, corner * corner - distanceFromCornerCenter * distanceFromCornerCenter))
    : 0;
  return { left: frame.x + inset, right: frame.x + frame.width - inset };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
