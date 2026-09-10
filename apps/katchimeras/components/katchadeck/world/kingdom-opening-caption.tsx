import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';

/** How long the first caption holds before the second arrives on its own. */
export const OPENING_CAPTION_PAGE_MS = 2_400;

/**
 * The opening's two captions, docked under the veiled tile where the board
 * will sit: the guide title for a beat (or until tapped), then the guide body
 * with the step's one action.
 */
export function KingdomOpeningCaption({ step, bottomInset, onLookCloser }: {
  step: FtueStepDefinition;
  bottomInset: number;
  onLookCloser: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState<0 | 1>(0);
  useEffect(() => {
    if (page === 1) return;
    const timer = setTimeout(() => setPage(1), reduceMotion ? 1_200 : OPENING_CAPTION_PAGE_MS);
    return () => clearTimeout(timer);
  }, [page, reduceMotion]);
  const action = step.actions[0];
  const fadeIn = FadeIn.duration(reduceMotion ? 80 : 520);
  return <View pointerEvents="box-none" style={[styles.layer, { bottom: bottomInset + 22 }]}>
    <Pressable
      accessibilityHint={page === 0 ? 'Shows the next line' : undefined}
      accessibilityLabel={page === 0 ? step.guide.title : step.guide.body}
      accessibilityRole="text"
      disabled={page === 1}
      onPress={() => setPage(1)}
      style={styles.caption}>
      {/* Stretched: the hero title fits its font to the panel only when the panel owns the full caption width. */}
      {page === 0
        ? <Animated.View key="noticed" entering={fadeIn} style={styles.page}>
          <FtueGuideCopy guide={{ eyebrow: step.guide.eyebrow, title: step.guide.title, body: '' }} hero />
        </Animated.View>
        : <Animated.View key="arrived" entering={fadeIn} style={styles.page}>
          <FtueGuideCopy guide={{ eyebrow: step.guide.eyebrow, title: step.guide.body, body: '' }} hero />
        </Animated.View>}
    </Pressable>
    <View pointerEvents="box-none" style={styles.buttonSlot}>
      {page === 1 ? <Animated.View entering={FadeIn.delay(reduceMotion ? 0 : 320).duration(reduceMotion ? 80 : 420)} style={styles.button}>
        <KatchaButton fullWidth glow icon={action?.icon ?? 'sparkles'} label={action?.title ?? 'Look closer'} onPress={onLookCloser} />
      </Animated.View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, gap: 14, zIndex: FTUE_SCENE_LAYERS.hero },
  // Reserve the button row from the first caption so the panel does not jump when it arrives.
  buttonSlot: { alignSelf: 'center', maxWidth: 430, width: '100%', minHeight: 56, justifyContent: 'flex-end' },
  caption: { alignItems: 'stretch', alignSelf: 'center', maxWidth: 430, width: '100%' },
  page: { alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  button: { alignSelf: 'center', maxWidth: 430, width: '100%' },
});
