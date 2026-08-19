import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { AUTHORED_COHORT_ORDER_POOLS, type AuthoredCohortFamilyId } from '@/utils/companion-story';
import { beginAuthoredCohortReturn, loadAuthoredCohortStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

const COPY = {
  steppling: {
    eyebrow: 'THE PATH OUTSIDE', completeTitle: 'The Path Outside is remembered', introTitle: 'A path is waiting',
    introBody: 'Meet Steppling and decide what movement should give you—headspace, purpose, company, discovery, or simply a way there.',
    regularBody: 'Make a route that fits each villager.',
    signatureTitle: 'One path with room for every pace', signatureBody: 'Bring together a landmark trail and a travel journal to make The Path Outside.',
    returnBody: 'Steppling has noticed something about how a path begins. The orders can wait while you talk.',
    completeBody: 'Five village routes, your movement insight, and The Path Outside now live in Shared history.',
    requestArea: 'ON THE PATH', progress: 'village routes', journal: 'Journal a movement moment', icon: 'figure.walk' as const,
    signature: { title: 'The Path Outside', description: 'A path for purpose, discovery, company, and a sustainable pace.', definitionId: 'adventure:trail:5' },
  },
  voyagle: {
    eyebrow: 'THE MAP WITH BLANK SPACES', completeTitle: 'The map is remembered', introTitle: 'Part of the map is blank',
    introBody: 'Meet Voyagle and decide what a journey should give you—discovery, rest, connection, a place, or one story worth keeping.',
    regularBody: 'Make a journey with room to change.',
    signatureTitle: 'One map that leaves room for surprise', signatureBody: 'Bring together a memory-worthy journey and a confident trail, leaving one space unwritten.',
    returnBody: 'Voyagle has found a clue about how you meet unfamiliar places. The map can wait while you talk.',
    completeBody: 'Five village journeys, your travel insight, and The Map with Blank Spaces now live in Shared history.',
    requestArea: 'ON THE MAP', progress: 'village journeys', journal: 'Journal a place or journey', icon: 'map.fill' as const,
    signature: { title: 'The Map with Blank Spaces', description: 'A prepared journey with one part deliberately left open.', definitionId: 'adventure:travel:5' },
  },
  flexel: {
    eyebrow: 'THE RHYTHM THAT HOLDS', completeTitle: 'The rhythm is remembered', introTitle: 'A rhythm can bend',
    introBody: 'Meet Flexel and decide what movement should give you—capability, energy, play, confidence, or a supported beginning.',
    regularBody: 'Pair movement with enough care to return.',
    signatureTitle: 'One rhythm strong enough to adapt', signatureBody: 'Bring together a landmark trail and a complete care station to make The Rhythm That Holds.',
    returnBody: 'Flexel has noticed what helps movement remain returnable. The session can pause while you talk.',
    completeBody: 'Five village sessions, your movement-and-recovery insight, and The Rhythm That Holds now live in Shared history.',
    requestArea: 'IN THE SESSION', progress: 'village sessions', journal: 'Journal movement or recovery', icon: 'dumbbell.fill' as const,
    signature: { title: 'The Rhythm That Holds', description: 'Movement and recovery arranged so there is enough left to return.', definitionId: 'adventure:trail:5' },
  },
  bedrotte: {
    eyebrow: 'THE ROOM THAT ASKS NOTHING', completeTitle: 'The room is remembered', introTitle: 'A quiet room is waiting',
    introBody: 'Meet Bedrotte and decide what rest should offer—sleep, quiet, comfort, boundaries, or company without demands.',
    regularBody: 'Make a resting place without demands.',
    signatureTitle: 'One room with nothing to prove', signatureBody: 'Bring together a complete rest nest and sanctuary kit to make The Room That Asks Nothing.',
    returnBody: 'Bedrotte has noticed a condition that helps rest land. Every other demand can wait while you talk.',
    completeBody: 'Five village resting places, your recovery insight, and The Room That Asks Nothing now live in Shared history.',
    requestArea: 'IN THE QUIET ROOM', progress: 'resting places', journal: 'Journal a rest clue', icon: 'bed.double.fill' as const,
    signature: { title: 'The Room That Asks Nothing', description: 'A complete rest-and-care space with no productivity waiting outside.', definitionId: 'comfort:rest:5' },
  },
} as const;

const COMPANION_NAMES = { steppling: 'Steppling', voyagle: 'Voyagle', flexel: 'Flexel', bedrotte: 'Bedrotte' } as const;

export function JourneyCohortStoryStage({ familyId, onBegin, onJournal, onMore, onOpenConversation, onOpenMerge }: {
  familyId: Exclude<AuthoredCohortFamilyId, 'baristabbit'>;
  onBegin: () => void;
  onJournal: () => void;
  onMore: () => void;
  onOpenConversation: (definitionId: string) => void;
  onOpenMerge: (orderId?: string | null) => void;
}) {
  const [story, setStory] = useState(() => loadAuthoredCohortStory(familyId));
  useEffect(() => subscribeCompanionStories(() => setStory(loadAuthoredCohortStory(familyId))), [familyId]);
  const copy = COPY[familyId];
  const needsBeginning = story.status === 'intro_available';
  const returnReady = story.status === 'return_available' || story.status === 'conversation_active';
  const complete = story.status === 'chapter_complete';
  const prefix = `merge-story:${familyId}:chapter-1:`;
  const progress = story.orderDeck?.servedOrderIds.filter((id) => id.startsWith(prefix)).length ?? 0;
  const requests = story.status === 'order_active'
    ? story.actPhase === 'signature_order'
      ? [{ ...copy.signature, served: false }]
      : (story.orderDeck?.templateKeys ?? []).flatMap((key) => {
          const order = AUTHORED_COHORT_ORDER_POOLS[familyId].find((item) => item.key === key);
          return order
            ? [{ title: order.title, description: order.description, definitionId: order.definitionId, served: story.orderDeck?.servedOrderIds.includes(`${prefix}${key}`) ?? false }]
            : [];
        })
    : [];
  const title = complete ? copy.completeTitle : returnReady ? `A note from ${COMPANION_NAMES[familyId]}`
    : needsBeginning ? copy.introTitle : story.actPhase === 'signature_order' ? copy.signatureTitle : `${progress} of 5 ${copy.progress} served`;
  const body = complete ? copy.completeBody : returnReady ? copy.returnBody : needsBeginning ? copy.introBody
    : story.actPhase === 'signature_order' ? copy.signatureBody : copy.regularBody;

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.level}><ThemedText style={styles.levelText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}><ThemedText style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>{copy.eyebrow}</ThemedText><ThemedText style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{title}</ThemedText></View>
    </View>
    <ThemedText style={styles.body} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{body}</ThemedText>
    {returnReady && story.pendingBondPoints > 0 ? <View style={styles.bond}><IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="heart.fill" size={15} /><ThemedText style={styles.bondText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>+{story.pendingBondPoints} Bond from the route</ThemedText></View> : null}
    <CompanionMergeRequestTray
      accessibilityLabel={`${copy.requestArea} requests`}
      eyebrow={copy.requestArea}
      palette={COMPANION_MERGE_REQUEST_PALETTE}
      requests={requests.map((request) => ({ id: request.title, title: request.title, definitionIds: [request.definitionId], served: request.served }))}
    />
    <Pressable accessibilityRole="button" onPress={() => {
      if (complete) onMore();
      else if (returnReady && story.pendingConversationId) { beginAuthoredCohortReturn(familyId); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBegin();
      else onOpenMerge(story.activeOrderId);
    }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name={returnReady ? 'bubble.left.and.bubble.right.fill' : copy.icon} size={19} />
      <ThemedText style={styles.primaryText} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{complete ? 'More together' : returnReady ? 'Read the note' : needsBeginning ? `Meet ${COMPANION_NAMES[familyId]}` : requests.length > 1 ? 'Open all orders' : 'Make the request'}</ThemedText>
      <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="arrow.right" size={17} />
    </Pressable>
    {!needsBeginning ? <Pressable accessibilityRole="button" onPress={onJournal} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><View style={styles.secondaryCopy}><IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryText} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>{copy.journal}</ThemedText></View><IconSymbol color={KatchaUI.companionScenePanel.inkSoft} name="arrow.right" size={15} /></Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 7, padding: 10 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 9 }, level: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 15, height: 40, justifyContent: 'center', width: 40 }, levelText: { fontSize: 17, fontWeight: '900' },
  copy: { flex: 1, gap: 1 }, eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 }, title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3, lineHeight: 21 }, body: { fontSize: 11.5, lineHeight: 16 },
  bond: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 }, bondText: { fontSize: 11.5, fontWeight: '900' },
  primary: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 15, flexDirection: 'row', gap: 8, minHeight: 43, paddingHorizontal: 12 }, primaryText: { flex: 1, fontSize: 13, fontWeight: '900' }, secondary: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: 10 }, secondaryCopy: { alignItems: 'center', flexDirection: 'row', gap: 7 }, secondaryText: { fontSize: 11, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
