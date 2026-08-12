import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { BARISTABBIT_CHAPTER_ONE_ORDER_POOL } from '@/utils/companion-story';
import { beginBaristabbitReturn, loadBaristabbitStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

export function BaristabbitStoryStage({ onBegin, onJournal, onMore, onOpenConversation, onOpenMerge }: {
  onBegin: () => void;
  onJournal: () => void;
  onMore: () => void;
  onOpenConversation: (definitionId: string) => void;
  onOpenMerge: (orderId?: string | null) => void;
}) {
  const [story, setStory] = useState(loadBaristabbitStory);
  useEffect(() => subscribeCompanionStories(() => setStory(loadBaristabbitStory())), []);
  const needsBeginning = story.status === 'intro_available';
  const returnReady = story.status === 'return_available' || story.status === 'conversation_active';
  const complete = story.status === 'chapter_complete';
  const regularProgress = story.orderDeck?.servedOrderIds.filter((id) => id.startsWith('merge-story:baristabbit:chapter-1:')).length ?? 0;
  const requests = story.status === 'order_active'
    ? story.actPhase === 'signature_order'
      ? [{ title: 'The Pause Table', description: 'A warm ritual, a bright reset, and an optional sweet pairing.', definitionId: 'drink:hot:5' }]
      : (story.orderDeck?.templateKeys ?? []).flatMap((key) => {
          const order = BARISTABBIT_CHAPTER_ONE_ORDER_POOL.find((item) => item.key === key);
          return order && !story.orderDeck?.servedOrderIds.includes(`merge-story:baristabbit:chapter-1:${key}`)
            ? [{ title: order.title, description: order.description, definitionId: order.definitionId }]
            : [];
        }).slice(0, 3)
    : [];
  const title = complete
    ? 'The Pause Table is remembered'
    : returnReady
      ? 'A note behind the counter'
      : needsBeginning
        ? 'The counter is almost open'
        : story.actPhase === 'signature_order'
          ? 'One table for every kind of pause'
          : `${regularProgress} of 5 village cups served`;
  const body = complete
    ? 'Five village requests, your pause insight, and the first Pause Table now live in Shared history.'
    : returnReady
      ? 'The tray is clear for a moment. Baristabbit has noticed something worth asking before the next orders arrive.'
      : needsBeginning
        ? 'Meet Baristabbit and decide what a drink ritual should give you—without turning the pause into another task.'
        : story.actPhase === 'signature_order'
          ? 'Bring together warm and refreshing drink chains. If Feastle’s Pantry is open, the table will borrow a sweet pairing too.'
          : 'The Ritual Bar makes warm and refreshing starters. Merge them into each villager’s version of a useful pause.';

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.level}><ThemedText selectable style={styles.levelText} lightColor="#FFF9EC" darkColor="#FFF9EC">{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}>
        <ThemedText selectable style={styles.eyebrow} lightColor="#805637" darkColor="#805637">THE PAUSE TABLE</ThemedText>
        <ThemedText selectable style={styles.title} lightColor="#35271F" darkColor="#35271F">{title}</ThemedText>
      </View>
    </View>
    <ThemedText selectable style={styles.body} lightColor="#655044" darkColor="#655044">{body}</ThemedText>
    {returnReady && story.pendingBondPoints > 0 ? <View accessibilityLabel={`${story.pendingBondPoints} Bond earned from the tray`} style={styles.bondSummary}>
      <IconSymbol color="#FFF9E9" name="heart.fill" size={15} />
      <ThemedText selectable style={styles.bondSummaryText} lightColor="#FFF9E9" darkColor="#FFF9E9">+{story.pendingBondPoints} Bond from the counter</ThemedText>
    </View> : null}
    {requests.length ? <View accessibilityLabel="Baristabbit's requested merge items" style={styles.requestTray}>
      <View style={styles.requestHeading}>
        <ThemedText selectable style={styles.requestEyebrow} lightColor="#805637" darkColor="#805637">ON THE COUNTER</ThemedText>
        <ThemedText selectable style={styles.requestCount} lightColor="#6A503F" darkColor="#6A503F">{requests.length} {requests.length === 1 ? 'order' : 'orders'}</ThemedText>
      </View>
      {requests.map((request) => <View key={request.title} style={styles.requestRow}>
        <View style={styles.requestArt}><PersistentMergeItemArt definitionId={request.definitionId} size={48} /></View>
        <View style={styles.requestCopy}>
          <ThemedText selectable style={styles.requestTitle} lightColor="#35271F" darkColor="#35271F">{request.title}</ThemedText>
          <ThemedText selectable numberOfLines={2} style={styles.requestDescription} lightColor="#6B594D" darkColor="#6B594D">{request.description}</ThemedText>
          <ThemedText selectable style={styles.requestItemName} lightColor="#745947" darkColor="#745947">{MERGE_ITEMS_BY_ID.get(request.definitionId)?.name ?? 'Merge item'}</ThemedText>
        </View>
      </View>)}
    </View> : null}
    {!complete ? <Pressable accessibilityRole="button" onPress={() => {
      if (returnReady && story.pendingConversationId) { beginBaristabbitReturn(); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBegin();
      else onOpenMerge(story.activeOrderId);
    }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color="#FFF9E9" name={returnReady ? 'bubble.left.and.bubble.right.fill' : 'cup.and.saucer.fill'} size={19} />
      <ThemedText style={styles.primaryLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">{returnReady ? 'Read Baristabbit’s note' : needsBeginning ? 'Meet Baristabbit' : requests.length > 1 ? 'Open all orders' : 'Make the request'}</ThemedText>
      <IconSymbol color="#FFF9E9" name="arrow.right" size={17} />
    </Pressable> : <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color="#FFF9E9" name="bubble.left.and.bubble.right.fill" size={19} />
      <ThemedText style={styles.primaryLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">More with Baristabbit</ThemedText>
      <IconSymbol color="#FFF9E9" name="arrow.right" size={17} />
    </Pressable>}
    {!needsBeginning ? <Pressable accessibilityRole="button" onPress={onJournal} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <View style={styles.secondaryCopy}><IconSymbol color="#70482E" name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryLabel} lightColor="#70482E" darkColor="#70482E">Journal a drink pause</ThemedText></View>
      <IconSymbol color="#70482E" name="arrow.right" size={15} />
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#FFF1DD', borderColor: 'rgba(119,76,46,0.28)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 28px rgba(73,45,28,0.16)', gap: 14, padding: 18 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  level: { alignItems: 'center', backgroundColor: '#87573A', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  levelText: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  copy: { flex: 1, gap: 2 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.35, lineHeight: 25 }, body: { fontSize: 13.5, lineHeight: 20 },
  bondSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#718C58', borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 },
  bondSummaryText: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  requestTray: { backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(119,76,46,0.2)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 8, padding: 11 },
  requestHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, requestEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 }, requestCount: { fontSize: 10.5, fontWeight: '800' },
  requestRow: { alignItems: 'center', backgroundColor: '#FFF9EF', borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 10, minHeight: 68, paddingHorizontal: 9, paddingVertical: 6 },
  requestArt: { alignItems: 'center', height: 50, justifyContent: 'center', width: 50 }, requestCopy: { flex: 1, gap: 1 },
  requestTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 }, requestDescription: { fontSize: 11, lineHeight: 15 }, requestItemName: { fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  primary: { alignItems: 'center', backgroundColor: '#70482E', borderCurve: 'continuous', borderRadius: 19, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 }, primaryLabel: { flex: 1, fontSize: 15, fontWeight: '900' },
  secondary: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 13 }, secondaryCopy: { alignItems: 'center', flexDirection: 'row', gap: 9 }, secondaryLabel: { fontSize: 13, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
