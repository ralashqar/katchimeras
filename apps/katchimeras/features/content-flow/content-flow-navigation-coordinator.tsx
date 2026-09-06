import {createContentFlowNavigation} from '@incubator/story-expo/navigation';
import * as catalog from './content-flow-catalog';
import * as repository from './content-flow-repository';
import * as director from './content-flow-director';
import {useGameScreenTransition} from '@/features/navigation/game-screen-transition';
import {recordStoryFlowDiagnostic} from './story-flow-diagnostics';
export const {ContentFlowNavigationCoordinator}=createContentFlowNavigation({catalog,repository,director,useGameScreenTransition,diagnostics:recordStoryFlowDiagnostic,
 gameSurface(surface) { if(surface==='collection') return 'katchimeras'; if(surface==='haven'||surface==='companion') return 'companion'; if(surface==='today'||surface==='merge') return surface; return null; },
 onReturn:router=>router.replace('/katchimera/mossprout/activity'), shouldBypassPath:pathname=>pathname.startsWith('/dev-')
});
