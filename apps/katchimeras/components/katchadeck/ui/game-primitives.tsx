import { createGamePrimitives } from '@incubator/game-ui/game-primitives';
import { GameUI } from '@/constants/game-ui';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameSurface } from './game-surface';
export const { GamePanel, GameTopBar, GameHudBar, GameHudControl, GameHudItem, GameIconButton, GameHeroStage } = createGamePrimitives({GameUI, ThemedText, IconSymbol, GameSurface});
