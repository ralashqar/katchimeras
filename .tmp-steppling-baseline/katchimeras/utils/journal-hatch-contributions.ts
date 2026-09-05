import {
  journalAffinitiesFor,
  type KatchimeraJournalAffinity,
} from '@/constants/katchimera-journal-affinities';
import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';

export type JournalHatchEvidenceRef = {
  journalRecordId: string;
  routeKey: string;
  sourceKind: JournalRecord['source']['kind'];
  familyId: KatchimeraFamilyId;
  skinId?: KatchimeraSkinId;
  seedId: string;
  role: KatchimeraJournalAffinity['role'];
  weight: number;
  keyMoment: boolean;
  explanation: string;
};

export type AggregatedJournalHatchSignal = {
  familyId: KatchimeraFamilyId;
  skinId?: KatchimeraSkinId;
  seedId: string;
  intensity: number;
  evidence: JournalHatchEvidenceRef[];
};

const CATEGORY_PRIMARY = 0.78;
const CATEGORY_SECONDARY = 0.55;
const CONTEXT_PRIMARY = 0.95;
const CONTEXT_SECONDARY = 0.65;
const KEY_MOMENT_BONUS = 0.2;
const FAMILY_CAP = 1.15;

export function journalHatchContributions(day: StoredHomeDayRecord): JournalHatchEvidenceRef[] {
  const rows: JournalHatchEvidenceRef[] = [];
  for (const record of day.journalRecords ?? []) {
    const contextId = stringField(record.fields.context);
    const affinities = journalAffinitiesFor(record.flowId, record.categoryId, contextId);
    const bestByFamily = new Map<string, KatchimeraJournalAffinity>();
    for (const affinity of affinities) {
      const current = bestByFamily.get(affinity.familyId);
      if (!current || affinityStrength(affinity) > affinityStrength(current)) {
        bestByFamily.set(affinity.familyId, affinity);
      }
    }
    for (const affinity of bestByFamily.values()) {
      const keyMoment = day.keyJournalRecordId === record.id;
      const base = affinityStrength(affinity);
      rows.push({
        journalRecordId: record.id,
        routeKey: journalRouteKey(record, affinity),
        sourceKind: record.source.kind,
        familyId: affinity.familyId,
        skinId: affinity.skinId,
        seedId: affinity.seedId,
        role: affinity.role,
        weight: round2(Math.min(1, base + (keyMoment && affinity.role === 'primary' ? KEY_MOMENT_BONUS : 0))),
        keyMoment,
        explanation: affinity.explanation,
      });
    }
  }
  return rows;
}

export function aggregateJournalHatchSignals(day: StoredHomeDayRecord): AggregatedJournalHatchSignal[] {
  const byFamily = new Map<string, JournalHatchEvidenceRef[]>();
  for (const row of journalHatchContributions(day)) {
    byFamily.set(row.familyId, [...(byFamily.get(row.familyId) ?? []), row]);
  }
  return [...byFamily.entries()].map(([familyId, rows]) => {
    const ranked = [...rows].sort((left, right) => right.weight - left.weight || left.journalRecordId.localeCompare(right.journalRecordId));
    const lead = ranked[0];
    const intensity = Math.min(
      FAMILY_CAP,
      (lead?.weight ?? 0) + (ranked[1]?.weight ?? 0) * 0.18 + (ranked[2]?.weight ?? 0) * 0.08
    );
    return {
      familyId,
      skinId: lead?.skinId,
      seedId: lead?.seedId ?? '',
      intensity: round3(intensity),
      evidence: ranked.slice(0, 3),
    };
  }).filter((row) => row.seedId);
}

function affinityStrength(affinity: KatchimeraJournalAffinity): number {
  if (affinity.contextId) return affinity.role === 'primary' ? CONTEXT_PRIMARY : CONTEXT_SECONDARY;
  return affinity.role === 'primary' ? CATEGORY_PRIMARY : CATEGORY_SECONDARY;
}

function journalRouteKey(record: JournalRecord, affinity: KatchimeraJournalAffinity): string {
  return `journal.route:${record.flowId}.${record.categoryId}${affinity.contextId ? `.${affinity.contextId}` : ''}`;
}

function stringField(value: string | string[] | boolean | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
function round3(value: number): number { return Math.round(value * 1000) / 1000; }
