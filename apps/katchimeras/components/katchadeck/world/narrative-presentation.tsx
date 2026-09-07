import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KatchaUI } from '@/constants/katcha-ui';

export function NarrativeDialogue({ name, text, portrait, right = false, current = false }: {
  name: string; text: string; portrait: ReactNode; right?: boolean; current?: boolean;
}) {
  const accent = right ? '#ED9F4D' : '#69BBDD';
  return <View style={[narrativeStyles.dialogue, right && narrativeStyles.dialogueRight]}>
    <View style={narrativeStyles.portraitSlot}>
      {portrait}
      <View style={[narrativeStyles.nameBadge, { backgroundColor: accent }]}><Text style={narrativeStyles.speaker}>{name}</Text></View>
    </View>
    <View style={[narrativeStyles.words, { borderColor: accent, backgroundColor: right ? '#FFF7E8' : '#EEF9FD' }]}>
      <View pointerEvents="none" style={[narrativeStyles.tail, right ? narrativeStyles.tailRight : narrativeStyles.tailLeft, { borderColor: accent, backgroundColor: right ? '#FFF7E8' : '#EEF9FD' }]} />
      <Text style={[narrativeStyles.dialogueText, { color: right ? '#92602B' : '#205779' }]}>{text}</Text>
      {current ? <Text style={narrativeStyles.tapHint}>Tap to continue ▾</Text> : null}
    </View>
  </View>;
}
export const narrativeStyles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(12,26,34,0.86)', paddingHorizontal: 16, alignItems: 'center' },
  splash: { width: '100%', maxWidth: 520, flex: 1 },
  banner: { minHeight: 64, marginHorizontal: 12, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 28, backgroundColor: '#F5BC54', borderWidth: 3, borderColor: '#FFE292', borderRadius: 18, boxShadow: '0 5px 0 #AD642A' },
  ribbon: { position: 'absolute', width: 24, height: 42, backgroundColor: '#E49A38', top: 15, zIndex: -1 },
  ribbonLeft: { left: -17, transform: [{ rotate: '-12deg' }] }, ribbonRight: { right: -17, transform: [{ rotate: '12deg' }] },
  title: { ...KatchaUI.type.companionCardTitle, fontSize: 25, lineHeight: 30, color: '#6D4024', textAlign: 'center' },
  levelBadge: { alignSelf: 'center', backgroundColor: '#AA663F', paddingHorizontal: 28, paddingTop: 10, paddingBottom: 8, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, zIndex: -1 },
  level: { ...KatchaUI.type.companionCardTitle, color: '#FFF4DB', fontSize: 18, lineHeight: 23 },
  close: { position: 'absolute', top: -14, right: -15, width: 44, height: 44, borderRadius: 22, backgroundColor: '#D95541', borderWidth: 3, borderColor: '#FFF1C6', alignItems: 'center', justifyContent: 'center' },
  closeText: { ...KatchaUI.type.companionCardTitle, color: '#FFF', fontSize: 32, lineHeight: 35 },
  scroll: { flex: 1, marginTop: 20 }, transcript: { paddingTop: 4, paddingBottom: 22, paddingHorizontal: 4, gap: 24 }, chapter: { gap: 24 },
  chapterTitle: { ...KatchaUI.type.companionBody, color: '#E7DBC5', textAlign: 'center', fontSize: 12 },
  dialogue: { flexDirection: 'row', alignItems: 'center', gap: 12 }, dialogueRight: { flexDirection: 'row-reverse' },
  portraitSlot: { width: 84, minHeight: 98, alignItems: 'center', justifyContent: 'center', paddingBottom: 22 },
  nameBadge: { position: 'absolute', bottom: 0, minWidth: 84, maxWidth: 100, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: '#FFF1CB' },
  speaker: { ...KatchaUI.type.companionCardTitle, fontSize: 13, lineHeight: 17, color: '#243B46', textAlign: 'center' },
  words: { flex: 1, borderWidth: 3, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 14, boxShadow: '0 4px 0 rgba(0,0,0,0.16)' },
  tail: { position: 'absolute', top: '50%', marginTop: -7, width: 14, height: 14, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -9, borderLeftWidth: 3, borderBottomWidth: 3 }, tailRight: { right: -9, borderRightWidth: 3, borderTopWidth: 3 },
  dialogueText: { ...KatchaUI.type.companionDisplay, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  tapHint: { ...KatchaUI.type.companionBody, fontSize: 11, lineHeight: 16, color: '#64767C', textAlign: 'right', marginTop: 8 },
  footer: { paddingTop: 12, paddingHorizontal: 28 }, error: { ...KatchaUI.type.companionBody, color: '#FFF1CB', textAlign: 'center', paddingTop: 8 },
});
