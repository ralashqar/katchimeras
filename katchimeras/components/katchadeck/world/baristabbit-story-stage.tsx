import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
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
      ? [{ title: 'The Pause Table', description: 'A warm ritual, a bright reset, and an optional sweet pairing.', definitionId: 'drink:hot:5', served: false }]
      : (story.orderDeck?.templateKeys ?? []).flatMap((key) => {
          const order = BARISTABBIT_CHAPTER_ONE_ORDER_POOL.find((item) => item.key === key);
          return order
            ? [{ title: order.title, description: order.description, definitionId: order.definitionId, served: story.orderDeck?.servedOrderIds.includes(`merge-story:baristabbit:chapter-1:${key}`) ?? false }]
            : [];
        })
    : [];
  const orderBody = requests.length > 1 ? 'Make and serve these orders.' : 'Make and serve this order.';
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
      <View style={styles.level}><ThemedText selectable style={styles.levelText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}>
        <ThemedText selectable style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>THE PAUSE TABLE</ThemedText>
        <ThemedText selectable style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{title}</ThemedText>
      </View>
    </View>
    <ThemedText numberOfLines={2} selectable style={styles.body} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{requests.length ? orderBody : body}</ThemedText>
    {returnReady && story.pendingBondPoints > 0 ? <View accessibilityLabel={`${story.pendingBondPoints} Bond earned from the tray`} style={styles.bondSummary}>
      <BondIconArt size={23} />
      <ThemedText selectable style={styles.bondSummaryText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>+{story.pendingBondPoints} Bond from the counter</ThemedText>
    </View> : null}
    <CompanionMergeRequestTray
      accessibilityLabel="Baristabbit's requested merge items"
      eyebrow="ON THE COUNTER"
      palette={COMPANION_MERGE_REQUEST_PALETTE}
      requests={requests.map((request) => ({ id: request.title, title: request.title, description: request.description, definitionIds: [request.definitionId], served: request.served }))}
    />
    {!complete ? <KatchaButton onPress={() => {
      if (returnReady && story.pendingConversationId) { beginBaristabbitReturn(); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBegin();
      else onOpenMerge(story.activeOrderId);
    }} icon={returnReady ? 'bubble.left.and.bubble.right.fill' : 'cup.and.saucer.fill'} label={(returnReady ? 'Read Baristabbit’s note' : needsBeginning ? 'Meet Baristabbit' : requests.length > 1 ? 'Open all orders' : 'Make the request')} /> : <KatchaButton onPress={onMore} icon="bubble.left.and.bubble.right.fill" label="More with Baristabbit" />}
    {!needsBeginning ? <Pressable accessibilityRole="button" onPress={onJournal} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <View style={styles.secondaryCopy}><IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryLabel} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Journal a drink pause</ThemedText></View>
      <IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="arrow.right" size={15} />
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 7, padding: 10 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  level: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  levelText: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  copy: { flex: 1, gap: 2 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25, lineHeight: 22 }, body: { fontSize: 12, lineHeight: 17 },
  bondSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 },
  bondSummaryText: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  secondary: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: 10 }, secondaryCopy: { alignItems: 'center', flexDirection: 'row', gap: 7 }, secondaryLabel: { fontSize: 11, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
