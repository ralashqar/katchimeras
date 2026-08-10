import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionVisitPlan, CompanionVisitResponse } from '@/types/companion-interaction';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import { companionHomeHeroSpacer } from '@/utils/companion-home-layout';

export function CompanionVisitScene({
  bondProgress,
  completed,
  completionKind,
  memoryCount,
  name,
  onClose,
  onOpenHistory,
  onOpenMore,
  onRespond,
  plan,
}: {
  bondProgress: CompanionBondProgress;
  completed: boolean;
  completionKind: 'remembered' | 'answered' | 'deferred' | 'quiet';
  memoryCount: number;
  name: string;
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenMore: () => void;
  onRespond: (response: CompanionVisitResponse) => void;
  plan: CompanionVisitPlan;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const tablet = width >= 700;
  const primaryResponses = plan.responses.filter((response) => response.action !== 'defer' && response.action !== 'say_more');
  const secondaryResponses = plan.responses.filter((response) => response.action === 'defer' || response.action === 'say_more');
  const respond = (response: CompanionVisitResponse) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onRespond(response);
  };

  return (
    <ScrollView
      bounces={false}
      contentContainerStyle={[
        styles.content,
        {
          minHeight: height,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: tablet ? Math.max(28, (width - 720) / 2) : 20,
          paddingTop: insets.top + 12,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <KatchimeraBackButton accessibilityLabel="Back to Katchimeras" onPress={onClose} />
        <ThemedText
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          selectable
          style={styles.name}
          lightColor="#FFD36E"
          darkColor="#FFD36E">
          {name}
        </ThemedText>
        <Pressable
          accessibilityLabel="More companion activities"
          accessibilityRole="button"
          onPress={onOpenMore}
          style={({ pressed }) => [styles.topAction, pressed && styles.pressed]}>
          <IconSymbol color="#FFF4D1" name="ellipsis" size={22} weight="bold" />
        </Pressable>
      </View>

      <View accessibilityElementsHidden pointerEvents="none" style={{ minHeight: companionHomeHeroSpacer(height) }} />

      <Animated.View
        entering={reduceMotion ? undefined : FadeInUp.duration(240)}
        style={styles.panel}>
        <View style={styles.eyebrowRow}>
          <ThemedText selectable style={styles.eyebrow} lightColor="#806126" darkColor="#806126">
            {completed ? 'VISIT COMPLETE' : plan.eyebrow}
          </ThemedText>
          <View style={styles.bondPill}>
            <IconSymbol color="#A16A45" name="heart.fill" size={12} />
            <ThemedText style={styles.bondLabel} lightColor="#6B4B2C" darkColor="#6B4B2C">
              {bondProgress.label}
            </ThemedText>
          </View>
        </View>

        {plan.helperText ? (
          <ThemedText selectable style={styles.helper} lightColor="#6E5B48" darkColor="#6E5B48">
            {plan.helperText}
          </ThemedText>
        ) : null}

        {!completed ? (
          <View accessibilityRole="radiogroup" style={styles.responses}>
            {primaryResponses.map((response, index) => (
              <Pressable
                accessibilityRole="button"
                key={response.id}
                onPress={() => respond(response)}
                style={({ pressed }) => [
                  styles.response,
                  index === 0 && styles.responsePrimary,
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  selectable
                  style={styles.responseLabel}
                  lightColor="#3B2C20"
                  darkColor="#3B2C20">
                  {response.label}
                </ThemedText>
                <IconSymbol color="#806040" name="chevron.right" size={15} />
              </Pressable>
            ))}
            {secondaryResponses.length ? (
              <View style={styles.secondaryResponses}>
                {secondaryResponses.map((response) => (
                  <Pressable
                    accessibilityRole="button"
                    key={response.id}
                    onPress={() => respond(response)}
                    style={({ pressed }) => [styles.secondaryResponse, pressed && styles.pressed]}>
                    <ThemedText style={styles.secondaryLabel} lightColor="#725A40" darkColor="#725A40">
                      {response.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.keptRow}>
            <View style={styles.keptIcon}>
              <IconSymbol color="#FFF8E7" name="checkmark" size={17} weight="bold" />
            </View>
            <ThemedText selectable style={styles.keptText} lightColor="#5D4B37" darkColor="#5D4B37">
              {completionKind === 'deferred'
                ? 'Nothing was added to memory. You can return whenever it suits you.'
                : completionKind === 'quiet'
                  ? 'Thanks for staying a moment. No task was created.'
                  : completionKind === 'remembered'
                    ? 'This pattern is now part of your shared history.'
                    : 'That answer stays with this visit unless you explicitly choose to remember it.'}
            </ThemedText>
          </View>
        )}

        <View style={styles.utilityRow}>
          <Pressable
            accessibilityLabel={`Shared history, ${memoryCount} remembered items`}
            accessibilityRole="button"
            onPress={onOpenHistory}
            style={({ pressed }) => [styles.utility, pressed && styles.pressed]}>
            <IconSymbol color="#795A34" name="clock.arrow.circlepath" size={17} />
            <ThemedText style={styles.utilityLabel} lightColor="#4A3725" darkColor="#4A3725">
              Shared history
            </ThemedText>
            {memoryCount ? (
              <ThemedText style={styles.count} lightColor="#806126" darkColor="#806126">
                {memoryCount}
              </ThemedText>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenMore}
            style={({ pressed }) => [styles.utility, pressed && styles.pressed]}>
            <IconSymbol color="#795A34" name="square.grid.2x2.fill" size={17} />
            <ThemedText style={styles.utilityLabel} lightColor="#4A3725" darkColor="#4A3725">
              More
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 12, position: 'relative' },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 48, position: 'relative', zIndex: 4 },
  name: { ...KatchaUI.type.companionName, flex: 1, paddingHorizontal: 12, textAlign: 'center' },
  topAction: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  panel: {
    backgroundColor: KatchaUI.companionPanel.background,
    borderColor: KatchaUI.companionPanel.border,
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: KatchaUI.companionPanel.shadow,
    gap: 14,
    padding: 16,
  },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.25 },
  bondPill: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.48)', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  bondLabel: { fontSize: 11, fontWeight: '800' },
  helper: { fontSize: 14, lineHeight: 20 },
  responses: { gap: 9 },
  response: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderColor: 'rgba(109,78,43,0.14)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  responsePrimary: { backgroundColor: '#FFF5D8', borderColor: 'rgba(168,117,47,0.28)' },
  responseLabel: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  secondaryResponses: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingTop: 2 },
  secondaryResponse: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryLabel: { fontSize: 12, fontWeight: '800' },
  keptRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.48)', borderRadius: 18, flexDirection: 'row', gap: 11, padding: 13 },
  keptIcon: { alignItems: 'center', backgroundColor: '#75A987', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  keptText: { flex: 1, fontSize: 13, lineHeight: 18 },
  utilityRow: { flexDirection: 'row', gap: 8 },
  utility: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 16, flex: 1, flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 11 },
  utilityLabel: { flex: 1, fontSize: 12, fontWeight: '800' },
  count: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
