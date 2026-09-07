import { CHARACTERS, characterById, EXPRESSIONS } from '../data/characters';
import type { Profile } from './profile';
import type { DuelResult } from '../game/types';
import { homeCampaignComplete } from '../data/tile-campaigns';

export type Appearance = { skin: string; face: string; hat: string | null; held: string | null };
export type Adventure = {
  worldVersion?: 2;
  pendingPresentation?: { id: string; action: 'repair' | 'clear-mist' | 'upgrade' | 'reveal-beyond'; from: number; to: number } | null;
  legacy: boolean;
  nestLevel: number;
  revealed: string[];
  fragments: string[];
  claims: string[];
  eggs: string[];
  activeEgg: string;
  appearances: Record<string, Appearance>;
  upgradeTokens: number;
};
export const EGGS = [
  { id: 'pip', name: 'Pip', skin: 'classic', line: 'Brave. Mostly by accident.' },
  ...CHARACTERS.map(c => ({id: c.id, name: c.name, skin: c.id, line: c.title})),
] as const;
export const appearance = (skin = 'classic'): Appearance => ({ skin, face: 'curious', hat: null, held: null });
export const freshAdventure = (): Adventure => ({ worldVersion: 2, pendingPresentation: null, legacy: false, nestLevel: 0, revealed: ['nest'], fragments: [], claims: [], eggs: ['pip'], activeEgg: 'pip', appearances: { pip: appearance() }, upgradeTokens: 0 });

export function migrateProfile(p: Profile): Profile {
  if (p.version !== 1 && p.version !== 2) throw new Error('Unsupported save version');
  if (!Number.isFinite(p.coins) || p.coins < 0 || !Array.isArray(p.completed) || !Array.isArray(p.skins) || !p.receipts) throw new Error('Invalid profile');
  if (p.version === 2 && p.adventure) {
    const a = p.adventure;
    if (![a.revealed, a.fragments, a.claims, a.eggs].every(value => Array.isArray(value) && value.every(id => typeof id === 'string')) || !a.eggs.includes(a.activeEgg) || !Number.isInteger(a.nestLevel) || a.nestLevel < 0 || a.nestLevel > 2 || !Number.isInteger(a.upgradeTokens) || a.upgradeTokens < 0) throw new Error('Invalid adventure profile');
    for (const id of a.eggs) if (!EGGS.some(egg => egg.id === id) || !a.appearances[id]?.skin || !a.appearances[id]?.face) throw new Error('Invalid egg appearance');
    if (a.worldVersion === 2) return p;
    // Preserve old unlocks and rescue rewards without inventing battle receipts.
    const revealed = [...new Set([...a.revealed,
      ...(p.completed.some(id => ['glade-4', 'glade-5', 'glade-6'].includes(id)) ? ['trail'] : []),
      ...(p.regions.includes('cheerlet') ? ['beyond'] : [])])];
    return { ...p, adventure: { ...a, worldVersion: 2, pendingPresentation: null, revealed } };
  }
  const a = freshAdventure();
  a.legacy = p.completed.length > 0;
  a.appearances.pip = appearance(p.skin);
  if (a.legacy) a.fragments.push('road');
  if (p.completed.includes('glade-2')) a.claims.push('chest');
  if (p.completed.includes('glade-3')) { a.eggs.push('pollen'); a.appearances.pollen = appearance('honeycomb'); }
  if (p.completed.includes('glade-6')) { a.fragments.push('captain'); a.revealed.push('beyond'); a.upgradeTokens = 1; }
  if (a.legacy) { a.nestLevel = 1; a.claims.push('repair'); }
  if (p.completed.includes('glade-3')) a.revealed.push('trail');
  if (p.regions.includes('cheerlet')) a.revealed.push('beyond');
  return { ...p, version: 2, adventure: a };
}

export function advanceAdventure(p: Profile, result: DuelResult): Adventure | undefined {
  if (!p.adventure || !result.won || result.practice) return p.adventure;
  const a = p.adventure;
  if (result.levelId === 'glade-1' && !a.fragments.includes('road')) return { ...a, fragments: [...a.fragments, 'road'] };
  if (result.levelId === 'glade-4' && !a.eggs.includes('pollen')) return { ...a, eggs: [...a.eggs, 'pollen'], appearances: { ...a.appearances, pollen: appearance('honeycomb') } };
  if (result.levelId === 'glade-6' && !a.fragments.includes('captain')) return { ...a, fragments: [...a.fragments, 'captain'], upgradeTokens: a.upgradeTokens + 1 };
  return a;
}

