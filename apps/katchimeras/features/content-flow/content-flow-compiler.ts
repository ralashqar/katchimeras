import { createContentFlowCompiler } from '@incubator/story/compiler';
import type { ContentFlowValidationIssue, ContentFlowNode } from '@/types/content-flow';
import { validateStoryNodeCapability } from './story-capability-registry';
import { isRegisteredStoryRoute } from './story-route-registry';
export const { validateContentFlowDefinition, defineContentFlow } = createContentFlowCompiler({
validateStoryNodeCapability, isRegisteredStoryRoute,
validateDefinition(definition) {
 const issues: ContentFlowValidationIssue[] = [];
 const nodes = new Map<string, ContentFlowNode>();
 definition.nodes.forEach((node,index) => { nodes.set(node.id,node);
    if (node.kind === 'presentation' && node.presentationType === 'world.upgrade_reveal') {
      const sourceNodeId = node.payload?.sourceEffectNodeId;
      const sourceEffectId = node.payload?.sourceEffectId;
      const source = typeof sourceNodeId === 'string' ? nodes.get(sourceNodeId) : null;
      if (!source || source.kind !== 'effect' || source.effectType !== 'world.upgrade' || source.effectId !== sourceEffectId) {
        issues.push({ path: `nodes[${index}].payload.sourceEffectNodeId`, message: 'Upgrade presentation must reference a world.upgrade effect node and effect id' });
      }
    }

 });
 return issues;
}
});
