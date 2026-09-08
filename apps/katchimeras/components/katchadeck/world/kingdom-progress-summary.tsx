import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { AppFontFamilies } from '@/constants/theme';
import type { KingdomFriendEntry, KingdomFriendStatus, KingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import { getCreatureVisual } from '@/game/days/visuals';

const STATUS_LABEL: Record<KingdomFriendStatus, string> = {
  home: 'Home',
  helping: 'Helping',
  waiting: 'Waiting',
  resting: 'Resting',
  away: 'Far off',
};

export function KingdomFriendTile({ friend, size = 56 }: { friend: KingdomFriendEntry; size?: number }) {
  const skin = katchimeraSkinById.get(friend.skinId);
  const visual = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown') : null;
  const home = friend.status === 'home';
  return <View accessibilityLabel={`${home ? friend.name : 'A friend'}, ${STATUS_LABEL[friend.status].toLowerCase()}`} style={styles.tile}>
    <View style={[styles.portrait, { width: size, height: size, borderRadius: size / 2 }, home ? styles.portraitHome : styles.portraitAway]}>
      {visual ? <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory-disk" contentFit="contain"
        source={visual.source} style={[{ width: size * 1.3, height: size * 1.3, marginTop: size * 0.18 }, !home && styles.silhouette]} transition={0} /> : null}
      {!home ? <View style={styles.badge}><IconSymbol color="#F7EDC9" name="lock.fill" size={10} /></View> : null}
    </View>
    <ThemedText numberOfLines={1} style={styles.tileLabel} lightColor={home ? '#4C7A3E' : '#8A7A5B'} darkColor={home ? '#4C7A3E' : '#8A7A5B'}>
      {home ? friend.name : STATUS_LABEL[friend.status]}
    </ThemedText>
  </View>;
}

/** Counters plus the full roster at a glance. Shared by the goal scene and the Kingdom sheet. */
export function KingdomProgressSummary({ progress, showRoster = true }: { progress: KingdomProgress; showRoster?: boolean }) {
  return <View style={styles.summary}>
    <View style={styles.counters}>
      <View style={styles.counter}>
        <ThemedText style={styles.counterValue} lightColor="#3E5A2A" darkColor="#3E5A2A">{progress.friends.home}<ThemedText style={styles.counterTotal} lightColor="#8A7A5B" darkColor="#8A7A5B"> / {progress.friends.total}</ThemedText></ThemedText>
        <ThemedText style={styles.counterLabel} lightColor="#7B6544" darkColor="#7B6544">friends home</ThemedText>
      </View>
      <View style={styles.counterDivider} />
      <View style={styles.counter}>
        <ThemedText style={styles.counterValue} lightColor="#3E5A2A" darkColor="#3E5A2A">{progress.places.restored}<ThemedText style={styles.counterTotal} lightColor="#8A7A5B" darkColor="#8A7A5B"> / {progress.places.total}</ThemedText></ThemedText>
        <ThemedText style={styles.counterLabel} lightColor="#7B6544" darkColor="#7B6544">places restored</ThemedText>
      </View>
    </View>
    {showRoster ? <View style={styles.roster}>
      {progress.friends.entries.map((friend) => <KingdomFriendTile friend={friend} key={friend.skinId} />)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  summary: { gap: 14 },
  counters: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 18 },
  counter: { alignItems: 'center', minWidth: 110 },
  counterDivider: { width: 1, height: 34, backgroundColor: 'rgba(132,100,45,0.25)' },
  counterValue: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 30, lineHeight: 36 },
  counterTotal: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, lineHeight: 36 },
  counterLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  roster: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tile: { alignItems: 'center', width: 68, gap: 4 },
  portrait: { alignItems: 'center', borderWidth: 3, justifyContent: 'center', overflow: 'hidden' },
  portraitHome: { backgroundColor: '#E9F5D6', borderColor: '#FFF8DD' },
  portraitAway: { backgroundColor: '#D9DECF', borderColor: '#F3ECDD' },
  silhouette: { opacity: 0.72, tintColor: '#344238' },
  badge: { position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#5C4E32', alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontWeight: '800', textAlign: 'center' },
});
