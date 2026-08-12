import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { AUTHORED_COHORT_ORDER_POOLS, type AuthoredCohortFamilyId } from '@/utils/companion-story';
import { beginAuthoredCohortReturn, loadAuthoredCohortStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

const COPY = {
  steppling: {
    eyebrow: 'THE PATH OUTSIDE', completeTitle: 'The Path Outside is remembered', introTitle: 'A path is waiting',
    introBody: 'Meet Steppling and decide what movement should give you—headspace, purpose, company, discovery, or simply a way there.',
    regularBody: 'The Journey Locker makes trail and travel starters. Merge both into routes that fit the villager rather than testing them.',
    signatureTitle: 'One path with room for every pace', signatureBody: 'Bring together a landmark trail and a travel journal to make The Path Outside.',
    returnBody: 'Steppling has noticed something about how a path begins. The orders can wait while you talk.',
    completeBody: 'Five village routes, your movement insight, and The Path Outside now live in Shared history.',
    requestArea: 'ON THE PATH', progress: 'village routes', journal: 'Journal a movement moment', icon: 'figure.walk' as const,
    signature: { title: 'The Path Outside', description: 'A path for purpose, discovery, company, and a sustainable pace.', definitionId: 'adventure:trail:5' },
  },
  voyagle: {
    eyebrow: 'THE MAP WITH BLANK SPACES', completeTitle: 'The map is remembered', introTitle: 'Part of the map is blank',
    introBody: 'Meet Voyagle and decide what a journey should give you—discovery, rest, connection, a place, or one story worth keeping.',
    regularBody: 'The Journey Locker makes travel and trail starters. Merge them into journeys with enough preparation and room to change.',
    signatureTitle: 'One map that leaves room for surprise', signatureBody: 'Bring together a memory-worthy journey and a confident trail, leaving one space unwritten.',
    returnBody: 'Voyagle has found a clue about how you meet unfamiliar places. The map can wait while you talk.',
    completeBody: 'Five village journeys, your travel insight, and The Map with Blank Spaces now live in Shared history.',
    requestArea: 'ON THE MAP', progress: 'village journeys', journal: 'Journal a place or journey', icon: 'map.fill' as const,
    signature: { title: 'The Map with Blank Spaces', description: 'A prepared journey with one part deliberately left open.', definitionId: 'adventure:travel:5' },
  },
  flexel: {
    eyebrow: 'THE RHYTHM THAT HOLDS', completeTitle: 'The rhythm is remembered', introTitle: 'A rhythm can bend',
    introBody: 'Meet Flexel and decide what movement should give you—capability, energy, play, confidence, or a supported beginning.',
    regularBody: 'The Journey Locker and Comfort Chest work together here. Merge movement and care into sessions designed around real capacity.',
    signatureTitle: 'One rhythm strong enough to adapt', signatureBody: 'Bring together a landmark trail and a complete care station to make The Rhythm That Holds.',
    returnBody: 'Flexel has noticed what helps movement remain returnable. The session can pause while you talk.',
    completeBody: 'Five village sessions, your movement-and-recovery insight, and The Rhythm That Holds now live in Shared history.',
    requestArea: 'IN THE SESSION', progress: 'village sessions', journal: 'Journal movement or recovery', icon: 'dumbbell.fill' as const,
    signature: { title: 'The Rhythm That Holds', description: 'Movement and recovery arranged so there is enough left to return.', definitionId: 'adventure:trail:5' },
  },
  bedrotte: {
    eyebrow: 'THE ROOM THAT ASKS NOTHING', completeTitle: 'The room is remembered', introTitle: 'A quiet room is waiting',
    introBody: 'Meet Bedrotte and decide what rest should offer—sleep, quiet, comfort, boundaries, or company without demands.',
    regularBody: 'The Comfort Chest makes rest and care starters. Merge them into places that support the villager without trying to fix them.',
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
      ? [copy.signature]
      : (story.orderDeck?.templateKeys ?? []).flatMap((key) => {
          const order = AUTHORED_COHORT_ORDER_POOLS[familyId].find((item) => item.key === key);
          return order && !story.orderDeck?.servedOrderIds.includes(`${prefix}${key}`)
            ? [{ title: order.title, description: order.description, definitionId: order.definitionId }]
            : [];
        }).slice(0, 3)
    : [];
  const title = complete ? copy.completeTitle : returnReady ? `A note from ${COMPANION_NAMES[familyId]}`
    : needsBeginning ? copy.introTitle : story.actPhase === 'signature_order' ? copy.signatureTitle : `${progress} of 5 ${copy.progress} served`;
  const body = complete ? copy.completeBody : returnReady ? copy.returnBody : needsBeginning ? copy.introBody
    : story.actPhase === 'signature_order' ? copy.signatureBody : copy.regularBody;

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.level}><ThemedText style={styles.levelText} lightColor="#F8FFF5" darkColor="#F8FFF5">{story.currentLevel}</ThemedText></View>
      <View style={styles.copy}><ThemedText style={styles.eyebrow} lightColor="#496447" darkColor="#496447">{copy.eyebrow}</ThemedText><ThemedText style={styles.title} lightColor="#253424" darkColor="#253424">{title}</ThemedText></View>
    </View>
    <ThemedText style={styles.body} lightColor="#52604F" darkColor="#52604F">{body}</ThemedText>
    {returnReady && story.pendingBondPoints > 0 ? <View style={styles.bond}><IconSymbol color="#F8FFF5" name="heart.fill" size={15} /><ThemedText style={styles.bondText} lightColor="#F8FFF5" darkColor="#F8FFF5">+{story.pendingBondPoints} Bond from the route</ThemedText></View> : null}
    {requests.length ? <View style={styles.tray} accessibilityLabel={`${copy.requestArea} requests`}>
      <View style={styles.requestHeading}><ThemedText style={styles.eyebrow} lightColor="#496447" darkColor="#496447">{copy.requestArea}</ThemedText><ThemedText style={styles.count} lightColor="#52604F" darkColor="#52604F">{requests.length} {requests.length === 1 ? 'order' : 'orders'}</ThemedText></View>
      {requests.map((request) => <View key={request.title} style={styles.request}>
        <PersistentMergeItemArt definitionId={request.definitionId} size={48} />
        <View style={styles.requestCopy}><ThemedText style={styles.requestTitle} lightColor="#253424" darkColor="#253424">{request.title}</ThemedText><ThemedText numberOfLines={2} style={styles.requestBody} lightColor="#52604F" darkColor="#52604F">{request.description}</ThemedText><ThemedText style={styles.itemName} lightColor="#496447" darkColor="#496447">{MERGE_ITEMS_BY_ID.get(request.definitionId)?.name ?? 'Merge item'}</ThemedText></View>
      </View>)}
    </View> : null}
    <Pressable accessibilityRole="button" onPress={() => {
      if (complete) onMore();
      else if (returnReady && story.pendingConversationId) { beginAuthoredCohortReturn(familyId); onOpenConversation(story.pendingConversationId); }
      else if (needsBeginning) onBegin();
      else onOpenMerge(story.activeOrderId);
    }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color="#F8FFF5" name={returnReady ? 'bubble.left.and.bubble.right.fill' : copy.icon} size={19} />
      <ThemedText style={styles.primaryText} lightColor="#F8FFF5" darkColor="#F8FFF5">{complete ? 'More together' : returnReady ? 'Read the note' : needsBeginning ? `Meet ${COMPANION_NAMES[familyId]}` : requests.length > 1 ? 'Open all orders' : 'Make the request'}</ThemedText>
      <IconSymbol color="#F8FFF5" name="arrow.right" size={17} />
    </Pressable>
    {!needsBeginning ? <Pressable accessibilityRole="button" onPress={onJournal} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><View style={styles.secondaryCopy}><IconSymbol color="#405C3F" name="book.closed.fill" size={17} /><ThemedText style={styles.secondaryText} lightColor="#405C3F" darkColor="#405C3F">{copy.journal}</ThemedText></View><IconSymbol color="#405C3F" name="arrow.right" size={15} /></Pressable> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#F1F6E8', borderColor: 'rgba(70,97,65,0.25)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 28px rgba(45,65,42,0.14)', gap: 14, padding: 18 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 }, level: { alignItems: 'center', backgroundColor: '#587653', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 }, levelText: { fontSize: 20, fontWeight: '900' },
  copy: { flex: 1, gap: 2 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.35, lineHeight: 25 }, body: { fontSize: 13.5, lineHeight: 20 },
  bond: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#718C58', borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 34, paddingHorizontal: 12 }, bondText: { fontSize: 11.5, fontWeight: '900' },
  tray: { backgroundColor: 'rgba(255,255,255,0.62)', borderColor: 'rgba(70,97,65,0.18)', borderRadius: 20, borderWidth: 1, gap: 8, padding: 11 }, requestHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, count: { fontSize: 10.5, fontWeight: '800' },
  request: { alignItems: 'center', backgroundColor: '#FBFFF6', borderRadius: 15, flexDirection: 'row', gap: 10, minHeight: 68, paddingHorizontal: 9, paddingVertical: 6 }, requestCopy: { flex: 1, gap: 1 }, requestTitle: { fontSize: 13.5, fontWeight: '900', lineHeight: 18 }, requestBody: { fontSize: 11, lineHeight: 15 }, itemName: { fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  primary: { alignItems: 'center', backgroundColor: '#405C3F', borderRadius: 19, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 }, primaryText: { flex: 1, fontSize: 15, fontWeight: '900' }, secondary: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 13 }, secondaryCopy: { alignItems: 'center', flexDirection: 'row', gap: 9 }, secondaryText: { fontSize: 13, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
