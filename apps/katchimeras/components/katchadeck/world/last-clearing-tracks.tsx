import { useEffect, useMemo, useState } from 'react';
import { Pressable, type View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { LOST_TRACKS_LINES, LOST_TRACKS_LOOK, LOST_TRACKS_TITLE } from '@/features/onboarding/last-clearing';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';
import { ConversationNarrativeOverlay } from './conversation-narrative-overlay';

/**
 * The tracks (`docs/cozy-4x-ftue-the-last-clearing.md`, beat 11), first half: with the camera on the Lost Trail,
 * Mossprout sees the footprints going in and none coming out. The button closes the conversation; the trail itself is
 * then tapped (`LostTrailTapTarget`, with the ordinary finger and spotlight over it).
 */
export function LastClearingTracks({ onLooked }: { onLooked: () => void }) {
  const entries = useMemo((): ConversationTranscriptEntry[] => LOST_TRACKS_LINES.map((text, index) => ({ id: `lost-tracks:${index}`, speaker: 'mossprout', text })), []);
  return <ConversationNarrativeOverlay title={LOST_TRACKS_TITLE} entries={entries} checkpoint="lost-tracks" required paced onClose={() => undefined}>
    {(perform) => <KatchaButton fullWidth glow pill label={LOST_TRACKS_LOOK} onPress={() => perform(onLooked, true)} />}
  </ConversationNarrativeOverlay>;
}

/** The trail's tap target, over wherever its tile is on screen (measured once the camera has settled on it). */
export function LostTrailTapTarget({ node, onPress }: { node: View | null; onPress: () => void }) {
  const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!node) return;
    node.measureInWindow((x, y, width, height) => { if (width > 0 && height > 0) setFrame({ x, y, width, height }); });
  }, [node]);
  if (!frame) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="The Lost Trail" accessibilityHint="Follow the tracks" onPress={onPress}
    style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height, zIndex: 999 }} />;
}
