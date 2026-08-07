import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DailyCardSize } from '@/components/katchadeck/cards/daily-card';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';

type FormingEggItemProps = {
  cardSize: DailyCardSize;
  children?: ReactNode;
  countdownContent?: ReactNode;
  footerContent?: ReactNode;
  heroTop?: number;
  locked: boolean;
};

export function FormingEggItem({
  cardSize,
  children,
  countdownContent,
  footerContent,
  heroTop: requestedHeroTop,
  locked,
}: FormingEggItemProps) {
  const { equippedSkin } = useEggAvatar();
  const heroTop = Math.max(52, Math.min(98, requestedHeroTop ?? cardSize.height * 0.18));
  const heroSize = Math.min(258, cardSize.height * 0.52);
  return (
    <View pointerEvents="box-none" style={[styles.item, { height: cardSize.height, width: cardSize.width }]}>
      <View pointerEvents="box-none" style={[styles.hero, { height: heroSize, top: heroTop }]}>
        {children ?? (
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            source={equippedSkin.fullSource}
            style={[styles.egg, locked ? styles.eggLocked : null]}
            transition={0}
          />
        )}
      </View>
      {countdownContent && !locked ? (
        <View pointerEvents="none" style={[styles.countdown, { top: heroTop + heroSize - 23 }]}>{countdownContent}</View>
      ) : null}
      {footerContent ? <View style={styles.footer}>{footerContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', position: 'relative' },
  hero: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: 300 },
  egg: { height: '100%', width: '76%' },
  eggLocked: { opacity: 0.62 },
  countdown: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 5 },
  footer: { alignItems: 'center', bottom: 4, justifyContent: 'center', left: 0, position: 'absolute', right: 0, zIndex: 8 },
});
