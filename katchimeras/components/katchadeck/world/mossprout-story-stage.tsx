import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { beginMossproutChapterOne, beginMossproutReturn, loadMossproutStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

const REQUESTS = {
  2: { title: 'A Place for Rain', description: 'Make a Shell to catch the first drops.', definitionIds: ['nature:waterside:2'] },
  3: { title: 'A Bank That Holds', description: 'Set a Plant beside the Shell.', definitionIds: ['nature:garden:3', 'nature:waterside:2'] },
  4: { title: 'The Little Rain Garden', description: 'Finish the garden with a Flower and Tidepool.', definitionIds: ['nature:garden:4', 'nature:waterside:3'] },
} as const;

export function MossproutStoryStage({ onMore, onOpenConversation, onOpenMerge }: {
  onMore: () => void;
  onOpenConversation: (definitionId: string) => void;
  onOpenMerge: (orderId?: string | null) => void;
}) {
  const [story, setStory] = useState(loadMossproutStory);
  useEffect(() => subscribeCompanionStories(() => setStory(loadMossproutStory())), []);
  const returnReady = story.status === 'return_available' || story.status === 'conversation_active';
  const complete = story.status === 'chapter_complete';
  const request = REQUESTS[story.targetLevel as keyof typeof REQUESTS] ?? REQUESTS[2];
  const title = complete ? 'The rain garden remembers' : returnReady ? 'A note from Mossprout' : story.status === 'intro_available' ? 'Where the Water Goes' : request.title;
  const body = complete
    ? 'The garden now catches rain—and holds a welcome for whoever left those footprints.'
    : returnReady
      ? 'The request is finished. Mossprout has noticed what changed.'
      : story.status === 'intro_available'
        ? 'Pebbles have begun appearing in the Wild Garden. Mossprout has an idea for them.'
        : request.description;
  const requests = story.status === 'order_active' ? [{ id: `mossprout:${story.targetLevel}`, ...request, quantity: 1 }] : [];

  return <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
    <View style={styles.heading}>
      <View style={styles.badge}><IconSymbol color="#F5FFE4" name="leaf.fill" size={20} /></View>
      <View style={styles.copy}>
        <ThemedText style={styles.eyebrow} lightColor="#647A3D" darkColor="#647A3D">WHERE THE WATER GOES</ThemedText>
        <ThemedText selectable style={styles.title} lightColor="#344127" darkColor="#344127">{title}</ThemedText>
      </View>
    </View>
    <ThemedText selectable style={styles.body} lightColor="#596149" darkColor="#596149">{body}</ThemedText>
    <CompanionMergeRequestTray
      accessibilityLabel="Mossprout's requested merge items"
      eyebrow="NEXT REQUEST"
      palette={{ trayBackground: 'rgba(255,255,255,0.5)', trayBorder: 'rgba(100,122,61,0.24)', rowBackground: '#F9F6DE', eyebrow: '#647A3D', count: '#526033', title: '#344127', description: '#667054', item: '#536336', badgeBackground: '#657B3E', badgeText: '#F7FFE8' }}
      requests={requests}
    />
    <Pressable accessibilityRole="button" onPress={() => {
      if (complete) onMore();
      else if (returnReady && story.pendingConversationId) { beginMossproutReturn(); onOpenConversation(story.pendingConversationId); }
      else if (story.status === 'intro_available') { const next = beginMossproutChapterOne(); onOpenMerge(next.activeOrderId); }
      else onOpenMerge(story.activeOrderId);
    }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <IconSymbol color="#F7FFE8" name={returnReady ? 'envelope.fill' : complete ? 'bubble.left.and.bubble.right.fill' : 'leaf.fill'} size={18} />
      <ThemedText style={styles.primaryLabel} lightColor="#F7FFE8" darkColor="#F7FFE8">{complete ? 'More with Mossprout' : returnReady ? 'Read Mossprout’s note' : 'Open the garden'}</ThemedText>
      <IconSymbol color="#F7FFE8" name="arrow.right" size={16} />
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#F2F0D2', borderColor: 'rgba(93,113,57,0.3)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 28px rgba(53,68,38,0.16)', gap: 14, padding: 18 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  badge: { alignItems: 'center', backgroundColor: '#657B3E', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 2 }, eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.35, lineHeight: 25 },
  body: { fontSize: 13.5, lineHeight: 20 },
  primary: { alignItems: 'center', backgroundColor: '#657B3E', borderCurve: 'continuous', borderRadius: 19, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 },
  primaryLabel: { flex: 1, fontSize: 15, fontWeight: '900' }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