export type WorldAction = 'repair' | 'clear-mist' | 'chest' | 'upgrade' | 'reveal-beyond';
export function worldAction(p: Profile, action: WorldAction): Profile {
  const a = p.adventure!;
  if (!a) throw new Error('Adventure profile is not ready');
  if (a.claims.includes(action) || (action === 'clear-mist' && a.revealed.includes('trail')) || (action === 'reveal-beyond' && a.revealed.includes('beyond'))) return p;
  if (a.pendingPresentation) throw new Error('Finish the current restoration first');
  let coins = p.coins;
  let next = { ...a, claims: [...a.claims, action] };
  switch (action) {
    case 'repair':
      if (!a.fragments.includes('road')) throw new Error('Find the Golden Shell fragment first');
      // Legacy players never need to grind to access their migrated world.
      if (!a.legacy && coins < 40) throw new Error('The repair needs 40 coins');
      coins -= a.legacy ? 0 : 40;
      next.nestLevel = 1;
      break;
    case 'clear-mist':
      if (a.nestLevel < 1) throw new Error('Repair your nest first');
      if (!homeCampaignComplete(p.completed)) throw new Error('Finish the three home battles first');
      if (coins < 80) throw new Error('The reveal needs 80 coins');
      coins -= 80;
      next.revealed = [...new Set([...a.revealed, 'trail'])];
      break;
    case 'reveal-beyond':
      if (!a.fragments.includes('captain')) throw new Error('Defeat Captain Crack first');
      if (coins < 180) throw new Error('The reveal needs 180 coins');
      coins -= 180;
      next.revealed = [...new Set([...a.revealed, 'beyond'])];
      break;
    case 'chest':
      if (!p.completed.includes('glade-2')) throw new Error('Win the trail battle first');
      coins += 40;
      break;
    case 'upgrade':
      if (a.upgradeTokens < 1 || a.nestLevel < 1) throw new Error('Win the captain’s upgrade reward first');
      next = { ...next, nestLevel: 2, upgradeTokens: a.upgradeTokens - 1 };
      break;
  }
  if (action !== 'chest') next = { ...next, pendingPresentation: { id: `world:${action}`, action, from: action === 'repair' || action === 'upgrade' ? a.nestLevel : 0, to: action === 'repair' || action === 'upgrade' ? next.nestLevel : 1 } };
  return { ...p, coins, regions: action === 'reveal-beyond' ? [...new Set([...p.regions, 'cheerlet'])] : p.regions, adventure: next };
}

export function selectEgg(p: Profile, id: string): Profile {
  const a = p.adventure!;
  if (!a.eggs.includes(id)) throw new Error('Rescue this egg first');
  return { ...p, skin: id === 'pip' ? a.appearances[id].skin : id, adventure: { ...a, activeEgg: id } };
}

export function customize(p: Profile, change: Partial<Appearance>): Profile {
  const a = p.adventure!;
  const current = a.appearances[a.activeEgg];
  if (a.activeEgg !== 'pip') {
    if (change.skin !== undefined || change.hat !== undefined || change.held !== undefined) throw new Error('This egg has an authored outfit');
    if (change.face && !(EXPRESSIONS as readonly string[]).includes(change.face)) throw new Error('Unknown expression');
    return {...p, adventure: {...a, appearances: {...a.appearances, [a.activeEgg]: {...current, ...change}}}};
  }
  if (change.skin !== undefined && (typeof change.skin !== 'string' || !change.skin)) throw new Error('Unknown shell');
  if (change.skin && !p.skins.includes(change.skin) && change.skin !== EGGS.find(e => e.id === a.activeEgg)?.skin) throw new Error('This shell is not owned');
  if (change.face !== undefined && !['dizzy', 'sleepy', 'curious', 'determined', 'heroic', 'surprise', 'grin'].includes(change.face)) throw new Error('Unknown face');
  if (change.hat && !['party-cone', 'tiny-golden-crown'].includes(change.hat)) throw new Error('Unknown hat');
  if (change.hat === 'tiny-golden-crown' && !a.fragments.includes('captain')) throw new Error('Defeat Captain Crack to unlock this crown');
  if (change.held && change.held !== 'star-wand') throw new Error('Unknown accessory');
  const next = { ...current, ...change };
  return { ...p, skin: next.skin, adventure: { ...a, appearances: { ...a.appearances, [a.activeEgg]: next } } };
}

export function finishWorldPresentation(p: Profile, id: string): Profile {
  if (p.adventure?.pendingPresentation?.id !== id) return p;
  return { ...p, adventure: { ...p.adventure, pendingPresentation: null } };
}

/** Defeated rivals join after the captain; Pollen remains the automatic FTUE rescue. */
export function canClaimCharacter(p: Profile, id: string): boolean {
  const c = characterById(id), a = p.adventure;
  return !!c && !!a && id !== 'pollen' && !a.eggs.includes(id) && a.fragments.includes('captain') && p.completed.includes(c.encounter);
}
export function claimCharacter(p: Profile, id: string): Profile {
  if (p.adventure?.eggs.includes(id)) return p;
  if (!canClaimCharacter(p, id)) throw new Error('Defeat this rival and Captain Crack first');
  const a = p.adventure!;
  return {...p, adventure: {...a, eggs: [...a.eggs, id], appearances: {...a.appearances, [id]: {...appearance(id), face: 'neutral'}}}};
}
