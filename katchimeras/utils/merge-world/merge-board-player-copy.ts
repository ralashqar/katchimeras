import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID, type MossproutRootGateDefinition } from '@/constants/merge-world-catalog';

/**
 * Player language for Mossprout roots. Keep storage fields such as `kind`,
 * `target`, `level`, and `gateId` out of anything returned from this module.
 */
export function mossproutRootConditionCopy(root: MossproutRootGateDefinition) {
  if (root.kind === 'journey_day' || root.kind === 'mastery') {
    return `Reach Mossprout Journey Day ${root.target}.`;
  }
  if (root.kind === 'friendship') return `Reach Friendship Level ${root.target} with Mossprout.`;
  if (root.kind === 'memory') return root.target === 1
    ? 'Save one nature memory.'
    : `Save nature memories on ${root.target} days.`;
  if (root.kind === 'focus') return mossproutNatureGoalConditionCopy(root.target);
  return 'Befriend one of Mossprout’s Wisps.';
}

export function mossproutRootRewardCopy(root: MossproutRootGateDefinition) {
  if (!root.rewards.length) return 'Opens this space.';
  const rewards = root.rewards.map((reward) => {
    if (reward.kind === 'generator_unlock') {
      const name = MERGE_GENERATORS_BY_ID.get(reward.generatorId)?.name ?? 'a new item maker';
      return `adds the ${name} to your board`;
    }
    if (reward.kind === 'generator_level') return itemMakerImprovementCopy(reward.generatorId, reward.level);
    if (reward.kind === 'merge_item') {
      const name = MERGE_ITEMS_BY_ID.get(reward.definitionId)?.name ?? 'a Mossprout item';
      return `places a ${name} here`;
    }
    if (reward.kind === 'wisp') return `${titleCase(reward.wispId)} joins you`;
    if (reward.kind === 'memory_card') return 'gives a rare Memory Card to reveal';
    return `restores ${reward.title}`;
  });
  return `${capitalize(joinNaturally(rewards))}.`;
}

export function mossproutRootReadyCopy(root: MossproutRootGateDefinition) {
  const item = MERGE_ITEMS_BY_ID.get(root.rootMemoryDefinitionId)?.name ?? 'Root Memory';
  return `Drag the parcel’s ${item} here.`;
}

function mossproutNatureGoalConditionCopy(stage: number) {
  if (stage === 1) return 'Choose a nature goal with Mossprout.';
  if (stage === 2) return 'Complete 3 activities for your Mossprout nature goal.';
  if (stage === 3) return 'Reflect on your nature goal with Mossprout.';
  return 'Review your nature goal with Mossprout and choose what comes next.';
}

function itemMakerImprovementCopy(itemMakerId: string, level: number) {
  if (itemMakerId === 'wild-garden') return level >= 3
    ? 'the Wild Garden finds Sprouts and Shells more often'
    : 'the Wild Garden can find Sprouts and Shells';
  if (itemMakerId === 'memory-nursery') return level >= 3
    ? 'the Memory Nursery grows Pressed Leaves more often'
    : 'the Memory Nursery can grow Pressed Leaves';
  return `improves ${MERGE_GENERATORS_BY_ID.get(itemMakerId)?.name ?? 'an item maker'}`;
}

function joinNaturally(parts: readonly string[]) {
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
