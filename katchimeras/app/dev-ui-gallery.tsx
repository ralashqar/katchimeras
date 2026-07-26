import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionTile } from '@/components/katchadeck/ui/action-tile';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaSectionHeading, KatchaSurfaceCard } from '@/components/katchadeck/ui/katcha-sheet-primitives';
import { KatchaSurfaceProvider, useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { CompanionThreadSwitcher } from '@/components/katchadeck/world/companion-thread-switcher';
import {
  CompanionCard,
  CompanionResultNotice,
  CompanionSection,
  CompanionStatusBadge,
} from '@/components/katchadeck/world/companion-ui-primitives';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI, type KatchaSurface } from '@/constants/katcha-ui';
import type { CompanionThread } from '@/types/companion-interaction';

function SurfaceGallery({ surface }: { surface: KatchaSurface }) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={[styles.surface, { backgroundColor: tokens.background, borderColor: tokens.borderStrong }]}>
      <ThemedText style={styles.eyebrow} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>{surface}</ThemedText>
      <ThemedText style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>{surface === 'parchment' ? 'Keep a piece of today' : 'Return to your collection'}</ThemedText>
      <ThemedText style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>Development gallery for shared surface states, spacing, contrast, and enlarged-copy checks.</ThemedText>
      <KatchaSectionHeading>Actions</KatchaSectionHeading>
      <View style={styles.row}>
        <KatchaButton label="Primary" onPress={() => {}} size="compact" />
        <KatchaButton label="Secondary" onPress={() => {}} size="compact" variant="secondary" />
      </View>
      <View style={styles.row}>
        <KatchaButton label="Tertiary" onPress={() => {}} size="compact" variant="tertiary" />
        <KatchaButton label="Discard" onPress={() => {}} size="compact" variant="destructive" />
      </View>
      <KatchaSectionHeading>Tiles</KatchaSectionHeading>
      <View style={styles.row}>
        <ActionTile description="Selected state" icon="heart.fill" onPress={() => {}} selected tint={tokens.accent} title="Mood" />
        <ActionTile disabled icon="moon.fill" onPress={() => {}} tint={tokens.textTertiary} title="Sleep" />
      </View>
      <KatchaInlineNotice body="This is a recoverable message with a clear next action." onAction={() => {}} actionLabel="Try again" tone="warning" />
      <KatchaSurfaceCard>
        <ThemedText style={styles.cardText} lightColor={tokens.text} darkColor={tokens.text}>Elevated card and inherited text</ThemedText>
      </KatchaSurfaceCard>
    </View>
  );
}

function CompanionGallery() {
  const { tokens } = useKatchaSurface();
  const [thread, setThread] = useState<CompanionThread>('quest');
  return (
    <View style={[styles.surface, { backgroundColor: tokens.background, borderColor: tokens.borderStrong }]}>
      <ThemedText style={styles.eyebrow} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
        Companion system
      </ThemedText>
      <ThemedText style={styles.companionTitle} lightColor={tokens.text} darkColor={tokens.text}>
        Mossprout
      </ThemedText>
      <CompanionThreadSwitcher onChange={setThread} showSkins value={thread} />
      <CompanionSection
        description="Shared spacing, typography, surface and state treatment."
        label="Today together">
        <CompanionCard selected>
          <View style={styles.statusRow}>
            <ThemedText style={styles.cardText} lightColor={tokens.text} darkColor={tokens.text}>
              Notice one living detail
            </ThemedText>
            <CompanionStatusBadge label="In progress" tone="neutral" />
          </View>
          <ThemedText style={styles.body} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
            Add one small observation from outside.
          </ThemedText>
        </CompanionCard>
      </CompanionSection>
      <CompanionResultNotice tasks={['Notice one living detail', 'Take a ten-minute outdoor pause']} />
    </View>
  );
}

export default function DevUiGalleryScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.pageTitle} lightColor="#F8F2E7" darkColor="#F8F2E7">Katcha UI gallery</ThemedText>
        <KatchaSurfaceProvider surface="parchment"><CompanionGallery /></KatchaSurfaceProvider>
        <KatchaSurfaceProvider surface="parchment"><SurfaceGallery surface="parchment" /></KatchaSurfaceProvider>
        <KatchaSurfaceProvider surface="night"><SurfaceGallery surface="night" /></KatchaSurfaceProvider>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#090813', flex: 1 },
  content: { gap: 20, padding: 16, paddingBottom: 48 },
  pageTitle: { ...KatchaUI.type.display, fontSize: 34 },
  surface: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.sheet, borderWidth: 1, gap: 14, padding: 20 },
  eyebrow: KatchaUI.type.label,
  title: KatchaUI.type.display,
  companionTitle: KatchaUI.type.companionName,
  body: KatchaUI.type.body,
  row: { alignItems: 'stretch', flexDirection: 'row', gap: 10 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  cardText: KatchaUI.type.body,
});
