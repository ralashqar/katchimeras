import type {
  JourneyCampaignDefinition,
  JourneyCampaignStep,
  JourneyCampaignValidationIssue,
  JourneyDayDefinition,
} from '@/types/journey-campaign';

export function validateJourneyCampaign(definition: JourneyCampaignDefinition): JourneyCampaignValidationIssue[] {
  const issues: JourneyCampaignValidationIssue[] = [];
  const dayIds = new Set<string>();
  const stepIds = new Set<string>();
  let previousNumber = 0;

  definition.days.forEach((day, dayIndex) => {
    const path = `days[${dayIndex}]`;
    if (dayIds.has(day.id)) issues.push({ path: `${path}.id`, message: `Duplicate day id ${day.id}` });
    dayIds.add(day.id);
    if (day.number <= previousNumber) issues.push({ path: `${path}.number`, message: 'Day numbers must be strictly increasing' });
    previousNumber = day.number;
    if (!day.insightKey.trim()) issues.push({ path: `${path}.insightKey`, message: 'Every Journey day needs one player insight key' });
    if (day.steps.at(-1)?.kind !== 'complete') issues.push({ path: `${path}.steps`, message: 'Every Journey day must end with a complete step' });

    day.steps.forEach((step, stepIndex) => {
      const stepPath = `${path}.steps[${stepIndex}]`;
      if (stepIds.has(step.id)) issues.push({ path: `${stepPath}.id`, message: `Duplicate step id ${step.id}` });
      stepIds.add(step.id);
      if (step.kind === 'merge_orders' && step.orders.length === 0) {
        issues.push({ path: `${stepPath}.orders`, message: 'A merge-order step must contain at least one order' });
      }
      if (step.kind === 'resident_discovery' && day.steps.slice(stepIndex + 1).some((candidate) => candidate.kind === 'merge_orders')) {
        issues.push({ path: stepPath, message: 'Resident discovery owns its two orders; do not place a parallel merge-order step after it' });
      }
    });
  });
  return issues;
}

export function assertValidJourneyCampaign(definition: JourneyCampaignDefinition): JourneyCampaignDefinition {
  const issues = validateJourneyCampaign(definition);
  if (issues.length) throw new Error(`Invalid Journey campaign ${definition.id}: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  return definition;
}

export function journeyDayById(definition: JourneyCampaignDefinition, dayId: string): JourneyDayDefinition | null {
  return definition.days.find((day) => day.id === dayId) ?? null;
}

export function journeyStepById(day: JourneyDayDefinition, stepId: string | null): JourneyCampaignStep | null {
  if (!stepId) return day.steps[0] ?? null;
  return day.steps.find((step) => step.id === stepId) ?? null;
}

export function nextJourneyStep(day: JourneyDayDefinition, stepId: string): JourneyCampaignStep | null {
  const index = day.steps.findIndex((step) => step.id === stepId);
  return index < 0 ? null : day.steps[index + 1] ?? null;
}

export function nextJourneyCampaignDay(
  definition: JourneyCampaignDefinition,
  completedDayIds: readonly string[],
): JourneyDayDefinition | null {
  const completed = new Set(completedDayIds);
  return definition.days.find((day) => !completed.has(day.id)) ?? null;
}

/** Compact designer preview used by dev tools and content tests. */
export function journeyCampaignContentRows(definition: JourneyCampaignDefinition) {
  return definition.days.map((day) => ({
    day: day.number,
    id: day.id,
    title: day.title,
    unlockActiveDay: day.unlockActiveDay,
    insightKey: day.insightKey,
    flow: day.steps.map((step) => step.kind).join(' -> '),
  }));
}
