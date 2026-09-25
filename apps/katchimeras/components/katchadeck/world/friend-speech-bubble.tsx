import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppFontFamilies } from '@/constants/theme';

/**
 * A line said beside a docked board: plain (the friend at your side, unnamed), or with its speaker named. A muffled
 * line comes from somewhere you cannot see yet (a friend trapped under the Mist): dimmer, in italics.
 */
export type SpeechLine = string | { text: string; speaker: string; muffled?: boolean };
export const speechText = (line: SpeechLine) => (typeof line === 'string' ? line : line.text);

/** How far the bubble sits above the card's baseline. */
export const BUBBLE_RAISE = 30;

/**
 * What a friend says beside a docked board: a small pale bubble with a tail
 * toward whatever it stands beside (a request card, an ability button). Its
 * text is its key, so a new line fades in as one piece.
 */
export const FriendSpeechBubble = memo(function FriendSpeechBubble({ text: line, reduceMotion, tail = 'right', raise = true }: { text: SpeechLine; reduceMotion: boolean; tail?: 'right' | 'none'; raise?: boolean }) {
  const text = speechText(line);
  const voice = typeof line === 'string' ? null : line;
  return <Animated.View key={text} entering={FadeIn.duration(reduceMotion ? 80 : 280).delay(reduceMotion ? 0 : 120)} exiting={FadeOut.duration(reduceMotion ? 60 : 180)}
    pointerEvents="none" style={[styles.bubbleColumn, raise ? { marginBottom: BUBBLE_RAISE } : null]}>
    <View style={[styles.bubble, voice?.muffled ? styles.muffledBubble : null]}>
      {voice ? <Text style={[styles.speaker, voice.muffled ? styles.muffledSpeaker : null]}>{voice.speaker}</Text> : null}
      <Text style={[styles.bubbleText, voice?.muffled ? styles.muffledText : null]}>{text}</Text>
      {tail === 'right' ? <View style={styles.bubbleTail} /> : null}
    </View>
  </Animated.View>;
});

const styles = StyleSheet.create({
  bubbleColumn: { flexShrink: 1, maxWidth: 220 },
  bubble: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderCurve: 'continuous',
    backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(20,40,60,0.16)',
  },
  bubbleText: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 17 },
  speaker: { color: '#5E7F9E', fontFamily: AppFontFamilies.fredokaBold, fontSize: 10, letterSpacing: 0.6, lineHeight: 13, textTransform: 'uppercase', marginBottom: 2 },
  muffledBubble: { backgroundColor: '#E6E1F2', borderColor: '#F3EFFA' },
  muffledSpeaker: { color: '#7A6A9E' },
  muffledText: { color: '#51456E', fontStyle: 'italic' },
  // The tail: a corner of the same bubble, turned to point at what it stands beside.
  bubbleTail: { position: 'absolute', right: -6, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: '#F4F9FD', borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
});
