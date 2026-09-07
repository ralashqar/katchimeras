export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type ImageSize = { width: number; height: number };

/** The exact centred cover rectangle, shared by artwork and its authored anchors. */
export function coverProjection(source: ImageSize, viewport: Rect): Rect {
  const scale = Math.max(viewport.width / source.width, viewport.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  return { x: viewport.x + (viewport.width - width) / 2,
    y: viewport.y + (viewport.height - height) / 2, width, height };
}
export function projectStagePoint(image: Rect, point: Point): Point {
  return { x: image.x + point.x * image.width, y: image.y + point.y * image.height };
}
export function projectStageRect(image: Rect, rect: Rect): Rect {
  return { ...projectStagePoint(image, rect), width: image.width * rect.width, height: image.height * rect.height };
}

/** Place calibrated visible artwork, including its transparent padding, at a ground contact. */
export function groundedSprite(contact: Point, size: number, anchor: Point): Rect {
  return { x: contact.x - anchor.x * size, y: contact.y - anchor.y * size, width: size, height: size };
}
