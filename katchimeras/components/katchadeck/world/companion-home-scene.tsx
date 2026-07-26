import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionDestination } from '@/types/companion-interaction';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';

type HomePath = {
  destination: 'quest' | 'discovery' | 'goals';
  description: string;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  status: string;
};

export function CompanionHomeScene({
  bondProgress,
  creature,
  goalStatus,
  name,
  onClose,
  onSelectDestination,
  openingLine,
  questStatus,
  showSkins,
  youStatus,
}: {
  bondProgress: CompanionBondProgress;
  creature: QuestionnaireImageSource;
  goalStatus: string;
  name: string;
  onClose: () => void;
  onSelectDestination: (destination: CompanionDestination) => void;
  openingLine: string;
  questStatus: string;
  showSkins: boolean;
  youStatus: string;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const compact = height < 735;
  const tablet = width >= 700;
  const paths: HomePath[] = [
    {
      destination: 'quest',
      description: 'Explore, notice, achieve',
      icon: 'list.clipboard.fill',
      label: 'Quests',
      status: questStatus,
    },
    {
      destination: 'discovery',
      description: 'Reflect, answer, learn',
      icon: 'bubble.left.and.bubble.right.fill',
      label: 'You',
      status: youStatus,
    },
    {
      destination: 'goals',
      description: 'Small steps for today',
      icon: 'scope',
      label: 'Goals',
      status: goalStatus,
    },
  ];

  const select = (destination: CompanionDestination) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    onSelectDestination(destination);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(19,37,42,0.08)', 'rgba(18,34,30,0.02)', 'rgba(13,25,21,0.50)']}
        locations={[0, 0.5, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        bounces={!compact}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: height,
            paddingBottom: insets.bottom + 22,
            paddingHorizontal: tablet ? Math.max(28, (width - 720) / 2) : 20,
            paddingTop: insets.top + 12,
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to Kingdom"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <IconSymbol color="#3D2A1D" name="chevron.left" size={23} />
          </Pressable>
          <View style={styles.identityChip}>
            <ThemedText style={styles.identityText} lightColor="#FFF9EA" darkColor="#FFF9EA">
              Today with {name}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(80) : FadeInDown.duration(240)}
            style={styles.heroCopy}>
            <ThemedText
              maxFontSizeMultiplier={1.3}
              selectable
              style={[styles.title, compact && styles.titleCompact]}
              lightColor="#342317"
              darkColor="#342317">
              Where shall we begin today?
            </ThemedText>
            <ThemedText
              maxFontSizeMultiplier={1.25}
              numberOfLines={3}
              selectable
              style={styles.openingLine}
              lightColor="#4D3828"
              darkColor="#4D3828">
              {openingLine}
            </ThemedText>
          </Animated.View>
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(70).duration(270)}
            pointerEvents="none"
            style={[styles.creatureFrame, compact && styles.creatureFrameCompact]}>
            <Image
              accessibilityLabel={`${name}, your Katchimera`}
              contentFit="contain"
              source={creature}
              style={styles.creature}
              transition={0}
            />
          </Animated.View>
        </View>

        <Animated.View
          entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(120).duration(240)}
          style={[styles.paths, compact && styles.pathsCompact]}>
          {paths.map((path, index) => (
            <CompanionPathCard
              compact={compact}
              featured={compact && index === 0}
              key={path.destination}
              onPress={() => select(path.destination)}
              path={path}
            />
          ))}
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(180).duration(230)}
          style={styles.utilityRow}>
          <UtilityAction icon="star.fill" label="Insight" onPress={() => select('insight')} />
          {showSkins ? (
            <UtilityAction icon="circle.grid.2x2.fill" label="Skins" onPress={() => select('skins')} />
          ) : null}
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.delay(220).duration(230)}
          style={styles.bondCard}>
          <View style={styles.bondHeart}>
            <IconSymbol color="#FFF6DD" name="heart.fill" size={23} />
          </View>
          <View style={styles.bondCopy}>
            <View style={styles.bondHeading}>
              <ThemedText style={styles.bondTitle} lightColor="#FFF9EA" darkColor="#FFF9EA">
                Bond level {bondProgress.level}
              </ThemedText>
              <ThemedText style={styles.bondValue} lightColor="#F6DE9A" darkColor="#F6DE9A">
                {bondProgress.isMax
                  ? 'Max'
                  : `${bondProgress.segmentPoints}/${bondProgress.segmentTarget}`}
              </ThemedText>
            </View>
            <View style={styles.bondTrack}>
              <View style={[styles.bondFill, { width: `${Math.max(4, bondProgress.ratio * 100)}%` }]} />
            </View>
            <ThemedText numberOfLines={1} style={styles.bondHint} lightColor="#EEE4D3" darkColor="#EEE4D3">
              {bondProgress.isMax
                ? `${name} trusts you completely.`
                : `${bondProgress.pointsRemaining} bond until ${bondProgress.nextLabel}.`}
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function CompanionPathCard({
  compact,
  featured,
  onPress,
  path,
}: {
  compact: boolean;
  featured: boolean;
  onPress: () => void;
  path: HomePath;
}) {
  return (
    <Pressable
      accessibilityHint={path.description}
      accessibilityLabel={`${path.label}. ${path.status}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pathCard,
        compact && styles.pathCardCompact,
        featured && styles.pathCardFeatured,
        path.destination === 'quest' && styles.pathCardQuest,
        pressed && styles.pathCardPressed,
      ]}>
      <View style={[styles.pathIcon, path.destination === 'quest' && styles.pathIconQuest]}>
        <IconSymbol color={path.destination === 'quest' ? '#6D4718' : '#5F533A'} name={path.icon} size={featured ? 28 : 25} />
      </View>
      <View style={styles.pathCopy}>
        <ThemedText style={styles.pathTitle} lightColor="#372719" darkColor="#372719">
          {path.label}
        </ThemedText>
        <ThemedText
          numberOfLines={compact ? 1 : 2}
          style={styles.pathDescription}
          lightColor="#65513D"
          darkColor="#65513D">
          {path.description}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.pathStatus} lightColor="#7A5B28" darkColor="#7A5B28">
          {path.status}
        </ThemedText>
      </View>
      <View style={styles.pathArrow}>
        <IconSymbol color="#5B411F" name="chevron.right" size={17} />
      </View>
    </Pressable>
  );
}

function UtilityAction({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.utilityAction, pressed && styles.pressed]}>
      <IconSymbol color="#FFF2C2" name={icon} size={17} />
      <ThemedText style={styles.utilityLabel} lightColor="#FFF9EA" darkColor="#FFF9EA">
        {label}
      </ThemedText>
      <IconSymbol color="#EAD9BB" name="chevron.right" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, gap: 13 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,235,0.94)',
    borderColor: 'rgba(91,61,30,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 5px 15px rgba(42,29,17,0.24), inset 0 1px 0 rgba(255,255,255,0.92)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  identityChip: {
    backgroundColor: 'rgba(25,31,23,0.72)',
    borderColor: 'rgba(255,244,211,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  identityText: { ...KatchaUI.type.companionAction, fontSize: 11.5 },
  hero: { minHeight: 270, position: 'relative' },
  heroCompact: { minHeight: 210 },
  heroCopy: { gap: 8, paddingTop: 30, width: '53%', zIndex: 2 },
  title: {
    ...KatchaUI.type.companionDisplay,
    textShadowColor: 'rgba(255,250,230,0.74)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 7,
  },
  titleCompact: { fontSize: 28, lineHeight: 31 },
  openingLine: {
    ...KatchaUI.type.companionBody,
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(255,250,230,0.78)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 5,
  },
  creatureFrame: { bottom: -12, height: 300, position: 'absolute', right: -22, width: '58%', zIndex: 3 },
  creatureFrameCompact: { bottom: -10, height: 235, right: -16, width: '54%' },
  creature: { height: '100%', width: '100%' },
  paths: { flexDirection: 'row', gap: 9, zIndex: 4 },
  pathsCompact: { flexWrap: 'wrap' },
  pathCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,230,0.94)',
    borderColor: 'rgba(105,75,39,0.24)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 9px 24px rgba(43,31,18,0.22), inset 0 1px 0 rgba(255,255,255,0.92)',
    flex: 1,
    gap: 7,
    minHeight: 172,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  pathCardQuest: { borderColor: 'rgba(213,159,48,0.72)', borderWidth: 1.5 },
  pathCardCompact: { flexBasis: '46%', minHeight: 102, paddingVertical: 10 },
  pathCardFeatured: {
    flexBasis: '100%',
    flexDirection: 'row',
    minHeight: 88,
    paddingHorizontal: 15,
  },
  pathCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  pathIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(199,186,123,0.24)',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pathIconQuest: { backgroundColor: 'rgba(238,186,66,0.30)' },
  pathCopy: { alignItems: 'center', flex: 1, gap: 2, justifyContent: 'center' },
  pathTitle: { ...KatchaUI.type.companionCardTitle, textAlign: 'center' },
  pathDescription: { ...KatchaUI.type.companionBody, fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
  pathStatus: { ...KatchaUI.type.meta, fontSize: 9.5, fontWeight: '800', paddingTop: 2, textAlign: 'center' },
  pathArrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(226,184,84,0.46)',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  utilityRow: { flexDirection: 'row', gap: 9 },
  utilityAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(24,29,23,0.72)',
    borderColor: 'rgba(255,244,211,0.22)',
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.11)',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  utilityLabel: { ...KatchaUI.type.companionAction, flex: 1, fontSize: 12 },
  bondCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(24,29,23,0.82)',
    borderColor: 'rgba(255,226,145,0.26)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 8px 20px rgba(21,26,20,0.24), inset 0 1px 0 rgba(255,255,255,0.12)',
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    padding: 10,
  },
  bondHeart: { alignItems: 'center', backgroundColor: '#9A6B23', borderRadius: 999, height: 45, justifyContent: 'center', width: 45 },
  bondCopy: { flex: 1, gap: 5 },
  bondHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bondTitle: { ...KatchaUI.type.companionAction, fontSize: 11.5 },
  bondValue: { ...KatchaUI.type.numeric, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  bondTrack: { backgroundColor: 'rgba(255,248,224,0.18)', borderRadius: 999, height: 6, overflow: 'hidden' },
  bondFill: { backgroundColor: '#E7B94F', borderRadius: 999, height: '100%' },
  bondHint: { ...KatchaUI.type.meta, fontSize: 9.5, lineHeight: 13 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
