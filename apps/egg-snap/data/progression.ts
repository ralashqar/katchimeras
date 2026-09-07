import { DEFAULT_LADDER, planBeat, type Progression } from '@incubator/tile-match/engine';

/** Preserve the source ramp, but authored by beat number so mistakes cannot change the deal. */
export function snapLadder(startWithTwo = false): Progression {
  return {kind: 'stream', loop: false, turns: Array.from({length: 64}, (_, index) => {
    const plan = planBeat(DEFAULT_LADDER, index, index, (0x9e3779b9 ^ Math.imul(index + 1, 2654435761)) >>> 0);
    const fuse = plan.varieties.some(v => v.id === 'fuse');
    return {slots: fuse ? 1 : startWithTwo && index === 0 ? 2 : plan.slots,
      varieties: plan.varieties, ...(fuse ? {minShapeHeight: 2} : {})};
  })};
}

export const MECHANIC_LESSONS: Record<string, { title: string; lines: readonly string[] }> = {
  drift: {title:'Forest gust', lines:['The next puzzle brings a breeze. The outlines now sway up and down. Aim where they are, then let go.']},
  armour: {title:'Shell shield', lines:['Place the matching piece to chip the shield. It returns to your tray; place it again to fill the outline. A chip never breaks your streak.']},
  fuse: {title:'Better together', lines:['Two pieces now fit into one larger outline. Match both halves by their shape. Neither piece rotates.']},
  bomb: {title:'A tricky seed', lines:['A red marker means that piece is rigged. Place the OTHER piece first to disarm it, then finish the beat.']},
  crossed: {title:'Cross-up', lines:['The tray order has flipped. Follow each piece’s shape and colour, rather than its side.']},
  hues: {title:'Colour shift', lines:['The outline cycles colours. Watch the small timer and land when it matches your piece. Waiting for the right colour is allowed.']},
};
