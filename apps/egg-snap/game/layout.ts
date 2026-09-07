import { coverProjection, projectStagePoint, projectStageRect, groundedSprite, type Rect } from '@incubator/environments/stage-projection';
import type { DuelStageDefinition } from '../data/duel-stages';
import ground from '../data/egg-ground.json';
import { SLOT_GRID, SLOT_CAPTURE_MARGIN } from "@incubator/tile-match/engine";
import {
  boardMetricsForCell,
  firstCellCenter,
} from "@incubator/tile-match/geometry";
import { slotPlayRect } from "@incubator/tile-match/timing";

function legacyBattleLayout(
  width: number,
  height: number,
  top: number,
  bottom: number,
) {
  const cell = Math.max(24, Math.min(42, Math.floor((width - 32 - 8 * 3) / 9)));
  const metrics = boardMetricsForCell(SLOT_GRID, cell);
  const play = slotPlayRect(metrics);
  const x = (width - metrics.width) / 2;
  const trayHeight = 118;
  const trayY = height - bottom - trayHeight - 38;
  const y = trayY - 22 - play.height - play.y;
  const first = firstCellCenter(metrics);
  const eggSize = Math.min(width * 0.48, metrics.pitch * 4.8);
  return {
    width,
    height,
    metrics,
    field: { x, y },
    trayY,
    trayHeight,
    eggSize,
    eggY: y + play.y + play.height / 2 - eggSize / 2,
    opponentSize: Math.min(145, height * 0.19, Math.max(72, y + play.y - (top + 62) - 72)),
    opponentY: top + 62,
    driftAmplitude: Math.max(0, Math.min(42, y + play.y - (top + 252))),
    dropFrame: {
      anchorX: x + first.x,
      anchorY: y + first.y,
      pitch: metrics.pitch,
      rows: SLOT_GRID.rows,
      cols: SLOT_GRID.cols,
      captureMargin: SLOT_CAPTURE_MARGIN,
    },
  };
}


export type StagePlacement = {
  definition: DuelStageDefinition; frame: Rect; projection: Rect; playRegion: Rect;
  player: { contact: { x: number; y: number }; sprite: Rect; platform: Rect; anchor: { x: number; y: number }; visible: Rect };
  rival: { contact: { x: number; y: number }; sprite: Rect; platform: Rect; anchor: { x: number; y: number }; visible: Rect };
};

export function battleLayout(width: number, height: number, top: number, bottom: number,
  definition?: DuelStageDefinition, playerSkin = 'classic', rivalSkin = 'moss') {
  const legacy = legacyBattleLayout(width, height, top, bottom);
  const result = { ...legacy, frame: { x: 0, y: 0, width, height },
    opponentHudY: legacy.opponentY - 12, warningY: legacy.opponentY + legacy.opponentSize + 37,
    playerHudY: height - bottom - 33, stage: undefined as StagePlacement | undefined };
  if (!definition) return result;
  const frameWidth = Math.min(width, 480, height * .54);
  const frame = { x: (width - frameWidth) / 2, y: 0, width: frameWidth, height };
  const projection = coverProjection(definition.sourceSize, frame);
  const playerContact = projectStagePoint(projection, definition.player.contact);
  const rivalContact = projectStagePoint(projection, definition.rival.contact);
  const contactFor = (skin: string) => ground[skin as keyof typeof ground] ?? ground.classic;
  const p = contactFor(playerSkin), r = contactFor(rivalSkin);
  const cell = Math.max(24, Math.min(42, Math.floor((frameWidth - 32 - 8 * 3) / 9)));
  const metrics = boardMetricsForCell(SLOT_GRID, cell), play = slotPlayRect(metrics);
  // Reserve a clean five-cell central corridor even at the 12% growth cap.
  const visibleWidth = Math.min(frameWidth * (height < 700 ? .30 : .40), metrics.pitch * 4.6 / 1.12);
  const playerSize = visibleWidth / p.bounds.width;
  const rivalVisibleHeight = Math.max(40, rivalContact.y - (top + (height < 700 ? 65 : 112)));
  const rivalSize = Math.min(frameWidth * .29 / r.bounds.width, rivalVisibleHeight / r.bounds.height);
  const playerSprite = groundedSprite(playerContact, playerSize, p.anchor);
  const rivalSprite = groundedSprite(rivalContact, rivalSize, r.anchor);
  const visible = (sprite: Rect, bounds: Rect): Rect => ({ x: sprite.x + bounds.x * sprite.width,
    y: sprite.y + bounds.y * sprite.height, width: bounds.width * sprite.width, height: bounds.height * sprite.height });
  const playerVisible = visible(playerSprite, p.bounds), rivalVisible = visible(rivalSprite, r.bounds);
  const x = frame.x + (frameWidth - metrics.width) / 2;
  const playTop = Math.max(rivalContact.y + 66, playerContact.y - playerVisible.height / 2 - play.height / 2);
  const y = playTop - play.y;
  const first = firstCellCenter(metrics);
  const trayHeight = height < 700 ? 106 : legacy.trayHeight;
  const trayY = height - bottom - trayHeight - (height < 700 ? 38 : 18);
  const driftAmplitude = Math.max(0, Math.min(18, playTop - (rivalContact.y + 58), trayY - 66 - playTop - play.height));
  const stage: StagePlacement = { definition, frame, projection, playRegion: projectStageRect(projection, definition.playRegion),
    player: { contact: playerContact, sprite: playerSprite, platform: projectStageRect(projection, definition.player.platform), anchor: p.anchor, visible: playerVisible },
    rival: { contact: rivalContact, sprite: rivalSprite, platform: projectStageRect(projection, definition.rival.platform), anchor: r.anchor, visible: rivalVisible } };
  return { ...result, frame, stage, metrics, field: { x, y }, trayY, trayHeight, driftAmplitude,
    eggSize: playerSize, eggY: playerSprite.y, opponentSize: rivalSize, opponentY: rivalSprite.y,
    opponentHudY: height < 700 ? Math.max(top + 54, rivalVisible.y) : Math.max(top + 54, rivalVisible.y - 57), warningY: rivalContact.y + 14,
    playerHudY: height < 700 ? height - bottom - 36 : trayY - 45,
    dropFrame: { ...legacy.dropFrame, anchorX: x + first.x, anchorY: y + first.y, pitch: metrics.pitch } };
}
