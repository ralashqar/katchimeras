import type { Profile } from './profile';
import type { DuelResult } from '../game/types';

export type Appearance = { skin: string; face: string; hat: string | null; held: string | null };
export type Adventure = {
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
  { id: 'pollen', name: 'Pollen', skin: 'honeycomb', line: 'Small shell. Enormous opinions.' },
] as const;
export const appearance = (skin = 'classic'): Appearance => ({ skin, face: 'curious', hat: null, held: null });
export const freshAdventure = (): Adventure => ({ legacy: false, nestLevel: 0, revealed: ['nest'], fragments: [], claims: [], eggs: ['pip'], activeEgg: 'pip', appearances: { pip: appearance() }, upgradeTokens: 0 });

export function migrateProfile(p: Profile): Profile {
  if (p.version !== 1 && p.version !== 2) throw new Error('Unsupported save version');
  if (!Number.isFinite(p.coins) || p.coins < 0 || !Array.isArray(p.completed) || !Array.isArray(p.skins) || !p.receipts) throw new Error('Invalid profile');
  if (p.version === 2 && p.adventure) {
    const a = p.adventure;
    if (![a.revealed, a.fragments, a.claims, a.eggs].every(value => Array.isArray(value) && value.every(id => typeof id === 'string')) || !a.eggs.includes(a.activeEgg) || !Number.isInteger(a.nestLevel) || a.nestLevel < 0 || a.nestLevel > 2 || !Number.isInteger(a.upgradeTokens) || a.upgradeTokens < 0) throw new Error('Invalid adventure profile');
    for (const id of a.eggs) if (!EGGS.some(egg => egg.id === id) || !a.appearances[id]?.skin || !a.appearances[id]?.face) throw new Error('Invalid egg appearance');
    return p;
  }
  const a = freshAdventure();
  a.legacy = p.completed.length > 0;
  a.appearances.pip = appearance(p.skin);
  if (a.legacy) a.fragments.push('road');
  if (p.completed.includes('glade-2')) a.claims.push('chest');
  if (p.completed.includes('glade-3')) { a.eggs.push('pollen'); a.appearances.pollen = appearance('honeycomb'); }
  if (p.completed.includes('glade-6')) { a.fragments.push('captain'); a.revealed.push('beyond'); a.upgradeTokens = 1; }
  return { ...p, version: 2, adventure: a };
}

export function advanceAdventure(p: Profile, result: DuelResult): Adventure | undefined {
  if (!p.adventure || !result.won || result.practice) return p.adventure;
  const a = p.adventure;
  if (result.levelId === 'glade-1' && !a.fragments.includes('road')) return { ...a, fragments: [...a.fragments, 'road'] };
  if (result.levelId === 'glade-3' && !a.eggs.includes('pollen')) return { ...a, eggs: [...a.eggs, 'pollen'], appearances: { ...a.appearances, pollen: appearance('honeycomb') } };
  if (result.levelId === 'glade-6' && !a.fragments.includes('captain')) return { ...a, fragments: [...a.fragments, 'captain'], revealed: [...new Set([...a.revealed, 'beyond'])], upgradeTokens: a.upgradeTokens + 1 };
  return a;
}

export type WorldAction = 'repair' | 'clear-mist' | 'chest' | 'upgrade';
export function worldAction(p: Profile, action: WorldAction): Profile {
  const a = p.adventure!;
  if (!a) throw new Error('Adventure profile is not ready');
  if (a.claims.includes(action)) return p;
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
      next.revealed = [...new Set([...a.revealed, 'trail'])];
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
  return { ...p, coins, adventure: next };
}

export function selectEgg(p: Profile, id: string): Profile {
  const a = p.adventure!;
  if (!a.eggs.includes(id)) throw new Error('Rescue this egg first');
  return { ...p, skin: a.appearances[id].skin, adventure: { ...a, activeEgg: id } };
}

export function customize(p: Profile, change: Partial<Appearance>): Profile {
  const a = p.adventure!;
  const current = a.appearances[a.activeEgg];
  if (change.skin !== undefined && (typeof change.skin !== 'string' || !change.skin)) throw new Error('Unknown shell');
  if (change.skin && !p.skins.includes(change.skin) && change.skin !== EGGS.find(e => e.id === a.activeEgg)?.skin) throw new Error('This shell is not owned');
  if (change.face !== undefined && !['dizzy', 'sleepy', 'curious', 'determined', 'heroic', 'surprise', 'grin'].includes(change.face)) throw new Error('Unknown face');
  if (change.hat && !['party-cone', 'tiny-golden-crown'].includes(change.hat)) throw new Error('Unknown hat');
  if (change.hat === 'tiny-golden-crown' && !a.fragments.includes('captain')) throw new Error('Defeat Captain Crack to unlock this crown');
  if (change.held && change.held !== 'star-wand') throw new Error('Unknown accessory');
  const next = { ...current, ...change };
  return { ...p, skin: next.skin, adventure: { ...a, appearances: { ...a.appearances, [a.activeEgg]: next } } };
}
