export type WorldTileActionPlacement = {
  anchor?: { x: number; y: number };
  placement?: 'anchor' | 'below';
  gap?: number;
};

export function worldTileActionFrame(
  target: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number },
  options: WorldTileActionPlacement,
) {
  const anchor = options.anchor ?? { x: 0.5, y: 0.76 };
  return {
    left: target.left + target.width * anchor.x - size.width / 2,
    top: options.placement === 'below'
      ? target.top + target.height + Math.max(0, options.gap ?? 12)
      : target.top + target.height * anchor.y - size.height / 2,
    ...size,
  };
}
