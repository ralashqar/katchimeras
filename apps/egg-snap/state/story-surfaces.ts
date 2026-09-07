import { createContentFlowSurface } from '@incubator/story-expo/surface';
import { catalog } from './ftue';
import { storyRepository } from './story-repository';
export const { useContentFlowSurface } = createContentFlowSurface({ catalog, repository: storyRepository });
