import characterGeometry from '../data/character-geometry.gen.json';
import { coverProjection, projectStagePoint, projectStageRect, groundedSprite, type Rect } from '@incubator/environments/stage-projection';
import type { DuelStageDefinition } from '../data/duel-stages';
import ground from '../data/egg-ground.json';
import { SLOT_GRID, SLOT_CAPTURE_MARGIN } from "@incubator/tile-match/engine";
import {
  boardMetricsForCell,
  firstCellCenter,
} from "@incubator/tile-match/geometry";
import { slotPlayRect } from "@incubator/tile-match/timing";

/** Tight seams for the image-backed toy cells; shared engine defaults stay unchanged. */
export const COMBAT_CELL_GAP = 1;

/** A miniature copy of the same grid, with enough centre space for the rival's aura. */
export function opponentFieldLayout(layout: ReturnType<typeof battleLayout>) {
  const visible = layout.stage?.rival.visible ?? {x: layout.width / 2 - layout.opponentSize * .3,
    y: layout.opponentY, width: layout.opponentSize * .6, height: layout.opponentSize};
  const cell = Math.max(10, Math.round(layout.metrics.cell * .5), Math.ceil(visible.width * 1.12 / 5) - COMBAT_CELL_GAP);
  const metrics = boardMetricsForCell(SLOT_GRID, cell, COMBAT_CELL_GAP), play = slotPlayRect(metrics);
  return {metrics, field: {x: layout.width / 2 - metrics.width / 2,
    y: visible.y + visible.height * .55 - play.height / 2 - play.y}, driftAmplitude: layout.driftAmplitude * cell / layout.metrics.cell};
}
function legacyBattleLayout(
  width: number,
  height: number,
  top: number,
  bottom: number,
) {
  const cell = Math.max(24, Math.min(42, Math.floor((width - 32 - 8 * COMBAT_CELL_GAP) / 9)));
  const metrics = boardMetricsForCell(SLOT_GRID, cell, COMBAT_CELL_GAP);
  const play = slotPlayRect(metrics);
  const x = (width - metrics.width) / 2;
  const trayHeight = height < 700 ? 106 : 124;
  const trayY = height - bottom - trayHeight - 12;
  const playerHudHeight = height < 700 ? 36 : 40;
  const playerHudY = trayY - 8 - playerHudHeight;
  const y = playerHudY - 22 - play.height - play.y;
  const first = firstCellCenter(metrics);
  const eggSize = Math.min(width * 0.48, metrics.pitch * 4.8);
  return {
    width,
    height,
    metrics,
    field: { x, y },
    trayY,
    trayHeight,
    playerHudHeight,
    playerHudY,
    eggSize,
    eggY: y + play.y + play.height / 2 - eggSize / 2,
    opponentSize: Math.min(145, height * 0.19, Math.max(72, y + play.y - (top + 62) - 72)),
    opponentY: top + 110,
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
    opponentHudY: top + (height < 700 ? 10 : 28),
    stage: undefined as StagePlacement | undefined };
  if (!definition) return result;
  const frameWidth = Math.min(width, 480, height * .54);
  const frame = { x: (width - frameWidth) / 2, y: 0, width: frameWidth, height };
  const trayHeight = legacy.trayHeight;
  const trayY = legacy.trayY;
  const playerHudY = legacy.playerHudY;
  // Frame the art and its contacts together: the near egg stands directly above the tray.
  const desiredContactY = playerHudY - 14;
  const projectedHeight = Math.max(height, desiredContactY / definition.player.contact.y,
    (height - desiredContactY) / (1 - definition.player.contact.y));
  const projection = coverProjection(definition.sourceSize, { ...frame, height: projectedHeight });
  projection.y += desiredContactY - (projection.y + projection.height * definition.player.contact.y);
  const playerContact = projectStagePoint(projection, definition.player.contact);
  const rivalContact = projectStagePoint(projection, definition.rival.contact);
  const contactFor = (skin: string) => (characterGeometry as Record<string, typeof ground.classic>)[skin] ?? ground[skin as keyof typeof ground] ?? ground.classic;
  const p = contactFor(playerSkin), r = contactFor(rivalSkin);
  const cell = Math.max(24, Math.min(42, Math.floor((frameWidth - 32 - 8 * COMBAT_CELL_GAP) / 9)));
  const metrics = boardMetricsForCell(SLOT_GRID, cell, COMBAT_CELL_GAP), play = slotPlayRect(metrics);
  // Reserve a clean five-cell central corridor even at the 12% growth cap.
  const visibleWidth = Math.min(frameWidth * (height < 700 ? .30 : .40), metrics.pitch * 4.6 / 1.12);
  const playerSize = visibleWidth / p.bounds.width;
  const rivalVisibleHeight = Math.max(40, rivalContact.y - (top + (height < 700 ? 74 : 112)));
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

  const driftAmplitude = Math.max(0, Math.min(18, playTop - (rivalContact.y + 58), playerHudY - 14 - playTop - play.height));
  const stage: StagePlacement = { definition, frame, projection, playRegion: projectStageRect(projection, definition.playRegion),
    player: { contact: playerContact, sprite: playerSprite, platform: projectStageRect(projection, definition.player.platform), anchor: p.anchor, visible: playerVisible },
    rival: { contact: rivalContact, sprite: rivalSprite, platform: projectStageRect(projection, definition.rival.platform), anchor: r.anchor, visible: rivalVisible } };
  return { ...result, frame, stage, metrics, field: { x, y }, trayY, trayHeight, driftAmplitude,
    eggSize: playerSize, eggY: playerSprite.y, opponentSize: rivalSize, opponentY: rivalSprite.y,
    opponentHudY: top + (height < 700 ? 10 : 28),
    playerHudY,
    dropFrame: { ...legacy.dropFrame, anchorX: x + first.x, anchorY: y + first.y, pitch: metrics.pitch } };
}
