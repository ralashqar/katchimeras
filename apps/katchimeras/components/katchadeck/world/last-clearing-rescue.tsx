import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { STEPPLING_MEETS_CONTINUE, STEPPLING_MEETS_LINES, STEPPLING_MEETS_TITLE } from '@/features/onboarding/last-clearing';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';


/**
 * A friend trapped under the thick Mist on a rescue board (Steppling on the Lost Trail's last stone, Baristabbit at his
 * lit window): their cut-out as a shadow in the trapped cell, breathing in and out of sight. It sits over the board cell's
 * screen frame and goes when the Mist does.
 */
export function TrappedFriendSilhouette({ frame, companion = 'steppling' }: { frame: { x: number; y: number; width: number; height: number }; companion?: string }) {
  const art = useMemo(() => resolveCreatureArtSource(companion), [companion]);
  const reduceMotion = useReducedMotion();
  const presence = useSharedValue(0.4);
  useEffect(() => {
    if (reduceMotion) return;
    presence.value = withRepeat(withSequence(
      withTiming(0.75, { duration: 1_400, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.35, { duration: 1_700, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    return () => cancelAnimation(presence);
  }, [presence, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: presence.value }));
  const size = frame.width * 0.78;
  return <Animated.View pointerEvents="none" style={[styles.silhouette, { left: frame.x + (frame.width - size) / 2, top: frame.y + (frame.height - size) / 2, width: size, height: size }, style]}>
    {art ? <Image source={art} style={{ width: size, height: size, tintColor: '#2B2640' }} contentFit="contain" transition={0} accessible={false} /> : null}
  </Animated.View>;
}

/** Steppling's first words (beat 14), with Mossprout; the button welcomes him into the Sanctuary. */
export function LastClearingStepplingMeets({ onWelcome }: { onWelcome: () => void }) {
  const entries = useMemo((): ConversationTranscriptEntry[] => STEPPLING_MEETS_LINES.map((line, index) => ({ id: `steppling-meets:${index}`, speaker: line.speaker, text: line.text })), []);
  return <ConversationNarrativeOverlay title={STEPPLING_MEETS_TITLE} entries={entries} checkpoint="steppling-meets" required paced onClose={() => undefined}>
    {(perform) => <KatchaButton fullWidth glow pill label={STEPPLING_MEETS_CONTINUE} onPress={() => perform(onWelcome, true)} />}
  </ConversationNarrativeOverlay>;
}

const styles = StyleSheet.create({
  silhouette: { position: 'absolute', zIndex: FTUE_SCENE_LAYERS.spotlight - 1 },
});
