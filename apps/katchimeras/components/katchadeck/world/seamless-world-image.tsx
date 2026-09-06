import {createSeamlessWorldImage} from '@incubator/environments/seamless-image';
import {KINGDOM_RENDERING} from '@/constants/kingdom-rendering';
import {SceneImagePerformanceTrace} from '@/hooks/use-scene-performance-probe';
export {worldImageSourceKey} from '@incubator/environments/seamless-image';
function Trace({sourceKey}:{sourceKey:string}) {return <SceneImagePerformanceTrace sceneKey="kingdom" sourceKey={sourceKey}/>;}
export const SeamlessWorldImage=createSeamlessWorldImage({imageCrossfadeMs:KINGDOM_RENDERING.imageCrossfadeMs,Trace});
