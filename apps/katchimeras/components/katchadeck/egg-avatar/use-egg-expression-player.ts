import type { EggAvatarFaceId } from '@/types/egg-avatar';
import { useEggExpressionPlayer as usePlayer } from '@incubator/avatar/expressions';
export type EggExpressionCue = import('@incubator/avatar/expressions').EggExpressionCue<EggAvatarFaceId>;
export const useEggExpressionPlayer = usePlayer<EggAvatarFaceId>;
