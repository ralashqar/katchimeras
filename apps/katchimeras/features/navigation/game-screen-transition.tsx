import { createGameScreenTransitions } from '@incubator/presentation/screen-transition';
import { DIAGNOSTICS_ENABLED } from '@/constants/diagnostics';
export type { GameSurfaceId, GameSurfaceReadiness, GameSurfaceReadinessGate } from '@incubator/presentation/screen-transition';
declare module '@incubator/presentation/screen-transition' { interface TransitionTypeRegistry { surface: 'today' | 'you' | 'merge' | 'katchimeras' | 'companion' | 'quest-game'; } }
export const { readinessComplete, GameScreenTransitionProvider, useGameScreenTransition, useGameSurfaceReadiness, TransitionAwareStatusBar } = createGameScreenTransitions(DIAGNOSTICS_ENABLED);
