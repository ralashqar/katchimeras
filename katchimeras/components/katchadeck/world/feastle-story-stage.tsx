import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FEASTLE_STORY_REQUESTS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { beginFeastleReturn, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

export function FeastleStoryStage({ onBeginIntroduction, onJournalFood, onMore, onOpenConversation, onOpenMerge }: {
  onBeginIntroduction: () => void;
  onJournalFood: () => void;
  onMore: () => void;
  onOpenConversation: (definitionId: string) => void;
  onOpenMerge: (orderId?: string | null) => void;
}) {
  const [story, setStory] = useState(loadFeastleStory);
  useEffect(() => subscribeCompanionStories(() => setStory(loadFeastleStory())), []);
  const returnReady = story.status === 'return_available' || story.status === 'conversation_active';
  const complete = story.status === 'chapter_complete';
  const needsBeginning = story.status === 'intro_available';
  const canJournalFood = story.journalFtueStatus !== 'not_started' && (story.status === 'order_active' || complete);
  const requests = story.status === 'order_active'
    ? (FEASTLE_STORY_REQUESTS[story.targetLevel] ?? []).filter((_, index) => !story.completedOrderIds.includes(
        `merge-story:feastle:chapter-1:level-${story.targetLevel}:order-${index + 1}`
      ))
    : [];
  const title = complete ? 'Our first table is set' : returnReady ? 'A note from Feastle' : needsBeginning ? 'Feastle is unpacking' : story.targetLevel === 4 ? 'Three places on the tray' : 'Your next request';
  const body = complete
    ? 'Three small dishes, one suspicious jar, and the beginning of a very good friendship.'
    : returnReady
      ? 'The plate is empty and Feastle has something to say. Return to the table for the next part.'
      : needsBeginning
        ? 'Meet Feastle, make a tiny pact, and find out why one spoon has already escaped the picnic basket.'
        : story.targetLevel === 4
          ? 'Feastle is setting the whole table this time. Each dish has its own tray, and you can serve them one by one.'
          : 'Here is exactly what Feastle needs next. Make it in the Pantry, then serve it from the tray.';

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.level}><ThemedText selectable style={styles.levelText} lightColor="#FFF8E9" darkColor="#FFF8E9">{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}><ThemedText selectable style={styles.eyebrow} lightColor="#8B672E" darkColor="#8B672E">A PLACE AT THE TABLE</ThemedText><ThemedText selectable style={styles.title} lightColor="#3B2C20" darkColor="#3B2C20">{title}</ThemedText></View>
    </View>
    <ThemedText selectable style={styles.body} lightColor="#66513A" darkColor="#66513A">{body}</ThemedText>
    {returnReady && story.pendingBondPoints > 0 ? <View accessibilityLabel={`${story.pendingBondPoints} Bond earned from this chapter`} style={styles.bondSummary}>
      <IconSymbol color="#FFF9E9" name="heart.fill" size={15} />
      <ThemedText selectable style={styles.bondSummaryText} lightColor="#FFF9E9" darkColor="#FFF9E9">+{story.pendingBondPoints} Bond from the tray</ThemedText>
    </View> : null}
    {requests.length ? <View accessibilityLabel="Feastle's requested merge items" style={styles.requestTray}>
      <View style={styles.requestHeading}>
        <ThemedText selectable style={styles.requestEyebrow} lightColor="#8B672E" darkColor="#8B672E">NEXT REQUEST</ThemedText>
        <ThemedText selectable style={styles.requestCount} lightColor="#6A5030" darkColor="#6A5030">{requests.length} {requests.length === 1 ? 'order' : 'orders'}</ThemedText>
      </View>
      {requests.map((request) => <View key={`${story.targetLevel}:${request.definitionId}:${request.title}`} style={styles.requestRow}>
        <View style={styles.requestArt}><PersistentMergeItemArt definitionId={request.definitionId} size={48} /></View>
        <View style={styles.requestCopy}>
          <ThemedText selectable style={styles.requestTitle} lightColor="#3B2C20" darkColor="#3B2C20">{request.title}</ThemedText>
          <ThemedText selectable style={styles.requestItemName} lightColor="#745936" darkColor="#745936">{MERGE_ITEMS_BY_ID.get(request.definitionId)?.name ?? 'Merge item'}</ThemedText>
        </View>
        {request.quantity > 1 ? <View style={styles.quantity}><ThemedText selectable style={styles.quantityText} lightColor="#FFF9E9" darkColor="#FFF9E9">×{request.quantity}</ThemedText></View> : null}
      </View>)}
    </View> : null}
    {!complete ? <Pressable accessibilityRole="button" onPress={() => {
      if (returnReady && story.pendingConversationId) { beginFeastleReturn(); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBeginIntroduction();
      else onOpenMerge(story.activeOrderId);
    }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color="#FFF9E9" name={returnReady ? 'bubble.left.and.bubble.right.fill' : 'fork.knife'} size={19} />
      <ThemedText style={styles.primaryLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">{returnReady ? 'Read Feastle’s note' : needsBeginning ? 'Meet Feastle' : requests.length > 1 ? 'Open all orders' : 'Make the request'}</ThemedText><IconSymbol color="#FFF9E9" name="arrow.right" size={17} />
    </Pressable> : null}
    {complete ? <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><IconSymbol color="#FFF9E9" name="bubble.left.and.bubble.right.fill" size={19} /><ThemedText style={styles.primaryLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">More with Feastle</ThemedText><IconSymbol color="#FFF9E9" name="arrow.right" size={17} /></Pressable> : null}
    {canJournalFood ? <Pressable accessibilityRole="button" onPress={onJournalFood} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}><IconSymbol color="#76501F" name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryLabel} lightColor="#76501F" darkColor="#76501F">Journal a food moment</ThemedText></View><IconSymbol color="#76501F" name="arrow.right" size={15} />
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#FFF4D8', borderColor: 'rgba(139,103,46,0.3)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 28px rgba(88,57,24,0.16)', gap: 14, padding: 18 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 }, level: { alignItems: 'center', backgroundColor: '#83612F', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 }, levelText: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }, copy: { flex: 1, gap: 2 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.35, lineHeight: 25 }, body: { fontSize: 13.5, lineHeight: 20 },
  requestTray: { backgroundColor: 'rgba(255,255,255,0.52)', borderColor: 'rgba(139,103,46,0.22)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 8, padding: 11 }, requestHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, requestEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 }, requestCount: { fontSize: 10.5, fontWeight: '800' },
  bondSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#708D48', borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 }, bondSummaryText: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  requestRow: { alignItems: 'center', backgroundColor: '#FFF8E8', borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 9, paddingVertical: 6 }, requestArt: { alignItems: 'center', height: 50, justifyContent: 'center', width: 50 }, requestCopy: { flex: 1, gap: 1 }, requestTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 }, requestItemName: { fontSize: 11.5, fontWeight: '700', lineHeight: 16 }, quantity: { alignItems: 'center', backgroundColor: '#76501F', borderRadius: 999, justifyContent: 'center', minWidth: 30, paddingHorizontal: 7, paddingVertical: 5 }, quantityText: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  primary: { alignItems: 'center', backgroundColor: '#76501F', borderCurve: 'continuous', borderRadius: 19, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 }, primaryLabel: { flex: 1, fontSize: 15, fontWeight: '900' }, secondary: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 13 }, secondaryLabel: { fontSize: 13, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
