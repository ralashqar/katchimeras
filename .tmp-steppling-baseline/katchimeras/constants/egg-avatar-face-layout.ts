/**
 * Canonical normalized coordinates for future composited egg faces.
 *
 * Skin artwork and face layers share the same 2048 x 2048 production canvas.
 * Themes must leave the safe zone visually quiet so any compatible face set can
 * be placed at these anchors without seams, patterns, or accessories behind it.
 */
export const EGG_AVATAR_FACE_LAYOUT = {
  version: 1,
  canvas: { width: 2048, height: 2048 },
  safeZone: {
    shape: 'roundedRectangle',
    left: 0.22,
    top: 0.34,
    right: 0.78,
    bottom: 0.66,
  },
  anchors: {
    leftBrow: { x: 0.39, y: 0.405 },
    rightBrow: { x: 0.61, y: 0.405 },
    leftEye: { x: 0.385, y: 0.505 },
    rightEye: { x: 0.615, y: 0.505 },
    leftBlush: { x: 0.31, y: 0.565 },
    rightBlush: { x: 0.69, y: 0.565 },
    mouth: { x: 0.5, y: 0.57 },
  },
} as const;

export const EGG_AVATAR_FACE_LAYOUT_VERSION = EGG_AVATAR_FACE_LAYOUT.version;
