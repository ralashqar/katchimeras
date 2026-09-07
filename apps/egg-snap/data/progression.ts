import type { Progression } from '@incubator/tile-match/engine';

/** Authored by beat number: the shared deal stays fair without rolling away the variety. */
export function snapLadder(startWithTwo = false): Progression {
  const rotation = ['drift', 'armour', 'bomb', 'fuse'] as const;
  return {kind: 'stream', loop: true, turns: Array.from({length: 64}, (_, index) => {
    if (index < 4) return {slots: index === 0 && !startWithTwo ? 1 : 2, varieties: []};
    const id = rotation[(index - 4) % rotation.length];
    const fuse = id === 'fuse';
    return {slots: fuse || index === 4 ? 1 : 2,
      varieties: [{id, strength: id === 'drift' ? Math.min(.8, .55 + (index - 4) * .015) : .35}],
      ...(fuse ? {minShapeHeight: 2} : {})};
  })};
}

export const MECHANIC_LESSONS: Record<string, { title: string; lines: readonly string[] }> = {
  drift: {title:'Forest gust', lines:['The next puzzle brings a breeze. The outlines now sway up and down. Aim where they are, then let go.']},
  armour: {title:'Shell shield', lines:['Place the matching piece to chip the shield. It returns to your tray; place it again to fill the outline. A chip never breaks your streak.']},
  fuse: {title:'Better together', lines:['Two pieces now fit into one larger outline. Match both halves by their shape. Neither piece rotates.']},
  bomb: {title:'A tricky seed', lines:['A red marker means that piece is rigged. Place the OTHER piece first to disarm it, then finish the beat. Triggering it cancels your volley and sends the rigged cells back at you for a little damage.']},
  crossed: {title:'Cross-up', lines:['The tray order has flipped. Follow each piece’s shape and colour, rather than its side.']},
  hues: {title:'Colour shift', lines:['The outline cycles colours. Watch the small timer and land when it matches your piece. Waiting for the right colour is allowed.']},
};
