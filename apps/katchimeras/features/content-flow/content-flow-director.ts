import { createContentFlowDirector } from '@incubator/story/director';
import * as catalog from './content-flow-catalog';
import * as effects from './content-flow-capabilities';
import * as repository from './content-flow-repository';
import { createClientId } from '@/utils/client-id';
export const { startContentFlow, dispatchContentFlowCommand, startChildContentFlow, completeChildAndResumeParent, contentFlowDomainEvent, publishContentFlowDomainEvent, submitActiveContentFlowScene, acknowledgeActiveContentFlowPresentation, acknowledgeActiveContentFlowNavigation, resumeActiveContentFlows, previewContentFlowNodeForDebug } = createContentFlowDirector({catalog, effects, repository, createClientId});
