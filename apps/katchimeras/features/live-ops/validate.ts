import type { LiveEventDefinition } from '@/types/live-ops';
import { LANTERN_PACKS } from '@/constants/wisp-lantern';

const KINDS = new Set(['merge', 'order_completed', 'mist_cleared', 'hex_restored', 'structure_upgraded', 'friend_rescued', 'bond_gained', 'wisp_discovered', 'journey_completed', 'expedition_completed', 'incursion_completed']);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const safeId = (value: unknown) => text(value) && /^[a-z0-9][a-z0-9:_-]*$/i.test(value) && !Object.hasOwn(Object.prototype, value);
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && Number(value) >= minimum;

export function validateLiveEvent(value: unknown): { definition: LiveEventDefinition | null; issues: string[] } {
  const issues: string[] = [];
  if (!record(value)) return { definition: null, issues: ['Event must be an object'] };
  for (const key of ['id', 'title', 'description']) if (!text(value[key])) issues.push(`Event needs ${key}`);
  if (!integer(value.version, 1)) issues.push('Event version must be a positive integer');
  if (typeof value.enabled !== 'boolean') issues.push('Event needs an enabled flag');
  if (!integer(value.minHarmony)) issues.push('Minimum Harmony must be a non-negative integer');
  if (value.authority !== undefined && value.authority !== 'local' && value.authority !== 'verified') issues.push('Unknown event authority');
  if (value.authority !== 'local' && (value.encounters !== undefined || value.keepsakes !== undefined)) issues.push('Playable encounters require local authority');
  if (value.authority === 'local') {
    if (!safeId(value.id)) issues.push('Local occurrence ID must be a safe content ID');
    if (typeof value.requiresRestoredGarden !== 'boolean') issues.push('Local events require an explicit garden unlock');
    const keepsakes = Array.isArray(value.keepsakes) ? value.keepsakes : [];
    const ids = new Set<string>();
    for (const k of keepsakes) {
      if (!record(k) || !safeId(k.id) || !text(k.title) || !text(k.description) || !['moon', 'flower'].includes(String(k.symbol)) || k.hexId !== 'mossprout-garden' || ids.has(String(k.id))) issues.push('Keepsakes need unique IDs, copy, a supported symbol and garden tile');
      else ids.add(k.id as string);
    }
    if (value.keepsakes !== undefined && !Array.isArray(value.keepsakes)) issues.push('Keepsakes must be a list');
    if (value.completionKeepsakeId !== undefined && !ids.has(String(value.completionKeepsakeId))) issues.push('Completion keepsake is missing');
    const nodes = Array.isArray(value.encounters) ? value.encounters : [];
    if (value.encounters !== undefined && (!Array.isArray(value.encounters) || !nodes.length || nodes.length > 12)) issues.push('Encounters need 1–12 nodes');
    const nodeIds = new Set<string>();
    for (const n of nodes) {
      if (!record(n) || !safeId(n.id) || nodeIds.has(String(n.id)) || !text(n.hexId) || !text(n.title) || !text(n.opening) || !text(n.resolution) || !text(n.seedItemId) || !integer(n.merges, 1) || Number(n.merges) > 7) { issues.push('Encounter needs unique ID, tile, story, seed and 1–7 merges'); continue; }
      nodeIds.add(n.id as string);
      if (n.companionId !== undefined && !text(n.companionId)) issues.push('Encounter companion must be a content ID');
      if (n.actionTitle !== undefined && !text(n.actionTitle)) issues.push('Encounter action title must be text');
      if (n.tags !== undefined && (!Array.isArray(n.tags) || n.tags.some(t => !text(t)))) issues.push('Encounter tags must be text');
      if (!Array.isArray(n.requirements) || !n.requirements.length || n.requirements.some(r => !record(r) || !text(r.definitionId) || !integer(r.quantity, 1))) issues.push('Encounter needs valid merge requirements');
    }
    for (const r of Array.isArray(value.rules) ? value.rules : []) if (record(r) && r.kind === 'expedition_completed') issues.push('Expedition actions are not implemented');
    for (const t of Array.isArray(value.tiers) ? value.tiers : []) {
      if (!record(t)) continue;
      if (!safeId(t.id)) issues.push('Local reward IDs must be safe content IDs');
      if (t.premium !== undefined) issues.push('Local events cannot grant premium rewards');
      if (record(t.free) && Array.isArray(t.free.items)) for (const item of t.free.items) {
        if (!record(item) || (item.kind !== 'glow' && !(item.kind === 'cosmetic' && ids.has(String(item.id))) && !(item.kind === 'wisp_pack' && item.scope === 'local-lantern-v1' && LANTERN_PACKS.some(p => p.id === item.packId && p.protectionGroup)))) issues.push('Local rewards must be Glow, this event’s keepsakes, or a registered local Lantern pack');
      }
    }
  }
  const dates = ['startsAt', 'endsAt', 'claimEndsAt'].map((key) => typeof value[key] === 'string' ? Date.parse(value[key]) : NaN);
  if (dates.some((date) => !Number.isFinite(date)) || !(dates[0]! < dates[1]! && dates[1]! <= dates[2]!)) issues.push('Dates must be valid and ordered: start < end <= claim end');
  const rules = Array.isArray(value.rules) ? value.rules : [];
  if (!rules.length || rules.length > 32) issues.push('Event needs between 1 and 32 scoring rules');
  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (!record(rule)) { issues.push('Invalid scoring rule'); continue; }
    if (!text(rule.id) || ruleIds.has(rule.id)) issues.push('Scoring rules need unique IDs');
    else ruleIds.add(rule.id);
    if (!KINDS.has(String(rule.kind)) || !integer(rule.points, 1) || !integer(rule.limit, 1) || Number(rule.points) * Number(rule.limit) > 1_000_000_000) issues.push(`Rule ${rule.id}: choose a supported action and bounded positive points/limit`);
    if (rule.filter !== undefined) {
      if (!record(rule.filter)) issues.push(`Rule ${rule.id}: invalid filter`);
      else {
        for (const key of ['companionId', 'regionId', 'targetId']) if (rule.filter[key] !== undefined && !text(rule.filter[key])) issues.push(`Rule ${rule.id}: invalid ${key}`);
        if (rule.filter.minItemTier !== undefined && !integer(rule.filter.minItemTier, 1)) issues.push(`Rule ${rule.id}: invalid item tier`);
        if (rule.filter.tags !== undefined && (!Array.isArray(rule.filter.tags) || !rule.filter.tags.every(text))) issues.push(`Rule ${rule.id}: invalid tags`);
      }
    }
  }
  const tiers = Array.isArray(value.tiers) ? value.tiers : [];
  if (!Array.isArray(value.tiers) || tiers.length > 100) issues.push('Tiers must be a list of at most 100 entries');
  const tierIds = new Set<string>();
  let previous = -1;
  for (const tier of tiers) {
    if (!record(tier)) { issues.push('Invalid tier'); continue; }
    if (!text(tier.id) || tierIds.has(tier.id)) issues.push('Tiers need unique IDs');
    else tierIds.add(tier.id);
    if (!integer(tier.points) || tier.points <= previous) issues.push('Tier thresholds must increase');
    previous = Number(tier.points);
    for (const track of ['free', 'premium']) {
      const bundle = tier[track];
      if (bundle === undefined && track === 'premium') continue;
      if (!record(bundle) || !text(bundle.id) || !Array.isArray(bundle.items) || !bundle.items.length) { issues.push(`${tier.id}: ${track} needs a reward bundle`); continue; }
      for (const item of bundle.items) {
        if (!record(item)) { issues.push(`${tier.id}: invalid reward`); continue; }
        if (item.kind === 'glow' || item.kind === 'gems') {
          if (!integer(item.amount, 1)) issues.push(`${tier.id}: invalid currency amount`);
        } else if (item.kind === 'wisp_pack') {
          if (value.authority !== 'local' || item.scope !== 'local-lantern-v1' || !LANTERN_PACKS.some(p => p.id === item.packId && p.protectionGroup)) issues.push(`${tier.id}: unsupported pack authority or definition`);
        } else if (item.kind === 'wisp' || item.kind === 'cosmetic') {
          if (!text(item.id)) issues.push(`${tier.id}: reward needs a collectible ID`);
        } else if (item.kind === 'item') {
          if (!text(item.id) || !integer(item.quantity, 1)) issues.push(`${tier.id}: invalid item reward`);
        } else if (item.kind === 'event_currency') {
          if (item.eventId !== value.id || !integer(item.amount, 1)) issues.push(`${tier.id}: currency must belong to this event`);
        } else issues.push(`${tier.id}: unsupported reward ${item.kind}; energy is disabled`);
      }
    }
  }
  if (value.incursion !== undefined) {
    const incursion = value.incursion;
    if (!record(incursion) || !text(incursion.regionId) || !text(incursion.keepsakeId) || !Array.isArray(incursion.nodes) || !incursion.nodes.length) issues.push('Incursion needs a region, nodes and keepsake');
    else {
      const seen = new Set<string>();
      for (const node of incursion.nodes) {
        if (!record(node) || !text(node.id) || !text(node.hexId) || !text(node.missionId) || seen.has(node.id)) issues.push('Incursion nodes need unique IDs, hexes and missions');
        else seen.add(node.id);
      }
    }
  }
  return { definition: issues.length ? null : value as unknown as LiveEventDefinition, issues };
}
