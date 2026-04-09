import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HoodedAvatar } from '@/components/katchadeck/hooded-avatar';
import { KatchaDeckUI } from '@/constants/theme';
import type { AvatarSource } from '@/types/avatar';
import { resolveAvatarSource } from '@/utils/avatar-art';
import { getOrCreateLocalTestPlayerId } from '@/utils/local-test-player';

type ResolvedAvatarProps = {
  size?: number;
};

export function ResolvedAvatar({ size = 184 }: ResolvedAvatarProps) {
  const [avatarSource, setAvatarSource] = useState<AvatarSource>({ type: 'code_fallback' });

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        try {
          const playerId = getOrCreateLocalTestPlayerId();
          const source = await resolveAvatarSource(playerId);

          if (active) {
            setAvatarSource(source);
          }
        } catch {
          if (active) {
            setAvatarSource({ type: 'code_fallback' });
          }
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [])
  );

  if (avatarSource.type === 'code_fallback') {
    return <HoodedAvatar size={size} />;
  }

  return (
    <View style={[styles.shell, { height: size, width: size }]}>
      <View style={[styles.glowRing, { height: size * 0.86, width: size * 0.86 }]} />
      <View style={styles.ringOutline} />
      <Image
        contentFit="cover"
        source={{ uri: avatarSource.record.image_url ?? '' }}
        style={[
          styles.image,
          {
            borderRadius: size * 0.32,
            height: size * 0.74,
            width: size * 0.62,
          },
        ]}
      />
      <View style={styles.aura} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    backgroundColor: 'rgba(137, 152, 255, 0.18)',
    borderRadius: 999,
    position: 'absolute',
  },
  ringOutline: {
    borderColor: 'rgba(200,216,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    height: '92%',
    opacity: 0.74,
    position: 'absolute',
    width: '92%',
  },
  image: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  aura: {
    backgroundColor: 'rgba(137, 152, 255, 0.18)',
    borderRadius: 999,
    boxShadow: KatchaDeckUI.shadows.soft,
    bottom: 8,
    height: '26%',
    position: 'absolute',
    width: '72%',
  },
});
