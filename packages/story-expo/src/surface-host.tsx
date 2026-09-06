import type { ReactNode } from 'react';

import type { ContentFlowNode, ContentFlowSurface, ContentFlowSurfaceViewModel } from '@incubator/story/types';

export function createStorySurfaceHost(useContentFlowSurface: (surface:ContentFlowSurface)=>ContentFlowSurfaceViewModel) {

function StorySurfaceHost({
  children,
  renderStory,
  surface,
}: {
  children: ReactNode;
  renderStory: (node: ContentFlowNode, model: ContentFlowSurfaceViewModel) => ReactNode;
  surface: ContentFlowSurface;
}) {
  const model = useContentFlowSurface(surface);
  if (!model.active || !model.node) return children;
  return renderStory(model.node, model);
}

function useStorySurfaceOwnership(surface: ContentFlowSurface) {
  const model = useContentFlowSurface(surface);
  return {
    ...model,
    ownsSurface: model.active,
    shouldHideRegularUI: model.active,
  };
}

return {StorySurfaceHost,useStorySurfaceOwnership};
}
