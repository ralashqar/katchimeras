import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AvatarStudio } from '@/components/katchadeck/dev/avatar-studio';
import { KatchimeraStudio } from '@/components/katchadeck/dev/katchimera-studio';
import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaDeckUI } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export default function ArtLabScreen() {
  const [assetTab, setAssetTab] = useState<'katchimeras' | 'avatars'>('katchimeras');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Katcha Art Studio' }} />
      <AmbientBackground
        accentColor="rgba(200,216,255,0.16)"
        colors={['#090B12', '#10192A', '#171E34']}
        meshColors={[
          'rgba(200,216,255,0.14)',
          'rgba(240,223,255,0.1)',
          'rgba(95,168,123,0.08)',
          'rgba(227,160,110,0.08)',
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()}>
          <ThemedText type="label" style={styles.kicker} lightColor="#D4E1FF" darkColor="#D4E1FF">
            Dev tool
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
            Katcha art studio
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            Generate creature art, manage hooded/default avatars, and test selfie-based avatar creation.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={presenceEnter(50)}>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setAssetTab('katchimeras')}
              style={[styles.modeChip, assetTab === 'katchimeras' ? styles.modeChipSelected : null]}>
              <ThemedText style={styles.modeChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Katchimeras
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setAssetTab('avatars')}
              style={[styles.modeChip, assetTab === 'avatars' ? styles.modeChipSelected : null]}>
              <ThemedText style={styles.modeChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Avatars
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {assetTab === 'avatars' ? <AvatarStudio /> : <KatchimeraStudio />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  content: {
    gap: KatchaDeckUI.spacing.lg,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  kicker: {
    fontSize: 11,
    marginBottom: 6,
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
    marginBottom: 12,
  },
  body: {
    maxWidth: 340,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeChipSelected: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderColor: 'rgba(200,216,255,0.3)',
  },
  modeChipText: {
    fontSize: 14,
  },
});
