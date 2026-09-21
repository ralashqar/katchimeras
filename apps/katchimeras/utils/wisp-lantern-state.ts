import { WISP_RARITY } from '@/constants/wisp-rarity';
import { wispDefinition } from '@/constants/wisps';
import { LANTERN_COLLECTION, LANTERN_VISITORS, ORDINARY_PROTECTION, WELCOME_PACK, WELCOME_RECEIPT } from '@/constants/wisp-lantern';
import { albumPhase, albumWisps, packDefinition, wispAlbum } from '@/constants/wisp-albums';
import type { WispCollectionState, WispId } from '@/types/wisp';
import type { WispLanternCommand, WispLanternState, WispPackInstance } from '@/types/wisp-lantern';
import { rollWispPack, wispRandom } from '@/utils/wisp-pack-roll';
export function emptyWispLantern(): WispLanternState {
  return { version: 2, scope: 'local-lantern-v1', unlockedAt: null, introducedAt: null, packs: {}, echoes: 0, dryPacksByGroup: {},
    dryPacks: 0, receipts: [], residents: [], cosmetics: [], claims: [], duplicateExplained: false };
}
export function normalizeWispLantern(raw: unknown): WispLanternState {
  if (!raw || typeof raw !== 'object') return emptyWispLantern();
  const value = raw as Partial<WispLanternState>;
  if (value.scope !== 'local-lantern-v1' || ![1, 2].includes(Number(value.version))) throw new Error('Unsupported Wisp Lantern save');
  if (!Number.isSafeInteger(value.echoes) || value.echoes! < 0 || !value.packs || !Array.isArray(value.receipts)) throw new Error('Invalid Wisp Lantern save');
  if (!Number.isSafeInteger(value.dryPacks) || value.dryPacks! < 0 || !Array.isArray(value.residents) || value.residents.length > 5
    || !Array.isArray(value.cosmetics) || !Array.isArray(value.claims)
    || [value.unlockedAt, value.introducedAt].some(at => at !== null && !Number.isFinite(at))) throw new Error('Invalid Wisp Lantern progress');
  for (const [id, pack] of Object.entries(value.packs)) {
    const definition = packDefinition(pack.definitionId, pack.definitionVersion, value.previewSeasonStartedAt);
    if (!pack || pack.id !== id || pack.scope !== value.scope || !Number.isSafeInteger(pack.seed) || !Number.isInteger(pack.revealed) || pack.revealed < 0
      || !Number.isFinite(pack.grantedAt) || (pack.openedAt != null && (!Number.isFinite(pack.openedAt) || !Array.isArray(pack.outcomes)))
      || (pack.focusedCardIndex != null && (!pack.outcomes || !Number.isInteger(pack.focusedCardIndex) || pack.focusedCardIndex < 0 || pack.focusedCardIndex >= pack.outcomes.length))
      || (pack.outcomes && (pack.revealed > pack.outcomes.length || pack.outcomes.some(outcome => !definition.pool.some(entry => entry.id === outcome.id) || !Number.isSafeInteger(outcome.echoes) || outcome.echoes < 0)))) throw new Error('Invalid saved Wisp pouch');
  }
  const dryPacksByGroup = Number(value.version) === 1 ? { [ORDINARY_PROTECTION]: value.dryPacks! } : value.dryPacksByGroup ?? {};
  if (Object.values(dryPacksByGroup).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid pack protection');
  return { ...emptyWispLantern(), ...value, version: 2, dryPacksByGroup } as WispLanternState;
}
export { wispRandom };
function own(state: WispCollectionState, id: WispId, receiptId: string, now: number) {
  state.inventory[id] = { wispId: id, quantity: 1, sources: ['visitor'], firstGrantedAt: now, giftableQuantity: 0 };
  state.unlocked[id] = { wispId: id, unlockedAt: now, sourceDayId: null, seenReveal: true };
  state.appliedGrantReceiptIds = [...(state.appliedGrantReceiptIds ?? []), receiptId];
}
function grant(lantern: WispLanternState, id: string, definitionId: string, seed: number, now: number, version?: number) {
  if (!id || Object.hasOwn(Object.prototype, id) || !Number.isSafeInteger(seed)) throw new Error('Invalid pouch receipt.');
  if (lantern.packs[id]) return;
  const definition = packDefinition(definitionId, version, lantern.previewSeasonStartedAt);
  const album = wispAlbum(definition.collectionId, lantern.previewSeasonStartedAt);
  if (album.seasonal && albumPhase(album, now) !== 'active') throw new Error('This season is not awarding packs.');
  lantern.packs[id] = { id, definitionId, definitionVersion: definition.version, scope: 'local-lantern-v1', seed, grantedAt: now, revealed: 0 };
}
export function reduceWispLantern(input: WispCollectionState, command: WispLanternCommand, now: number, seed = 1, externallyOwned: readonly WispId[] = [], residentCapacity = 3): WispCollectionState {
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
      grant(lantern, command.receiptId, command.definitionId, command.seed, now, command.definitionVersion); break;
    case 'open_pack': {
      const pack = lantern.packs[command.packId];
      if (!pack || pack.scope !== 'local-lantern-v1') throw new Error('Pouch unavailable.');
      if (pack.openedAt != null) return input;
      const definition = packDefinition(pack.definitionId, pack.definitionVersion, lantern.previewSeasonStartedAt);
      const protection = definition.protectionGroup;
      const dryPacks = protection ? lantern.dryPacksByGroup[protection] ?? 0 : 0;
      // The roll is shared with friends' pouches; what a duplicate is worth (Echoes) is the Lantern's own rule.
      const roll = rollWispPack(definition, pack.seed, owned, dryPacks, (id, slot) => own(state, id, `${pack.id}:slot:${slot}`, now));
      pack.outcomes = roll.map(card => ({ ...card, echoes: card.discovered ? 0 : WISP_RARITY[wispDefinition(card.id).rarity].echoes }));
      lantern.echoes += pack.outcomes.reduce((sum, card) => sum + card.echoes, 0);
      const discovered = roll.some(card => card.discovered);
      const selected = new Set(roll.map(card => card.id));
      pack.openedAt = now;
      if (protection) lantern.dryPacksByGroup[protection] = discovered || definition.pool.every(entry => owned(entry.id)) ? 0 : dryPacks + 1;
      lantern.dryPacks = lantern.dryPacksByGroup[ORDINARY_PROTECTION] ?? 0;
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
    case 'claim_collection': {
      const album = wispAlbum(command.collectionId ?? LANTERN_COLLECTION.id, lantern.previewSeasonStartedAt);
      const set = command.setId ? album.sets.find(s => s.id === command.setId) : undefined;
      if (command.setId && !set) throw new Error('Unknown Wisp set.');
      const claimId = set ? `${album.id}:set:${set.id}` : album.id;
      if (lantern.claims.includes(claimId)) return input;
      if (!['permanent', 'active', 'claim'].includes(albumPhase(album, now))) throw new Error('The album reward claim period has ended.');
      if (!(set?.wispIds ?? albumWisps(album)).every(owned)) throw new Error('Complete this collection first.');
      lantern.claims.push(claimId);
      const reward = (set?.reward ?? album.reward).id;
      if (!lantern.cosmetics.includes(reward)) lantern.cosmetics.push(reward);
      break;
    }
    case 'residents':
      if (command.ids.length > residentCapacity || new Set(command.ids).size !== command.ids.length || command.ids.some(id => !owned(id))) throw new Error(`Choose up to ${residentCapacity} owned Wisps.`);
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
