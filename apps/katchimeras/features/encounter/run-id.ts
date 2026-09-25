import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import { hashSeed } from './seed';

/**
 * The run a saved encounter board belongs to: the encounter, the attempt,
 * the loadout brought in, and a fingerprint of the authored board. A new
 * attempt, a different Katchimera or a re-authored board starts fresh
 * instead of resuming a board played under other rules.
 */
export function encounterFingerprint(encounter: EncounterDefinition): string {
  return hashSeed(JSON.stringify([encounter.rows, encounter.seed, encounter.mist, encounter.spawners, encounter.cache ?? null, encounter.mechanic ?? null, encounter.required, encounter.resolve, encounter.objective])).toString(36);
}

export function encounterRunId(encounter: EncounterDefinition, attempt: number, loadout: EncounterLoadout | null): string {
  // A partner (the second hero slot) makes it a different run; a lone hero's id is unchanged, so their saves resume.
  const partner = loadout?.partner ? `:+${loadout.partner.companionId}:${loadout.partner.level}` : '';
  return `${encounter.id}:${Math.max(1, Math.floor(attempt))}:${loadout?.companionId ?? '-'}:${loadout?.level ?? 0}:${loadout?.wispId ?? '-'}${partner}:${encounterFingerprint(encounter)}`;
}
