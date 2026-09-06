import { createStorySurfaceHost } from '@incubator/story-expo/surface-host';
import {useContentFlowSurface} from './use-content-flow-surface';
export const {StorySurfaceHost,useStorySurfaceOwnership}=createStorySurfaceHost(useContentFlowSurface);
