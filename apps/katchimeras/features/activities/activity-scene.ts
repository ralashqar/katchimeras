import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { MergeWorldState } from '@/types/merge-world';
import type { ActivityResult, ActivitySession } from './activity-session';

export type ActivitySceneProps = {
  session: ActivitySession; world: MergeWorldState; active: boolean;
  rootRef: RefObject<View | null>; tileNode: View | null;
  width: number; bottomInset: number; topInset: number;
  onBoardMetrics: (metrics: MergeBoardScreenMetrics | null) => void;
  onReady: () => void;
  onLeave: (result?: ActivityResult) => Promise<void>;
};
