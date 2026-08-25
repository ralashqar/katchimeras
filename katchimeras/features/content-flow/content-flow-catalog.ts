import type { ContentFlowDefinition } from '@/types/content-flow';

const definitions = new Map<string, ContentFlowDefinition>();

function key(id: string, version: number) {
  return `${id}@${version}`;
}

export function registerContentFlowDefinition(definition: ContentFlowDefinition) {
  const definitionKey = key(definition.id, definition.version);
  const existing = definitions.get(definitionKey);
  if (existing && existing !== definition) throw new Error(`Content flow ${definitionKey} is already registered`);
  definitions.set(definitionKey, definition);
  return definition;
}

export function contentFlowDefinition(id: string, version: number): ContentFlowDefinition | null {
  return definitions.get(key(id, version)) ?? null;
}

export function registeredContentFlowDefinitions(): readonly ContentFlowDefinition[] {
  return [...definitions.values()];
}

export function clearContentFlowCatalogForTests() {
  definitions.clear();
}

