import type { JournalRouteProposal } from '@/types/home';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';

export function journalRouteForQuality(qualityId: string, confidence = 1, reason = 'Matched canonical journal category'): JournalRouteProposal | null {
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    const choice = flow.choices.find((item) => item.qualityIds?.includes(qualityId));
    if (choice) return proposal(flow.id, choice.id, choice.label, confidence, reason, choice.confirmedFacets ?? []);
  }
  return null;
}

export function journalRouteForAlias(value: string, confidence: number, reason: string): JournalRouteProposal | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, ' ');
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    const choice = flow.choices.find((item) => item.routeAliases?.some((alias) => alias.toLowerCase().replace(/_/g, ' ') === normalized));
    if (choice) return proposal(flow.id, choice.id, choice.label, confidence, reason, choice.confirmedFacets ?? []);
  }
  return null;
}

export function rankJournalRoutes(routes: Array<JournalRouteProposal | null>, limit = 3): JournalRouteProposal[] {
  const byId = new Map<string, JournalRouteProposal>();
  for (const route of routes) {
    if (!route) continue;
    const prior = byId.get(route.id);
    if (!prior || route.confidence > prior.confidence) byId.set(route.id, route);
  }
  return [...byId.values()].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)).slice(0, limit);
}

export function journalRouteNeedsConfirmation(routes: JournalRouteProposal[]): boolean {
  const first = routes[0];
  return !first || first.confidence < 0.72 || first.confidence - (routes[1]?.confidence ?? 0) < 0.15;
}

function proposal(flowId: string, choiceId: string, label: string, confidence: number, reason: string, confirmedFacets: JournalRouteProposal['confirmedFacets']): JournalRouteProposal {
  return { id: `${flowId}.${choiceId}`, flowId, choiceId, label, confidence: Math.max(0, Math.min(1, confidence)), reasons: [reason], confirmedFacets };
}
