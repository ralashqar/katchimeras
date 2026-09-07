import { View } from 'react-native';
import { Image } from 'expo-image';
import { RewardTokenFlight } from '@incubator/game-ui/reward-token-flight';
import { runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { DEFEAT_FINISH_MS, DEFEAT_REWARD_AT_MS } from '../game/hatch-presentation';

// The same shared Glow art used by Katchimeras' currency HUD and merge payouts.
const GLOW_ART = require('@incubator/art-merge-world/ui/glow-swirl-v3.png');

/** Cosmetic payout only: durable currency still comes from the single duel result receipt. */
export function DuelHatchRewards({clock, at, won, from, to, onArrive, onDone}: {
  clock: SharedValue<number>; at: number; won: boolean;
  from: {x: number; y: number}; to: {x: number; y: number};
  onArrive: () => void; onDone: () => void;
}) {
  const finished = useSharedValue(false);
  useAnimatedReaction(() => clock.value - at >= DEFEAT_FINISH_MS, done => {
    if (done && !finished.value) {finished.value = true; runOnJS(onDone)();}
  });
  return <View pointerEvents="none" style={{position: 'absolute', inset: 0}}>
    {won && Array.from({length: 5}, (_, index) => <RewardTokenFlight key={index} index={index} count={5}
      from={from} to={to} tokenSize={30} timeline={{clock, startAt: at + DEFEAT_REWARD_AT_MS}} onArrive={onArrive}>
      <Image source={GLOW_ART} style={{width: 30, height: 30}} contentFit="contain" transition={0} />
    </RewardTokenFlight>)}
  </View>;
}
