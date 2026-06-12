import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { encounterCastByProfileId } from '@/constants/encounter-cast';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import type { StoredHomeState } from '@/types/home';
import { hydrateHomeState } from '@/utils/home-engine';
import { loadStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

const auroraRing = require('../../assets/images/katchimeras/aurora-ring.png');

type MetCharacter = {
  profileId: string;
  name: string;
  count: number;
  visualSource: ReturnType<typeof resolveVisualSource>;
};

function resolveVisualSource(profileId: string) {
  const castEntry = encounterCastByProfileId.get(profileId);
  return castEntry ? homeCreatureVisuals[castEntry.visualKey].source : null;
}

function buildMetCharacters(state: StoredHomeState): MetCharacter[] {
  return Object.entries(state.encounterHistory)
    .map(([profileId, entry]) => {
      const castEntry = encounterCastByProfileId.get(profileId);
      if (!castEntry) {
        return null;
      }
      const name = profileId.split('_').slice(-1)[0];
      return {
        profileId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: entry.count,
        visualSource: resolveVisualSource(profileId),
      };
    })
    .filter((entry): entry is MetCharacter => entry !== null)
    .sort((left, right) => right.count - left.count);
}

export default function CollectionScreen() {
  const [state, setState] = useState<StoredHomeState | null>(null);

  useFocusEffect(
    useCallback(() => {
      const profile = loadOnboardingProfile();
      const hydrated = hydrateHomeState(loadStoredHomeState(), profile, new Date());
      setState(hydrated.state);
    }, [])
  );

  const met = state ? buildMetCharacters(state) : [];
  const hatchedDays = state
    ? [...state.archivedDays, state.today].filter((day) => day.creature !== null)
    : [];
  const deepest = met[0] ?? null;

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(167,139,250,0.14)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.12)', 'rgba(125,232,205,0.08)', 'rgba(255,195,107,0.08)', 'rgba(20,17,31,0.2)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Your collection
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            The days you kept.
          </ThemedText>
          <ThemedText style={styles.subtitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {hatchedDays.length} {hatchedDays.length === 1 ? 'day' : 'days'} hatched · {met.length}{' '}
            {met.length === 1 ? 'character' : 'characters'} met
          </ThemedText>
        </Animated.View>

        {met.length > 0 ? (
          <Animated.View entering={presenceEnter(80)} style={styles.grid}>
            {met.map((character) => (
              <View key={character.profileId} style={styles.gridItem}>
                <View style={styles.orb}>
                  <Image contentFit="contain" source={auroraRing} style={StyleSheet.absoluteFill} transition={0} />
                  {character.visualSource ? (
                    <Image contentFit="contain" source={character.visualSource} style={styles.orbImage} transition={0} />
                  ) : null}
                </View>
                <ThemedText style={styles.orbName} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {character.name}
                </ThemedText>
                <ThemedText style={styles.orbCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {character.count} {character.count === 1 ? 'visit' : 'visits'}
                </ThemedText>
              </View>
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={presenceEnter(80)}>
            <GlassPanel contentStyle={styles.emptyPanel}>
              <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Still forming
              </ThemedText>
              <ThemedText style={styles.emptyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                Your first hatches will gather here. Live a day, reveal it tonight, and the collection
                begins itself.
              </ThemedText>
            </GlassPanel>
          </Animated.View>
        )}

        {deepest && deepest.visualSource ? (
          <Animated.View entering={presenceEnter(160)}>
            <GlassPanel contentStyle={styles.bondPanel} fillColor={Lantern.ink800}>
              <View style={styles.bondPortrait}>
                <Image contentFit="contain" source={deepest.visualSource} style={styles.bondImage} transition={0} />
              </View>
              <View style={styles.bondCopy}>
                <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                  Deepest bond
                </ThemedText>
                <ThemedText style={styles.bondName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {deepest.name} · {deepest.count} {deepest.count === 1 ? 'visit' : 'visits'}
                </ThemedText>
              </View>
            </GlassPanel>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  content: {
    gap: KatchaDeckUI.spacing.lg,
    paddingBottom: 140,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'flex-start',
  },
  gridItem: {
    alignItems: 'center',
    width: 96,
  },
  orb: {
    alignItems: 'center',
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  orbImage: {
    height: 62,
    width: 62,
  },
  orbName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  orbCount: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyPanel: {
    gap: 8,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  bondPanel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  bondPortrait: {
    height: 64,
    width: 64,
  },
  bondImage: {
    height: '100%',
    width: '100%',
  },
  bondCopy: {
    gap: 4,
  },
  bondName: {
    fontSize: 16,
    fontWeight: '700',
  },
});
