import type { ImageSize, Point, Rect } from '@incubator/environments/stage-projection';

export type DuelStageDefinition = {
  id: 'mossprout-duel-v2';
  sourceSize: ImageSize;
  player: { contact: Point; platform: Rect };
  rival: { contact: Point; platform: Rect };
  playRegion: Rect;
};

/** Measured on the final image plate, not inferred from the generation prompt. */
export const MOSSPROUT_DUEL: DuelStageDefinition = {
  id: 'mossprout-duel-v2', sourceSize: { width: 852, height: 1846 },
  player: { contact: { x: .50, y: .645 }, platform: { x: .135, y: .552, width: .73, height: .184 } },
  rival: { contact: { x: .505, y: .341 }, platform: { x: .295, y: .301, width: .42, height: .079 } },
  playRegion: { x: .035, y: .39, width: .93, height: .24 },
};
