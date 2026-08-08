export const EGG_AVATAR_ACCESSORY_LAYOUT = {
  version: 2,
  canvas: { width: 2048, height: 2048 },
  hat: {
    version: 2,
    bounds: { left: 0.16, top: 0.01, right: 0.84, bottom: 0.34 },
    anchor: { x: 0.5, y: 0.18 },
  },
  held: {
    version: 1,
    bounds: { left: 0.7, top: 0.38, right: 0.99, bottom: 0.9 },
    anchor: { x: 0.84, y: 0.64 },
  },
} as const;

export const EGG_AVATAR_ACCESSORY_LAYOUT_VERSION = EGG_AVATAR_ACCESSORY_LAYOUT.version;
