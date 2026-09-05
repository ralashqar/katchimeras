import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { FEASTLE_STORY_REQUESTS } from '@/constants/merge-world-catalog';
import { FEASTLE_ACT_TWO_ORDER_POOL } from '@/utils/companion-story';
import { beginFeastleActTwo, beginFeastleReturn, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

const FEASTLE_TABLE_ART = require('../../../assets/images/katchimeras/environments/feastle_hearth/props/feast_table_l1.webp');
const JOURNEY_STEPS = ['Meet', 'Make', 'Serve', 'Return'] as const;

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
  const actOneComplete = story.status === 'chapter_complete' && story.currentActId === 'act-1';
  const complete = story.status === 'chapter_complete' && story.currentActId === 'act-2';
  const needsBeginning = story.status === 'intro_available';
  const canJournalFood = story.journalFtueStatus !== 'not_started' && (story.status === 'order_active' || complete);
  const actTwoRequests = story.actPhase === 'signature_order'
    ? [{ title: "Feastle's First Feast", description: 'A generous shared table and celebration cake made from everything the Pantry has taught us.', definitionId: 'food:table:5', secondaryDefinitionId: 'food:dessert:5', quantity: 1, served: false }]
    : story.actPhase === 'regular_orders' && story.orderDeck
      ? story.orderDeck.templateKeys.flatMap((key) => {
        const order = FEASTLE_ACT_TWO_ORDER_POOL.find((item) => item.key === key);
        return order
          ? [{ title: order.title, description: order.description, definitionId: order.definitionId, secondaryDefinitionId: 'secondaryDefinitionId' in order ? order.secondaryDefinitionId : undefined, quantity: 1, served: story.orderDeck?.servedOrderIds.includes(`merge-story:feastle:act-2:${key}`) ?? false }]
          : [];
      })
      : [];
  const chapterOneRequests = (FEASTLE_STORY_REQUESTS[story.targetLevel] ?? []).map((request, index) => ({
    ...request,
    served: story.completedOrderIds.includes(`merge-story:feastle:chapter-1:level-${story.targetLevel}:order-${index + 1}`),
  }));
  const requests = story.status === 'order_active'
    ? actTwoRequests.length ? actTwoRequests : chapterOneRequests
    : [];
  const orderBody = requests.length > 1 ? 'Make and serve these orders.' : 'Make and serve this order.';
  const regularProgress = story.orderDeck?.servedOrderIds.filter((id) => id.startsWith('merge-story:feastle:act-2:')).length ?? 0;
  const title = complete ? 'Our first feast is remembered' : actOneComplete ? 'The village order bell' : returnReady ? 'A note from Feastle' : needsBeginning ? 'Feastle is unpacking' : story.actPhase === 'regular_orders' ? `${regularProgress} of 5 villagers served` : story.targetLevel === 4 ? 'Three places on the tray' : 'Your next request';
  const body = complete
    ? 'Five village requests and one first feast now live in the Recipe Book.'
    : actOneComplete
      ? 'Our first table is set. Now the village has started sending real requests—and each one carries a little story.'
    : returnReady
      ? 'The plate is empty and Feastle has something to say. Return to the table for the next part.'
      : needsBeginning
        ? 'Meet Feastle, make a tiny pact, and find out why one spoon has already escaped the picnic basket.'
        : story.targetLevel === 4
          ? 'Three dishes are ready to make.'
          : 'Make the next dish in the Pantry.';
  const journeyStep = complete || actOneComplete
    ? 4
    : returnReady
      ? 3
      : story.status === 'order_active'
        ? 1
        : needsBeginning
          ? 0
          : 1;

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.level}><ThemedText selectable style={styles.levelText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}><ThemedText selectable style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A PLACE AT THE TABLE</ThemedText><ThemedText selectable style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{title}</ThemedText></View>
    </View>
    <ThemedText numberOfLines={2} selectable style={styles.body} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{requests.length ? orderBody : body}</ThemedText>
    <View accessibilityLabel={`Feastle journey. ${JOURNEY_STEPS.map((step, index) => `${step} ${index < journeyStep ? 'complete' : index === journeyStep ? 'next' : 'not started'}`).join(', ')}`} style={styles.journey}>
      {JOURNEY_STEPS.map((step, index) => {
        const done = index < journeyStep;
        const active = index === journeyStep;
        return <View key={step} style={styles.journeyStep}>
          <View style={[styles.journeyDot, done && styles.journeyDotDone, active && styles.journeyDotActive]}>{done ? <IconSymbol color="#FFF9E9" name="checkmark" size={9} /> : null}</View>
          <ThemedText style={[styles.journeyLabel, (done || active) && styles.journeyLabelCurrent]} lightColor="#9B846A" darkColor="#9B846A">{step}</ThemedText>
          {index < JOURNEY_STEPS.length - 1 ? <View style={[styles.journeyLine, done && styles.journeyLineDone]} /> : null}
        </View>;
      })}
    </View>
    {complete || actOneComplete ? <View accessibilityLabel={"Feastle's First Table landmark unlocked"} style={styles.landmark}>
      <View pointerEvents="none" style={styles.landmarkGlow} />
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={FEASTLE_TABLE_ART} style={styles.landmarkArt} transition={0} />
      <View style={styles.landmarkCopy}><ThemedText style={styles.landmarkEyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>LANDMARK UNLOCKED</ThemedText><ThemedText selectable style={styles.landmarkTitle} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{'Feastle\'s First Table'}</ThemedText><ThemedText selectable style={styles.landmarkBody} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>A piece of your shared story now lives in the world.</ThemedText></View>
    </View> : null}
    {returnReady && story.pendingBondPoints > 0 ? <View accessibilityLabel={`${story.pendingBondPoints} Bond earned from this chapter`} style={styles.bondSummary}>
      <BondIconArt size={23} />
      <ThemedText selectable style={styles.bondSummaryText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>+{story.pendingBondPoints} Bond from the tray</ThemedText>
    </View> : null}
    <CompanionMergeRequestTray
      accessibilityLabel="Feastle's requested merge items"
      eyebrow="NEXT REQUEST"
      palette={COMPANION_MERGE_REQUEST_PALETTE}
      requests={requests.map((request) => ({
        id: `${story.targetLevel}:${request.definitionId}:${request.title}`,
        title: request.title,
        description: 'description' in request && typeof request.description === 'string' ? request.description : undefined,
        definitionIds: [request.definitionId, 'secondaryDefinitionId' in request ? request.secondaryDefinitionId : undefined].filter((id): id is string => Boolean(id)),
        quantity: request.quantity,
        served: request.served,
      }))}
    />
    {!complete ? <KatchaButton onPress={() => {
      if (actOneComplete) { const next = beginFeastleActTwo(); if (next.pendingConversationId) onOpenConversation(next.pendingConversationId); }
      else if (returnReady && story.pendingConversationId) { beginFeastleReturn(); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBeginIntroduction();
      else onOpenMerge(story.activeOrderId);
    }} icon={returnReady ? 'bubble.left.and.bubble.right.fill' : 'fork.knife'} label={(actOneComplete ? 'Open the village table' : returnReady ? 'Read Feastle’s note' : needsBeginning ? 'Meet Feastle' : requests.length > 1 ? 'Open all orders' : 'Make the request')} /> : null}
    {complete ? <KatchaButton onPress={onMore} icon="bubble.left.and.bubble.right.fill" label="More with Feastle" /> : null}
    {canJournalFood ? <Pressable accessibilityRole="button" onPress={onJournalFood} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 9 }}><IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryLabel} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>Journal a food moment</ThemedText></View><IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="arrow.right" size={15} />
    </Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 7, padding: 10 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 9 }, level: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 14, height: 40, justifyContent: 'center', width: 40 }, levelText: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }, copy: { flex: 1, gap: 1 }, eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 }, title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25, lineHeight: 22 }, body: { fontSize: 12, lineHeight: 17 },
  journey: { alignItems: 'flex-start', flexDirection: 'row', paddingHorizontal: 3, paddingVertical: 3 },
  journeyStep: { alignItems: 'center', flex: 1, gap: 4, position: 'relative' },
  journeyDot: { alignItems: 'center', backgroundColor: '#E6D7BA', borderColor: '#C9B58F', borderRadius: 999, borderWidth: 1, height: 18, justifyContent: 'center', width: 18, zIndex: 2 },
  journeyDotDone: { backgroundColor: '#708D48', borderColor: '#708D48' },
  journeyDotActive: { backgroundColor: '#FFF8E8', borderColor: '#8B672E', borderWidth: 3, boxShadow: '0 0 0 3px rgba(139,103,46,0.13)' },
  journeyLabel: { fontSize: 9, fontWeight: '700', lineHeight: 12 },
  journeyLabelCurrent: { color: '#5D452A', fontWeight: '900' },
  journeyLine: { backgroundColor: '#DFCFB0', height: 2, left: '62%', position: 'absolute', right: '-38%', top: 8, zIndex: 1 },
  journeyLineDone: { backgroundColor: '#8BA760' },
  landmark: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.cardBackground, borderColor: KatchaUI.companionScenePanel.cardBorder, borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 88, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 8, position: 'relative' },
  landmarkGlow: { backgroundColor: 'rgba(243,200,103,0.18)', borderRadius: 999, height: 110, left: -30, position: 'absolute', top: -28, width: 150 },
  landmarkArt: { height: 72, width: 96 },
  landmarkCopy: { flex: 1, gap: 1 },
  landmarkEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9, lineHeight: 11 },
  landmarkTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2, lineHeight: 20 },
  landmarkBody: { fontSize: 10.5, lineHeight: 14 },
  bondSummary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 }, bondSummaryText: { fontSize: 11.5, fontWeight: '900', fontVariant: ['tabular-nums'] }, secondary: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: 10 }, secondaryLabel: { fontSize: 11, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
