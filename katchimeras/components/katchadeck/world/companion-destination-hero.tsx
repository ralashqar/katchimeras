import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';

export function CompanionDestinationHero({
  body,
  creature,
  name,
  title,
}: {
  body: string;
  creature: QuestionnaireImageSource;
  name: string;
  title: string;
}) {
  const reduceMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const compact = height < 735;

  return (
    <View
      accessibilityLabel={`${name} says: ${title} ${body}`}
      style={[styles.root, compact && styles.rootCompact]}>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeInLeft.duration(240)}
        style={[styles.bubble, compact && styles.bubbleCompact]}>
        <View style={styles.bubbleKicker}>
          <IconSymbol color="#6F8A46" name="sparkles" size={12} />
          <ThemedText style={styles.kicker} lightColor="#7B622A" darkColor="#7B622A">
            {name}
          </ThemedText>
        </View>
        <ThemedText
          maxFontSizeMultiplier={1.25}
          selectable
          style={[styles.title, compact && styles.titleCompact]}
          lightColor="#35261B"
          darkColor="#35261B">
          {title}
        </ThemedText>
        <ThemedText
          maxFontSizeMultiplier={1.25}
          numberOfLines={3}
          selectable
          style={styles.body}
          lightColor="#66513E"
          darkColor="#66513E">
          {body}
        </ThemedText>
        <View style={styles.tail} />
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeInRight.delay(45).duration(260)}
        pointerEvents="none"
        style={[styles.creatureFrame, compact && styles.creatureFrameCompact]}>
        <Image
          accessibilityLabel={name}
          contentFit="contain"
          source={creature}
          style={styles.creature}
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 244,
    position: 'relative',
  },
  rootCompact: {
    minHeight: 202,
  },
  bubble: {
    backgroundColor: 'rgba(255,249,233,0.96)',
    borderColor: 'rgba(255,255,255,0.72)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 13px 30px rgba(32,43,29,0.24), inset 0 1px 0 rgba(255,255,255,0.92)',
    gap: 7,
    left: 0,
    maxWidth: 290,
    paddingBottom: 21,
    paddingHorizontal: 21,
    paddingTop: 17,
    position: 'absolute',
    top: 20,
    width: '61%',
    zIndex: 2,
  },
  bubbleCompact: {
    borderRadius: 23,
    gap: 5,
    paddingBottom: 16,
    paddingHorizontal: 17,
    paddingTop: 13,
    top: 12,
    width: '64%',
  },
  bubbleKicker: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  kicker: {
    ...KatchaUI.type.label,
    fontSize: 9,
    letterSpacing: 1,
  },
  title: {
    ...KatchaUI.type.companionPageTitle,
    fontSize: 25,
    lineHeight: 29,
  },
  titleCompact: {
    fontSize: 21,
    lineHeight: 25,
  },
  body: {
    ...KatchaUI.type.companionBody,
    fontSize: 12.5,
    lineHeight: 18,
  },
  tail: {
    backgroundColor: 'rgba(255,249,233,0.96)',
    bottom: 17,
    height: 25,
    position: 'absolute',
    right: -11,
    transform: [{ rotate: '45deg' }],
    width: 25,
    zIndex: -1,
  },
  creatureFrame: {
    bottom: -3,
    height: 244,
    position: 'absolute',
    right: -18,
    width: '52%',
    zIndex: 3,
  },
  creatureFrameCompact: {
    height: 202,
    right: -14,
    width: '48%',
  },
  creature: {
    height: '100%',
    width: '100%',
  },
});
