import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverProjection, projectStagePoint, groundedSprite } from '@incubator/environments/stage-projection';
import { battleLayout } from '../game/layout';
import { MOSSPROUT_DUEL } from '../data/duel-stages';
import ground from '../data/egg-ground.json';
import { slotPlayRect } from '@incubator/tile-match/timing';
import { firstCellCenter } from '@incubator/tile-match/geometry';
import { createCombat } from '../game/combat';
import { DUELS } from '../data/campaign';
import { dropPreview, shouldCancelDrop } from '../game/drop-target';

const screens = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024]];
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < .001, `${a} != ${b}`);

test('cover projection uses the same centre crop as the plate and anchors', () => {
  const rect = coverProjection({ width: 100, height: 200 }, { x: 20, y: 0, width: 200, height: 300 });
  assert.deepEqual(rect, { x: 20, y: -50, width: 200, height: 400 });
  assert.deepEqual(projectStagePoint(rect, { x: .5, y: .75 }), { x: 120, y: 250 });
});

test('all skins stand on the projected platforms across phone crops and tablet margins', () => {
  for (const [width, height] of screens) for (const skin of Object.keys(ground)) {
    const l = battleLayout(width, height, 24, 20, MOSSPROUT_DUEL, skin, skin);
    const stage = l.stage!;
    close(stage.player.contact.y, l.trayY - 42);
    assert.ok(stage.projection.y <= .001 && stage.projection.y + stage.projection.height >= height - .001);
    assert.ok(l.playerHudY >= l.trayY && l.playerHudY + 8 <= l.trayY + l.trayHeight);
    for (const subject of [stage.player, stage.rival]) {
      close(subject.sprite.x + subject.anchor.x * subject.sprite.width, subject.contact.x);
      close(subject.sprite.y + subject.anchor.y * subject.sprite.height, subject.contact.y);
      close(subject.visible.y + subject.visible.height, subject.contact.y);
      assert.ok(subject.contact.y >= subject.platform.y && subject.contact.y <= subject.platform.y + subject.platform.height);
      assert.ok(subject.visible.y >= 45);
      assert.ok(subject.contact.y < l.playerHudY);
      // Scaling about the calibrated anchor cannot translate its ground contact.
      for (const scale of [1, 1.08, 1.12]) {
        const expanded = groundedSprite(subject.contact, subject.sprite.width * scale, subject.anchor);
        close(expanded.y + subject.anchor.y * expanded.height, subject.contact.y);
      }
    }
    assert.ok(stage.rival.visible.height >= 40, 'distant rival retains the minimum visible height');
    assert.ok(stage.rival.visible.width < stage.rival.platform.width, 'rival fits its platform');
    const play = slotPlayRect(l.metrics);
    assert.ok(l.field.x + play.x >= l.frame.x);
    assert.ok(l.field.x + play.x + play.width <= l.frame.x + l.frame.width);
    assert.ok(l.field.y + play.y - l.driftAmplitude >= stage.rival.contact.y + 55);
    assert.ok(l.field.y + play.y + play.height + l.driftAmplitude < l.playerHudY - 8);
    assert.ok(stage.player.visible.width * 1.12 < l.metrics.pitch * 5);
    assert.ok(l.trayY + l.trayHeight <= height - 20);
    assert.ok(stage.player.contact.y + 4 < l.trayY);
    const first = firstCellCenter(l.metrics);
    close(l.dropFrame.anchorX, l.field.x + first.x);
    close(l.dropFrame.anchorY, l.field.y + first.y);
  }
});

test('stage changes leave legacy scenes available and do not alter matching or tray cancellation', () => {
  assert.equal(battleLayout(390, 844, 0, 0).stage, undefined);
  for (const [width, height] of screens) {
    const l = battleLayout(width, height, 0, 0, MOSSPROUT_DUEL);
    const s = createCombat(DUELS[1], 'stage-drop', 'lower-target');
    for (const piece of s.run.tray) {
      const group = s.run.beat.groups.find(g => g.pieceId === piece.id)!;
      const cellIndex = group.origin.row * s.run.grid.cols + group.origin.column;
      assert.ok(dropPreview(s.run, piece.id, cellIndex).every(c => c.onTarget));
      assert.equal(shouldCancelDrop(s.run, piece.id, { cellIndex, centerX: 0, centerY: 0,
        fingerX: width / 2, fingerY: l.trayY + 20 }, l), false);
    }
  }
});
