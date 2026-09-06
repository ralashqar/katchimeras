import { createContentFlowSurface } from '@incubator/story-expo/surface';
import * as catalog from './content-flow-catalog';
import * as repository from './content-flow-repository';
import { recordStoryFlowDiagnostic } from './story-flow-diagnostics';
export const {contentFlowSurfaceView,useContentFlowSurface}=createContentFlowSurface({catalog,repository,diagnostics:recordStoryFlowDiagnostic});
