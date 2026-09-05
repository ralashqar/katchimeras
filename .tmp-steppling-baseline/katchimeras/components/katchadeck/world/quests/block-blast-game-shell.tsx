import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientEnvironmentDrift } from '@/components/katchadeck/ui/ambient-environment-drift';

const CHEERLET_PARTY_BACKGROUND = require('../../../../assets/images/katchimeras/world/backgrounds/cheerlet-exploration-v1.png');

/** The canonical bright game-stage shell shared by every Block Blast entry path. */
export function BlockBlastGameShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <AmbientEnvironmentDrift>
        <Image
          allowDownscaling
          cachePolicy="memory-disk"
          contentFit="cover"
          pointerEvents="none"
          priority="high"
          recyclingKey="block-blast-cheerlet-party-background"
          source={CHEERLET_PARTY_BACKGROUND}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
      </AmbientEnvironmentDrift>
      <LinearGradient
        colors={['rgba(255,246,220,0.12)', 'rgba(255,239,205,0.04)', 'rgba(33,18,43,0.24)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, {
        paddingBottom: Math.max(10, insets.bottom + 8),
        paddingTop: insets.top + 8,
      }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#9DCB6A', flex: 1 },
  content: { flex: 1, paddingHorizontal: 14 },
});
