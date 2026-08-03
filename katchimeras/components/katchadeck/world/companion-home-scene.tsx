import * as Haptics from 'expo-haptics';
import { type ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionDestination } from '@/types/companion-interaction';
import type { HomeVisualKey } from '@/types/home';
import type { CompanionBondProgress } from '@/utils/companion-bond';
import type { CompanionDailyInvitation } from '@/utils/companion-content';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';

import { CompanionCinematicStage } from './companion-cinematic-stage';

type HomePath = {
  destination: 'quest' | 'discovery' | 'goals';
  description: string;
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  status: string;
};

export function CompanionHomeScene({
  animateEntrance = true,
  bondProgress,
  creature,
  dailyInvitation,
  environmentKey,
  goalStatus,
  name,
  onClose,
  onOpenDailyInvitation,
  onSkipDailyInvitation,
  onSelectDestination,
  questStatus,
  showSkins,
  visualKey,
  youStatus,
}: {
  animateEntrance?: boolean;
  bondProgress: CompanionBondProgress;
  creature: QuestionnaireImageSource;
  dailyInvitation: CompanionDailyInvitation | null;
  environmentKey: TodayExplorationBackgroundKey | null;
  goalStatus: string;
  name: string;
  onClose: () => void;
  onOpenDailyInvitation: () => void;
  onSkipDailyInvitation: () => void;
  onSelectDestination: (destination: CompanionDestination) => void;
  questStatus: string;
  showSkins: boolean;
  visualKey: HomeVisualKey;
  youStatus: string;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { fontScale, height, width } = useWindowDimensions();
  const compact = height < 735;
  const reflowPaths = width < 375 || fontScale > 1.15;
  const tablet = width >= 700;
  const heroHeight = compact
    ? Math.max(214, Math.min(252, height * 0.4))
    : Math.min(336, Math.max(286, height * 0.39));
  const shouldAnimate = animateEntrance && !reduceMotion;
  const paths: HomePath[] = [
    {
      destination: 'quest',
      description: 'Grow, explore, achieve',
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
      description: 'Small steps, big change',
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
      <CompanionCinematicStage
        creature={creature}
        enterFromLifted={!animateEntrance}
        environmentKey={environmentKey}
        lifted={false}
        name={name}
        title="Where shall we begin today?"
        visualKey={visualKey}
      />

      <ScrollView
        bounces={false}
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
        scrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        <View style={styles.topBar}>
          <KatchimeraBackButton
            accessibilityLabel="Back to Katchimeras"
            onPress={onClose}
          />
          <ThemedText
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            selectable
            style={styles.topBarTitle}
            lightColor="#FFD36E"
            darkColor="#FFD36E">
            {name}
          </ThemedText>
          <View accessibilityElementsHidden pointerEvents="none" style={styles.topBarBalance} />
        </View>

        <View style={[styles.hero, { minHeight: heroHeight }]} />

        {dailyInvitation ? (
          <Animated.View
            entering={shouldAnimate ? FadeInUp.delay(70).duration(260) : undefined}
            style={styles.invitationWrap}>
            <Pressable
              accessibilityHint="Opens today's single invitation"
              accessibilityLabel={`${dailyInvitation.title}. ${dailyInvitation.body}`}
              accessibilityRole="button"
              onPress={onOpenDailyInvitation}
              style={({ pressed }) => [styles.invitationCard, pressed && styles.pathCardPressed]}>
              <View style={styles.invitationIcon}>
                <IconSymbol
                  color="#FFF7DF"
                  name={dailyInvitation.destination === 'quest' ? 'sparkles' : 'bubble.left.fill'}
                  size={23}
                />
              </View>
              <View style={styles.invitationCopy}>
                <ThemedText style={styles.invitationEyebrow} lightColor="#8B5C17" darkColor="#8B5C17">
                  TODAY’S INVITATION
                </ThemedText>
                <ThemedText style={styles.invitationTitle} lightColor="#302116" darkColor="#302116">
                  {dailyInvitation.title}
                </ThemedText>
                <ThemedText numberOfLines={2} style={styles.invitationBody} lightColor="#65513D" darkColor="#65513D">
                  {dailyInvitation.body}
                </ThemedText>
              </View>
              <View style={styles.pathArrow}>
                <IconSymbol color="#5B411F" name="arrow.right" size={17} />
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel="Leave this invitation for today"
              accessibilityRole="button"
              onPress={onSkipDailyInvitation}
              style={({ pressed }) => [styles.invitationSkip, pressed && styles.pressed]}>
              <ThemedText style={styles.invitationSkipLabel} lightColor="#6E5738" darkColor="#6E5738">
                Not today
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={
            shouldAnimate
              ? FadeInUp.delay(100).duration(260)
              : animateEntrance
                ? FadeIn.duration(80)
                : undefined
          }
          style={[styles.paths, reflowPaths && styles.pathsReflow]}>
          {paths.map((path, index) => (
            <CompanionPathCard
              featured={reflowPaths && index === 0}
              key={path.destination}
              onPress={() => select(path.destination)}
              path={path}
              reflow={reflowPaths}
            />
          ))}
        </Animated.View>

        <Animated.View
          entering={
            shouldAnimate
              ? FadeInUp.delay(160).duration(240)
              : animateEntrance
                ? FadeIn.duration(80)
                : undefined
          }
          style={styles.utilityRow}>
          <UtilityAction icon="star.fill" label="Insight" onPress={() => select('insight')} />
          {showSkins ? (
            <UtilityAction icon="circle.grid.2x2.fill" label="Skins" onPress={() => select('skins')} />
          ) : null}
        </Animated.View>

        <Animated.View
          entering={
            shouldAnimate
              ? FadeInUp.delay(210).duration(240)
              : animateEntrance
                ? FadeIn.duration(80)
                : undefined
          }
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
              <View
                style={[
                  styles.bondFill,
                  { width: `${Math.max(4, bondProgress.ratio * 100)}%` },
                ]}
              />
            </View>
            <ThemedText
              numberOfLines={1}
              style={styles.bondHint}
              lightColor="#EEE4D3"
              darkColor="#EEE4D3">
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
  featured,
  onPress,
  path,
  reflow,
}: {
  featured: boolean;
  onPress: () => void;
  path: HomePath;
  reflow: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={path.description}
      accessibilityLabel={`${path.label}. ${path.status}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pathCard,
        reflow && styles.pathCardReflow,
        featured && styles.pathCardFeatured,
        path.destination === 'quest' && styles.pathCardQuest,
        pressed && styles.pathCardPressed,
      ]}>
      <View style={[styles.pathIcon, path.destination === 'quest' && styles.pathIconQuest]}>
        <IconSymbol
          color={path.destination === 'quest' ? '#6D4718' : '#5F533A'}
          name={path.icon}
          size={featured ? 30 : 27}
        />
      </View>
      <View style={[styles.pathCopy, featured && styles.pathCopyFeatured]}>
        <ThemedText style={styles.pathTitle} lightColor="#372719" darkColor="#372719">
          {path.label}
        </ThemedText>
        <ThemedText
          numberOfLines={featured ? 1 : 2}
          style={[styles.pathDescription, featured && styles.pathTextFeatured]}
          lightColor="#65513D"
          darkColor="#65513D">
          {path.description}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          style={[styles.pathStatus, featured && styles.pathTextFeatured]}
          lightColor="#765526"
          darkColor="#765526">
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
      <IconSymbol color="#6F522A" name={icon} size={17} />
      <ThemedText style={styles.utilityLabel} lightColor="#493420" darkColor="#493420">
        {label}
      </ThemedText>
      <IconSymbol color="#876A45" name="chevron.right" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  scroll: {
    zIndex: 3,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 12,
    position: 'relative',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
    position: 'relative',
    zIndex: 4,
  },
  topBarTitle: {
    ...KatchaUI.type.companionName,
    flex: 1,
    paddingHorizontal: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(30,48,53,0.88)',
    textShadowOffset: { height: 3, width: 0 },
    textShadowRadius: 4,
  },
  topBarBalance: {
    height: 44,
    width: 44,
  },
  hero: {
    position: 'relative',
  },
  paths: {
    flexDirection: 'row',
    gap: 9,
    position: 'relative',
    zIndex: 4,
  },
  invitationWrap: {
    gap: 5,
    position: 'relative',
    zIndex: 5,
  },
  invitationCard: {
    alignItems: 'center',
    backgroundColor: '#FFF1C8',
    borderColor: 'rgba(188,126,28,0.48)',
    borderCurve: 'continuous',
    borderRadius: 23,
    borderWidth: 1.5,
    boxShadow: '0 12px 28px rgba(94,58,18,0.24), inset 0 1px 0 rgba(255,255,255,0.96)',
    flexDirection: 'row',
    gap: 12,
    minHeight: 102,
    padding: 14,
  },
  invitationIcon: {
    alignItems: 'center',
    backgroundColor: '#A86E20',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  invitationCopy: {
    flex: 1,
    gap: 2,
  },
  invitationEyebrow: {
    ...KatchaUI.type.meta,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  invitationTitle: {
    ...KatchaUI.type.companionCardTitle,
    fontSize: 17,
  },
  invitationBody: {
    ...KatchaUI.type.companionBody,
    fontSize: 10.5,
    lineHeight: 14,
  },
  invitationSkip: {
    alignSelf: 'flex-end',
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  invitationSkipLabel: {
    ...KatchaUI.type.meta,
    fontSize: 10,
    fontWeight: '800',
  },
  pathsReflow: {
    flexWrap: 'wrap',
  },
  pathCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7E4',
    borderColor: 'rgba(105,75,39,0.24)',
    borderCurve: 'continuous',
    borderRadius: 23,
    borderWidth: 1,
    boxShadow:
      '0 10px 24px rgba(79,52,25,0.20), inset 0 1px 0 rgba(255,255,255,0.94)',
    flex: 1,
    gap: 7,
    minHeight: 164,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  pathCardQuest: {
    borderColor: 'rgba(205,149,40,0.80)',
    borderWidth: 1.5,
    boxShadow:
      '0 11px 26px rgba(113,73,24,0.24), inset 0 1px 0 rgba(255,255,255,0.96)',
  },
  pathCardReflow: {
    flexBasis: '45%',
    minHeight: 122,
  },
  pathCardFeatured: {
    flexBasis: '100%',
    flexDirection: 'row',
    minHeight: 94,
    paddingHorizontal: 16,
  },
  pathCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  pathIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(199,186,123,0.24)',
    borderColor: 'rgba(102,76,43,0.10)',
    borderRadius: 17,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pathIconQuest: {
    backgroundColor: 'rgba(238,186,66,0.30)',
  },
  pathCopy: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  pathCopyFeatured: {
    alignItems: 'flex-start',
  },
  pathTitle: {
    ...KatchaUI.type.companionCardTitle,
    textAlign: 'center',
  },
  pathDescription: {
    ...KatchaUI.type.companionBody,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  pathStatus: {
    ...KatchaUI.type.meta,
    fontSize: 9.5,
    fontWeight: '800',
    paddingTop: 2,
    textAlign: 'center',
  },
  pathTextFeatured: {
    textAlign: 'left',
  },
  pathArrow: {
    alignItems: 'center',
    backgroundColor: '#E9C46B',
    borderColor: 'rgba(107,73,27,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    height: 31,
    justifyContent: 'center',
    width: 31,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 9,
    position: 'relative',
    zIndex: 4,
  },
  utilityAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,246,224,0.74)',
    borderColor: 'rgba(105,75,39,0.18)',
    borderRadius: 16,
    borderWidth: 1,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  utilityLabel: {
    ...KatchaUI.type.companionAction,
    flex: 1,
    fontSize: 12,
  },
  bondCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(35,32,25,0.88)',
    borderColor: 'rgba(255,226,145,0.28)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    boxShadow:
      '0 8px 20px rgba(55,36,18,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    padding: 10,
    position: 'relative',
    zIndex: 4,
  },
  bondHeart: {
    alignItems: 'center',
    backgroundColor: '#9A6B23',
    borderRadius: 999,
    height: 45,
    justifyContent: 'center',
    width: 45,
  },
  bondCopy: {
    flex: 1,
    gap: 5,
  },
  bondHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bondTitle: {
    ...KatchaUI.type.companionAction,
    fontSize: 11.5,
  },
  bondValue: {
    ...KatchaUI.type.numeric,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  bondTrack: {
    backgroundColor: 'rgba(255,248,224,0.18)',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
  },
  bondFill: {
    backgroundColor: '#E7B94F',
    borderRadius: 999,
    height: '100%',
  },
  bondHint: {
    ...KatchaUI.type.meta,
    fontSize: 9.5,
    lineHeight: 13,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
