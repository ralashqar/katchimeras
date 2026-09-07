import type { ImageSize, Point, Rect } from '@incubator/environments/stage-projection';
import template from './combat-stage-template.json';
import active from './combat-stage-active.json';

export type DuelStageDefinition = {
  id: string;
  sourceSize: ImageSize;
  player: { contact: Point; platform: Rect };
  rival: { contact: Point; platform: Rect };
  playRegion: Rect;
};

/** Measured on the final image plate, not inferred from the generation prompt. */
export const MOSSPROUT_DUEL: DuelStageDefinition = {
  id: active.id, sourceSize: template.sourceSize,
  player: template.player,
  rival: template.rival,
  playRegion: template.playRegion,
};
