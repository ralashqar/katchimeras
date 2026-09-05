import type { ContentFlowDefinition } from '@/types/content-flow';

const definitions = new Map<string, ContentFlowDefinition>();

function key(id: string, version: number) {
  return `${id}@${version}`;
}

export function registerContentFlowDefinition(definition: ContentFlowDefinition) {
  const definitionKey = key(definition.id, definition.version);
  const existing = definitions.get(definitionKey);
  if (existing && existing !== definition) throw new Error(`Content flow ${definitionKey} is already registered`);
  const previous = latestContentFlowDefinition(definition.id);
  if (previous && definition.version > previous.version) {
    const currentIds = new Set(definition.nodes.map((node) => node.id));
    const unmigrated = previous.nodes.filter((node) => !currentIds.has(node.id) && !definition.migrations?.[node.id]);
    if (unmigrated.length) throw new Error(`Content flow ${definitionKey} removes released nodes without migrations: ${unmigrated.map((node) => node.id).join(', ')}`);
  }
  definitions.set(definitionKey, definition);
  return definition;
}

export function contentFlowDefinition(id: string, version: number): ContentFlowDefinition | null {
  return definitions.get(key(id, version)) ?? null;
}

export function registeredContentFlowDefinitions(): readonly ContentFlowDefinition[] {
  return [...definitions.values()];
}

export function latestContentFlowDefinition(id: string): ContentFlowDefinition | null {
  return [...definitions.values()]
    .filter((definition) => definition.id === id)
    .sort((left, right) => right.version - left.version)[0] ?? null;
}

export function clearContentFlowCatalogForTests() {
  definitions.clear();
}
