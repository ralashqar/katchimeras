import type { DuelDefinition } from '../game/types';
import type { Profile } from '../state/profile';
import type { Progression } from '@incubator/tile-match/engine';
import { MOVES } from './campaign';

/** Introductions are authored once; a prolonged fight holds the final standard beat. */
function encounterMix(mechanics: readonly ('tap' | 'drift' | 'bomb' | 'armour')[], singleOpening = false): Progression {
  return { kind: 'stream', loop: false, turns: mechanics.map((id, index) => ({
    slots: singleOpening && index === 0 ? 1 : 2,
    varieties: MOVES[id].varieties.map(variety => ({ ...variety, strength: id === 'drift' ? .2 : variety.strength })),
  })) };
}

/** Tutorial-specific pacing; replay and legacy duel definitions stay unchanged. */
export function ftueEncounter(base: DuelDefinition, profile: Profile): DuelDefinition {
  if (!profile.adventure || profile.adventure.legacy || profile.completed.includes(base.id)) return base;
  const common = { ...base, guided: true, ai: { minActionMs: 4400, maxActionMs: 6000, accuracy: .68 } };
  switch (base.id) {
    case 'glade-1': return { ...common, openingGate: 1, opponentHealth: 36,
      progression: encounterMix(['tap', 'tap', 'drift', 'tap', 'tap', 'tap'], true) };
    case 'glade-3': return { ...common, opponentHealth: 64, progression: encounterMix(['tap', 'bomb', 'tap', 'tap', 'drift', 'tap', 'tap', 'tap']) };
    case 'glade-4': return { ...common, opponentHealth: 64, progression: encounterMix(['tap', 'armour', 'tap', 'tap', 'drift', 'tap', 'tap', 'tap']) };
    case 'glade-2': return { ...common, opponentHealth: 60, progression: encounterMix(['tap', 'tap', 'drift', 'tap', 'tap', 'tap']) };
    case 'glade-5': return { ...common, opponentHealth: 80, progression: encounterMix(['tap', 'bomb', 'tap', 'tap', 'armour', 'tap', 'drift', 'tap']) };
    case 'glade-6': return { ...common, opponentHealth: 120, ai: { minActionMs: 2600, maxActionMs: 3600, accuracy: .78 }, progression: encounterMix(['tap', 'bomb', 'tap', 'tap', 'armour', 'tap', 'drift', 'tap', 'tap', 'tap']) };
    case 'cheerlet-1': return {...common, opponentHealth: 90};
    case 'cheerlet-2': return {...common, opponentHealth: 100};
    case 'cheerlet-3': return {...common, opponentHealth: 140};
    default: return base;
  }
}
