import { DEFAULT_LADDER, type Progression } from '@incubator/tile-match/engine';

/** Formula Snap's earned ladder: 0 solo, 1 duo, 4 solo modifier, 6 duo modifier. */
export function snapLadder(startWithTwo = false): Progression {
  if (DEFAULT_LADDER.kind !== 'ladder') throw new Error('Expected the source streak ladder');
  return {
    ...DEFAULT_LADDER,
    tiers: DEFAULT_LADDER.tiers.map(t => ({
      ...t,
      slots: startWithTwo && t.atCombo === 0 ? 2 : t.slots,
      // Every jigsaw must actually split, including its first appearance.
      ...(t.pool?.includes('fuse') ? { minShapeHeight: 2 } : {}),
    })),
  };
}

export const MECHANIC_LESSONS: Record<string, { title: string; lines: readonly string[] }> = {
  drift: {title:'Forest gust', lines:['Your streak woke the breeze. The outlines now sway up and down. Aim where they are, then let go.']},
  armour: {title:'Shell shield', lines:['Place the matching piece to chip the shield. It returns to your tray; place it again to fill the outline. A chip never breaks your streak.']},
  fuse: {title:'Better together', lines:['Two pieces now fit into one larger outline. Match both halves by their shape. Neither piece rotates.']},
  bomb: {title:'A tricky seed', lines:['A red marker means that piece is rigged. Place the OTHER piece first to disarm it, then finish the beat.']},
  crossed: {title:'Cross-up', lines:['The tray order has flipped. Follow each piece’s shape and colour, rather than its side.']},
  hues: {title:'Colour shift', lines:['The outline cycles colours. Watch the small timer and land when it matches your piece. Waiting for the right colour is allowed.']},
};
