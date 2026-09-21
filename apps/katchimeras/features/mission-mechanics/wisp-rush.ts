import type { MissionMechanicDefinition, MissionMechanicState, MissionStrike, MissionWispView, WispPlacement } from '@/types/mission-mechanic';

/**
 * Wisp Rush as a board mechanic: the same wisps, over the same tile, struck by the same Glow flights as every other
 * docked board. What is different is that they keep coming: the state is a roster that only grows. Whoever runs the
 * board (a time trial's heat) says when a wisp appears and on which perch (`syncWispRush`); the wisp layer keeps its
 * own copy and adds each strike's damage as its flight lands, exactly as it does for the other mechanics, so a wisp
 * falls when the player sees it hit, not when the rules decided it. A wisp's number in the roster is its view's, and
 * the number a strike names.
 */
export type WispRushMechanic = Extract<MissionMechanicDefinition, { kind: 'wisp-rush' }>;
export type WispRushState = Extract<MissionMechanicState, { kind: 'wisp-rush' }>;

/** Where wisps hang over a tile: upper half, clear of the bar and the board docked below, like the opening's. */
export const WISP_RUSH_PERCHES: readonly WispPlacement[] = [
  { kind: 'tile', fx: 0.28, fy: 0.3, size: 0.2 },
  { kind: 'tile', fx: 0.72, fy: 0.3, size: 0.2 },
  { kind: 'tile', fx: 0.5, fy: 0.16, size: 0.22 },
  { kind: 'tile', fx: 0.5, fy: 0.46, size: 0.18 },
];
/** The wisps a heat opens with arrive one after another; one that appears later arrives at once. */
const FIRST_STAGGER_MS = 150;

export const createWispRushState = (): WispRushState => ({ kind: 'wisp-rush', strikes: 0, wisps: [] });

/** New wisps from whoever runs the board, added to a copy that keeps its own damage. The same object back when nothing is new. */
export function syncWispRush(state: WispRushState, incoming: WispRushState): WispRushState {
  if (incoming.wisps.length <= state.wisps.length) return state;
  return { ...state, wisps: [...state.wisps, ...incoming.wisps.slice(state.wisps.length).map((wisp) => ({ ...wisp, damage: 0 }))] };
}

export function applyWispRushStrike(input: WispRushState, strike: MissionStrike): WispRushState {
  const wisps = [...input.wisps];
  for (const hit of strike.hits) {
    const wisp = wisps[hit.wisp];
    if (wisp) wisps[hit.wisp] = { ...wisp, damage: Math.min(wisp.hp, wisp.damage + hit.damage) };
  }
  return { ...input, strikes: input.strikes + 1, wisps };
}

/** How many have fallen: the bar of a run with a goal. */
export const wispRushFallen = (state: WispRushState) => state.wisps.filter((wisp) => wisp.damage >= wisp.hp).length;

export function wispRushViews(mechanic: WispRushMechanic, state: WispRushState): MissionWispView[] {
  const opening = state.wisps.filter((wisp) => wisp.bornAt === 0).length;
  return state.wisps.map((wisp, index) => ({
    id: wisp.id, hp: wisp.hp, damage: wisp.damage, alive: wisp.damage < wisp.hp,
    placement: mechanic.perches[wisp.perch] ?? WISP_RUSH_PERCHES[0]!,
    enterDelayMs: index < opening ? index * FIRST_STAGGER_MS : 0,
  }));
}
