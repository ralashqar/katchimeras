import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { VeilMascot } from '@/components/katchadeck/veil-mascot';
import { presenceEnter, rewardEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(227,160,110,0.14)"
        colors={['#0B0D16', '#17152A', '#1E1832']}
        meshColors={['rgba(200,216,255,0.12)', 'rgba(240,223,255,0.14)', 'rgba(255,216,192,0.14)', 'rgba(106,95,232,0.12)']}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={rewardEnter()} style={styles.hero}>
          <View style={styles.heroCopy}>
            <ThemedText type="label" style={styles.kicker} lightColor="#FFE7D7" darkColor="#FFE7D7">
              Premium preview
            </ThemedText>
            <ThemedText type="display" style={styles.title} lightColor="#FFF8F4" darkColor="#FFF8F4">
              Unlock the full version of your life.
            </ThemedText>
            <ThemedText type="bodyLarge" style={styles.body} lightColor="#F2E6E1" darkColor="#F2E6E1">
              Premium gives your deck deeper identity reads, story-comic moments, evolved variants,
              and the richer sense that your life is building into something distinct.
            </ThemedText>
          </View>
          <VeilMascot glow mood="bright" size={116} variant="guide" />
        </Animated.View>

        <Animated.View entering={presenceEnter(120)}>
          <GlassPanel
            contentStyle={styles.panel}
            fillColor="rgba(255, 239, 231, 0.08)"
            gradientColors={['rgba(221,232,255,0.14)', 'rgba(240,223,255,0.12)', 'rgba(255,216,192,0.08)']}>
            <FeatureRow title="Enhanced variants" body="See stronger forms of the creatures shaped by your repeated places and rituals." />
            <FeatureRow title="Story + comic moments" body="Turn standout days into illustrated memory fragments worth revisiting." />
            <FeatureRow title="Deeper identity insight" body="Get more articulate reflections about who you are becoming over time." />
            <FeatureRow title="Evolution + fusion" body="Let familiar routes and patterns combine into rarer long-form deck growth." />
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(220)}>
          <GlassPanel contentStyle={styles.subpanel}>
            <ThemedText type="label" style={styles.subpanelLabel} lightColor="#FFE7D7" darkColor="#FFE7D7">
              Placeholder paywall
            </ThemedText>
            <ThemedText style={styles.subpanelBody} lightColor="#F2E6E1" darkColor="#F2E6E1">
              Billing is not wired yet. This screen exists to validate tone, premium positioning, and
              future upgrade placement.
            </ThemedText>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={presenceEnter(280)} style={styles.ctaRow}>
          <KatchaButton disabled label="Premium coming soon" variant="premium" />
          <KatchaButton label="Back to reveal" onPress={() => router.back()} variant="secondary" />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FeatureRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureDot} />
      <View style={styles.featureCopy}>
        <ThemedText type="subtitle" style={styles.featureTitle} lightColor="#FFF8F4" darkColor="#FFF8F4">
          {title}
        </ThemedText>
        <ThemedText style={styles.featureBody} lightColor="#F2E6E1" darkColor="#F2E6E1">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  container: {
    gap: KatchaDeckUI.spacing.lg,
    justifyContent: 'center',
    minHeight: '100%',
    padding: 24,
  },
  hero: {
    gap: 18,
  },
  heroCopy: {
    gap: 12,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 46,
    lineHeight: 48,
  },
  body: {
    maxWidth: 340,
  },
  panel: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  featureDot: {
    backgroundColor: '#FFD6B6',
    borderRadius: 999,
    height: 9,
    marginTop: 8,
    width: 9,
  },
  featureCopy: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 20,
  },
  featureBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  subpanel: {
    gap: 10,
  },
  subpanelLabel: {
    fontSize: 11,
  },
  subpanelBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  ctaRow: {
    gap: 10,
  },
});
