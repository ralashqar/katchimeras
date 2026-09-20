import { WISP_RARITY } from '@/constants/wisp-rarity';
import { wispDefinition } from '@/constants/wisps';
import { LANTERN_COLLECTION, LANTERN_VISITORS, ORDINARY_PACK, WELCOME_PACK, WELCOME_RECEIPT, lanternPackDefinition } from '@/constants/wisp-lantern';
import type { WispCollectionState, WispId } from '@/types/wisp';
import type { WispLanternCommand, WispLanternState, WispPackInstance } from '@/types/wisp-lantern';
export function emptyWispLantern(): WispLanternState {
  return { version: 1, scope: 'local-lantern-v1', unlockedAt: null, introducedAt: null, packs: {}, echoes: 0,
    dryPacks: 0, receipts: [], residents: [], cosmetics: [], claims: [], duplicateExplained: false };
}
export function normalizeWispLantern(raw: unknown): WispLanternState {
  if (!raw || typeof raw !== 'object') return emptyWispLantern();
  const value = raw as Partial<WispLanternState>;
  if (value.scope !== 'local-lantern-v1' || value.version !== 1) throw new Error('Unsupported Wisp Lantern save');
  if (!Number.isSafeInteger(value.echoes) || value.echoes! < 0 || !value.packs || !Array.isArray(value.receipts)) throw new Error('Invalid Wisp Lantern save');
  if (!Number.isSafeInteger(value.dryPacks) || value.dryPacks! < 0 || !Array.isArray(value.residents) || value.residents.length > 3
    || !Array.isArray(value.cosmetics) || !Array.isArray(value.claims)
    || [value.unlockedAt, value.introducedAt].some(at => at !== null && !Number.isFinite(at))) throw new Error('Invalid Wisp Lantern progress');
  for (const [id, pack] of Object.entries(value.packs)) {
    if (!pack || pack.id !== id || pack.scope !== value.scope || !Number.isSafeInteger(pack.seed) || !Number.isInteger(pack.revealed) || pack.revealed < 0
      || !Number.isFinite(pack.grantedAt) || (pack.openedAt != null && (!Number.isFinite(pack.openedAt) || !Array.isArray(pack.outcomes)))
      || (pack.focusedCardIndex != null && (!pack.outcomes || !Number.isInteger(pack.focusedCardIndex) || pack.focusedCardIndex < 0 || pack.focusedCardIndex >= pack.outcomes.length))
      || (pack.outcomes && (pack.revealed > pack.outcomes.length || pack.outcomes.some(outcome => !(LANTERN_VISITORS as readonly string[]).includes(outcome.id) || !Number.isSafeInteger(outcome.echoes) || outcome.echoes < 0)))) throw new Error('Invalid saved Wisp pouch');
  }
  return { ...emptyWispLantern(), ...value } as WispLanternState;
}
export function wispRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function own(state: WispCollectionState, id: WispId, receiptId: string, now: number) {
  state.inventory[id] = { wispId: id, quantity: 1, sources: ['visitor'], firstGrantedAt: now, giftableQuantity: 0 };
  state.unlocked[id] = { wispId: id, unlockedAt: now, sourceDayId: null, seenReveal: true };
  state.appliedGrantReceiptIds = [...(state.appliedGrantReceiptIds ?? []), receiptId];
}
function grant(lantern: WispLanternState, id: string, definitionId: string, seed: number, now: number) {
  if (!id || Object.hasOwn(Object.prototype, id) || !Number.isSafeInteger(seed)) throw new Error('Invalid pouch receipt.');
  if (lantern.packs[id]) return;
  const definition = lanternPackDefinition(definitionId);
  lantern.packs[id] = { id, definitionId, definitionVersion: definition.version, scope: 'local-lantern-v1', seed, grantedAt: now, revealed: 0 };
}
export function reduceWispLantern(input: WispCollectionState, command: WispLanternCommand, now: number, seed = 1, externallyOwned: readonly WispId[] = []): WispCollectionState {
  if (!Number.isFinite(now)) throw new Error('Invalid Wisp command time');
  const state = structuredClone(input);
  const lantern = state.lantern = normalizeWispLantern(state.lantern);
  const owned = (id: WispId) => (state.inventory[id]?.quantity ?? 0) > 0 || externallyOwned.includes(id);
  if (command.type === 'unlock') {
    lantern.unlockedAt ??= now;
    if (!welcomeLanternPack(state)) grant(lantern, WELCOME_RECEIPT, WELCOME_PACK, seed, now);
    return state;
  }
  if (lantern.unlockedAt == null) throw new Error('Light the Wisp Lantern first.');
  switch (command.type) {
    case 'complete_intro': {
      const welcome = welcomeLanternPack(state);
      if (!welcome?.outcomes || welcome.revealed < welcome.outcomes.length) throw new Error('Welcome your visitors first.');
      lantern.introducedAt ??= now; break;
    }
    case 'grant_pack':
      if (!command.receiptId) throw new Error('A pack needs its reward receipt.');
      grant(lantern, command.receiptId, command.definitionId, command.seed, now); break;
    case 'open_pack': {
      const pack = lantern.packs[command.packId];
      if (!pack || pack.scope !== 'local-lantern-v1') throw new Error('Pouch unavailable.');
      if (pack.openedAt != null) return input;
      const definition = lanternPackDefinition(pack.definitionId, pack.definitionVersion);
      const random = wispRandom(pack.seed);
      const selected = new Set<WispId>();
      let discovered = false;
      pack.outcomes = [];
      for (let slot = 0; slot < definition.slots; slot++) {
        const missing = definition.pool.filter(entry => !owned(entry.id));
        const guarantee: boolean = slot === definition.slots - 1 && !discovered && missing.length > 0
          && definition.guaranteeAfterDryPacks != null && lantern.dryPacks >= definition.guaranteeAfterDryPacks;
        const pool: { id: WispId; weight: number }[] = guarantee ? missing.map(entry => ({ ...entry, weight: 1 })) : definition.pool.filter(entry => !definition.distinct || !selected.has(entry.id));
        let roll = random() * pool.reduce((sum, entry) => sum + entry.weight, 0);
        const chosen = pool.find(entry => (roll -= entry.weight) < 0) ?? pool[pool.length - 1];
        if (!chosen) throw new Error('This pouch has no eligible visitors.');
        selected.add(chosen.id);
        const isNew = !owned(chosen.id);
        const echoes = isNew ? 0 : WISP_RARITY[wispDefinition(chosen.id).rarity].echoes;
        if (isNew) own(state, chosen.id, `${pack.id}:slot:${slot}`, now);
        lantern.echoes += echoes;
        discovered ||= isNew;
        pack.outcomes.push({ id: chosen.id, discovered: isNew, echoes });
      }
      pack.openedAt = now;
      if (pack.definitionId === ORDINARY_PACK) lantern.dryPacks = discovered || LANTERN_VISITORS.every(owned) ? 0 : lantern.dryPacks + 1;
      if (!lantern.residents.length) lantern.residents = [...selected].slice(0, 3);
      break;
    }
    case 'focus_pack_card': {
      const pack = lantern.packs[command.packId];
      if (!pack?.outcomes || !Number.isInteger(command.index) || command.index < 0 || command.index >= pack.outcomes.length) throw new Error('Choose a card in this pack.');
      pack.focusedCardIndex = command.index; break;
    }
    case 'acknowledge_reveal': {
      const pack = lantern.packs[command.packId];
      if (!pack?.outcomes) throw new Error('Open the pouch first.');
      if (!Number.isInteger(command.revealed) || command.revealed < 0) throw new Error('Invalid reveal position.');
      pack.revealed = Math.max(pack.revealed, Math.min(pack.outcomes.length, command.revealed)); break;
    }
    case 'exchange': {
      if (!command.receiptId) throw new Error('An exchange needs a receipt.');
      if (lantern.receipts.includes(command.receiptId)) return input;
      if (Boolean(command.wispId) === Boolean(command.cosmeticId)) throw new Error('Choose one reward.');
      const cost = command.wispId ? 15 : 20;
      if (lantern.echoes < cost) throw new Error(`You need ${cost} Echoes.`);
      if (command.wispId) {
        if (!(LANTERN_VISITORS as readonly string[]).includes(command.wispId) || owned(command.wispId)) throw new Error('Choose a missing Lantern visitor.');
        own(state, command.wispId, command.receiptId, now);
      } else {
        if (command.cosmeticId !== 'lantern-trail' || lantern.cosmetics.includes(command.cosmeticId)) throw new Error('You already own this trail.');
        lantern.cosmetics.push(command.cosmeticId);
      }
      lantern.echoes -= cost; lantern.receipts.push(command.receiptId); break;
    }
    case 'claim_collection':
      if (lantern.claims.includes(LANTERN_COLLECTION.id)) return input;
      if (!LANTERN_VISITORS.every(owned)) throw new Error('Meet all six visitors first.');
      lantern.claims.push(LANTERN_COLLECTION.id); lantern.cosmetics.push('first-gathering'); break;
    case 'residents':
      if (command.ids.length > 3 || new Set(command.ids).size !== command.ids.length || command.ids.some(id => !owned(id))) throw new Error('Choose up to three owned Wisps.');
      lantern.residents = [...command.ids]; break;
    case 'explain_duplicate': lantern.duplicateExplained = true; break;
  }
  return state;
}
export function pendingLanternPack(state: WispCollectionState): WispPackInstance | undefined {
  return Object.values(state.lantern?.packs ?? {}).find(pack => pack.outcomes && pack.revealed < pack.outcomes.length);
}

export function welcomeLanternPack(state: WispCollectionState) {
  return state.lantern?.packs[WELCOME_RECEIPT] ?? state.lantern?.packs['lantern:welcome:v1'];
}
