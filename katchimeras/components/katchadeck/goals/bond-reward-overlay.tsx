import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { REWARD_TOKEN_MAX_COUNT, RewardTokenFlight } from '@/components/katchadeck/ui/reward-token-flight';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import type { GoalTaskSourceRect } from './goal-task-row';

export function BondRewardFlightOverlay({ from, onFinish, onTokenArrive, points, to }: {
  from: GoalTaskSourceRect;
  onFinish: () => void;
  onTokenArrive?: (amount: number, index: number, count: number) => void;
  points: number;
  to: GoalTaskSourceRect;
}) {
  const reduceMotion = useReducedMotion();
  const timers = useDisposableTimers('bond-reward-flight');
  const count = reduceMotion ? 1 : Math.min(REWARD_TOKEN_MAX_COUNT, Math.max(1, points));
  const amounts = useMemo(() => Array.from({ length: count }, (_, index) =>
    Math.floor(points / count) + (index < points % count ? 1 : 0)
  ), [count, points]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay]}>
      {amounts.map((amount, index) => (
        <BondHeartToken
          amount={amount}
          count={count}
          from={from}
          index={index}
          key={`${index}:${amount}`}
          onArrive={() => {
            onTokenArrive?.(amount, index, count);
            if (process.env.EXPO_OS === 'ios') {
              void Haptics.impactAsync(index === count - 1
                ? Haptics.ImpactFeedbackStyle.Medium
                : index >= Math.ceil(count / 2)
                  ? Haptics.ImpactFeedbackStyle.Light
                  : Haptics.ImpactFeedbackStyle.Soft);
              if (index === count - 1) timers.schedule(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft), 170);
            }
            if (index === count - 1) onFinish();
          }}
          to={to}
        />
      ))}
    </View>
  );
}

function BondHeartToken({ count, from, index, onArrive, to }: {
  amount: number;
  count: number;
  from: GoalTaskSourceRect;
  index: number;
  onArrive: () => void;
  to: GoalTaskSourceRect;
}) {
  return (
    <RewardTokenFlight
      count={count}
      from={{ x: from.x + from.width / 2, y: from.y + from.height / 2 }}
      index={index}
      onArrive={onArrive}
      to={{ x: to.x + to.width / 2, y: to.y + to.height / 2 }}
      tokenSize={46}
      zIndex={10_002 + index}>
      <BondIconArt size={42} />
    </RewardTokenFlight>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 10_000 },
});
