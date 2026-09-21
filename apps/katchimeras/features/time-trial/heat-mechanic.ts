import type { MissionMechanicHost } from '@/features/mission-mechanics/mechanic';
import { WISP_RUSH_PERCHES, createWispRushState, type WispRushState } from '@/features/mission-mechanics/wisp-rush';
import type { MissionMechanicLive, MissionStrike } from '@/types/mission-mechanic';
import type { HeatSpec, HeatState, HeatStrike } from './heat';

/**
 * A heat as the Kingdom's docked board sees it: a host like any friend's board (a bar, wisps over the tile, a
 * mechanic), so the wisp layer, the Glow flights and the dock need nothing of their own for a time trial. The heat's
 * rules stay the judge of every merge; this only says it in the mechanic's words.
 */
export function heatHost(spec: HeatSpec, goal: number): MissionMechanicHost {
  return { required: Math.max(1, goal), wisps: [], mechanic: { kind: 'wisp-rush', perches: WISP_RUSH_PERCHES.slice(0, Math.max(1, Math.min(WISP_RUSH_PERCHES.length, spec.up))) } };
}

/** The strike a merge made, as a flight the wisp layer can aim and land: which wisp of the roster, and how hard. */
export function heatMissionStrike(strike: HeatStrike, fromCell: number, resultDefinitionId: string): MissionStrike {
  if (strike.wasted || strike.wisp < 0) return { fromCell, resultDefinitionId, hits: [], target: null, finale: false, wasted: true };
  return { fromCell, resultDefinitionId, hits: [{ wisp: strike.wisp, damage: strike.damage }], target: strike.wisp, finale: false, wasted: false };
}

const rosterState = (heat: HeatState | null): WispRushState => heat ? { kind: 'wisp-rush', strikes: 0, wisps: heat.roster.map((wisp) => ({ ...wisp, damage: 0 })) } : createWispRushState();

/**
 * The wisps of a running heat, for the wisp layer: the dock publishes the heat as it changes, the layer subscribes and
 * takes each new wisp as it appears. Nothing else re-renders for it (the Kingdom screen never hears about a wisp).
 */
export type RushLive = MissionMechanicLive & { publish: (heat: HeatState) => void };
export function createRushLive(): RushLive {
  let state = rosterState(null);
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish: (heat) => {
      if (heat.roster.length === state.wisps.length) return;
      state = rosterState(heat);
      for (const listener of listeners) listener();
    },
  };
}

/** Where the daily trial lives: Dashkit's island, open once its first chapter has brought them home. */
export const WISP_RUSH_HOST = { islandId: 'rush-track', campaignId: 'island-campaign:rush-track', hostName: 'Dashkit', unlockLevel: 1 } as const;
