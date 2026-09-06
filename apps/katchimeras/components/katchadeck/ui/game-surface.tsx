import { createGameSurfaces } from '@incubator/game-ui/game-surface';
import { GameUI } from '@/constants/game-ui';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
export const { GameSurface, GameIconWell, GameBadge, GameRewardChip } = createGameSurfaces({GameUI, ThemedText, IconSymbol});
