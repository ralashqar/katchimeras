import { albumPhase, packDefinition, wispAlbum } from '@/constants/wisp-albums';
import { WISP_RARITY } from '@/constants/wisp-rarity';
import { wispDefinition } from '@/constants/wisps';
import type { WispLanternState, WispPackDefinition, WispPackInstance } from '@/types/wisp-lantern';

export function lanternPackGroups(lantern: WispLanternState | undefined, now: number) {
  const groups = new Map<string, { key: string; definition: WispPackDefinition; packs: WispPackInstance[]; priority: number }>();
  for (const pack of Object.values(lantern?.packs ?? {}).filter(p => p.openedAt == null).sort((a, b) => a.grantedAt - b.grantedAt || a.id.localeCompare(b.id))) {
    const key = `${pack.definitionId}:${pack.definitionVersion}`;
    const definition = packDefinition(pack.definitionId, pack.definitionVersion, lantern?.previewSeasonStartedAt);
    const phase = albumPhase(wispAlbum(definition.collectionId, lantern?.previewSeasonStartedAt), now);
    const group = groups.get(key) ?? { key, definition, packs: [], priority: phase === 'active' ? 0 : phase === 'permanent' ? 1 : 2 };
    group.packs.push(pack); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.priority - b.priority || a.packs[0].grantedAt - b.packs[0].grantedAt);
}
export function packOddsText(definition: WispPackDefinition) {
  const rows: string[] = [];
  for (let slot = 0; slot < definition.slots; slot++) {
    const guarantee = definition.guaranteedRarity?.slot === slot ? definition.guaranteedRarity : undefined;
    const pool = definition.pool.filter(p => !guarantee || WISP_RARITY[wispDefinition(p.id).rarity].rank >= WISP_RARITY[guarantee.minimum].rank);
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    rows.push(`Card ${slot + 1}${guarantee ? ` · ${WISP_RARITY[guarantee.minimum].label} or better` : ''}: ${pool.map(p => `${wispDefinition(p.id).name} ${Number((p.weight / total * 100).toFixed(2))}%`).join(', ')}.`);
  }
  if (definition.distinct) rows.push('Cards are drawn without repeats within this pack; later probabilities are renormalized over the remaining visitors.');
  if (definition.guaranteeAfterDryPacks != null) rows.push(`After ${definition.guaranteeAfterDryPacks} packs in this group without a new visitor, the final card is chosen equally from missing visitors eligible for that slot, unless an earlier card was new. Rarity guarantees always apply.`);
  rows.push('Duplicates become Echoes: Common 1, Rare 5, Epic 10, Legendary 20. Bond and story Wisps are earned through their own discoveries.');
  return rows.join('\n\n');
}
