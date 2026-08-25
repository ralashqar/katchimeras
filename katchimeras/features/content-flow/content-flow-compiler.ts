import type {
  ContentFlowDefinition,
  ContentFlowNode,
  ContentFlowValidationIssue,
} from '@/types/content-flow';

function outgoing(node: ContentFlowNode): readonly string[] {
  switch (node.kind) {
    case 'scene': return node.actions.map((action) => action.next);
    case 'task': return [...node.requirements.flatMap((requirement) => requirement.next ? [requirement.next] : []), node.next];
    case 'effect':
    case 'presentation':
    case 'route': return [node.next];
    case 'branch': return [...node.branches.map((branch) => branch.next), node.fallback];
    case 'complete': return [];
  }
}

export function validateContentFlowDefinition(definition: ContentFlowDefinition): ContentFlowValidationIssue[] {
  const issues: ContentFlowValidationIssue[] = [];
  const ids = new Set<string>();
  const nodes = new Map<string, ContentFlowNode>();

  if (!definition.id.trim()) issues.push({ path: 'id', message: 'Flow id is required' });
  if (!Number.isInteger(definition.version) || definition.version < 1) issues.push({ path: 'version', message: 'Version must be a positive integer' });
  definition.nodes.forEach((node, index) => {
    if (ids.has(node.id)) issues.push({ path: `nodes[${index}].id`, message: `Duplicate node id ${node.id}` });
    ids.add(node.id);
    nodes.set(node.id, node);
    if (node.kind === 'scene' && node.actions.length === 0) issues.push({ path: `nodes[${index}].actions`, message: 'A scene needs at least one action' });
    if (node.kind === 'task') {
      if (node.requirements.length === 0) issues.push({ path: `nodes[${index}].requirements`, message: 'A task needs at least one requirement' });
      const requirementIds = new Set<string>();
      node.requirements.forEach((requirement, requirementIndex) => {
        if (requirementIds.has(requirement.id)) issues.push({ path: `nodes[${index}].requirements[${requirementIndex}].id`, message: `Duplicate requirement id ${requirement.id}` });
        requirementIds.add(requirement.id);
        if ((requirement.count ?? 1) < 1) issues.push({ path: `nodes[${index}].requirements[${requirementIndex}].count`, message: 'Requirement count must be positive' });
      });
    }
  });

  if (!nodes.has(definition.entryNodeId)) issues.push({ path: 'entryNodeId', message: `Missing entry node ${definition.entryNodeId}` });
  definition.nodes.forEach((node, index) => outgoing(node).forEach((target) => {
    if (!nodes.has(target)) issues.push({ path: `nodes[${index}]`, message: `Unknown transition target ${target}` });
  }));

  if (nodes.has(definition.entryNodeId)) {
    const reachable = new Set<string>();
    const stack = [definition.entryNodeId];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const node = nodes.get(id);
      if (node) stack.push(...outgoing(node));
    }
    definition.nodes.forEach((node, index) => {
      if (!reachable.has(node.id)) issues.push({ path: `nodes[${index}]`, message: `Unreachable node ${node.id}` });
    });
    if (![...reachable].some((id) => nodes.get(id)?.kind === 'complete')) issues.push({ path: 'nodes', message: 'No reachable complete node' });

    const canComplete = new Set([...nodes.values()].filter((node) => node.kind === 'complete').map((node) => node.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes.values()) {
        if (!canComplete.has(node.id) && outgoing(node).some((id) => canComplete.has(id))) {
          canComplete.add(node.id);
          changed = true;
        }
      }
    }
    reachable.forEach((id) => {
      if (!canComplete.has(id)) issues.push({ path: `nodes.${id}`, message: `Node ${id} cannot reach completion` });
    });
  }
  return issues;
}

export function defineContentFlow<T extends ContentFlowDefinition>(definition: T): T {
  const issues = validateContentFlowDefinition(definition);
  if (issues.length) throw new Error(`Invalid content flow ${definition.id}: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
  return definition;
}
